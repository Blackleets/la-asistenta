#!/usr/bin/env python3
"""Pruebas SIN RED del adaptador FASHN/Baseten (lógica, no transporte).

Verifican: forma de la petición, parseo de la respuesta, fórmula de
coste, reintentos acotados y los errores de configuración/categoría.
NO sustituyen a la prueba real E2E, que exige el despliegue vivo
(hoy bloqueado: ver probador/prueba-fashn/README.md).

Uso: python3 -m unittest probador/test_adaptador_fashn.py
     (desde ~/workspace/la-asistenta) o ruta directa al fichero.
"""

import base64
import sys
import unittest
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import adaptador_fashn_baseten as ad

PNG_FALSO = base64.b64encode(b"\x89PNG-falso").decode("ascii")


def post_ok(url, cuerpo, clave, timeout):
    post_ok.llamadas.append((url, cuerpo, clave, timeout))
    return {
        "image_b64": PNG_FALSO,
        "width": 576,
        "height": 864,
        "inference_s": 12.3,
        "model": "fashn-vton-1.5",
    }


post_ok.llamadas = []


class TestAdaptadorFashn(unittest.TestCase):
    def setUp(self):
        post_ok.llamadas = []

    def test_peticion_y_respuesta(self):
        r = ad.probar(
            b"persona", b"prenda", "tops",
            model_id="abc123", clave="k", _post=post_ok, _dormir=lambda s: None,
        )
        url, cuerpo, clave, timeout = post_ok.llamadas[0]
        self.assertIn("model-abc123.api.baseten.co", url)
        self.assertIn("/environments/production/predict", url)
        self.assertEqual(cuerpo["category"], "tops")
        self.assertEqual(
            cuerpo["person_image_b64"], base64.b64encode(b"persona").decode()
        )
        self.assertEqual(clave, "k")
        self.assertEqual(r["imagen_png"], b"\x89PNG-falso")
        self.assertEqual(r["proveedor"], "baseten")
        self.assertEqual(r["modelo"], "fashn-vton-1.5")
        self.assertEqual(r["resolucion"], [576, 864])
        self.assertEqual(r["inference_s_servidor"], 12.3)
        # La llamada falsa tarda ~0 s: se verifica la fórmula, no el importe.
        self.assertEqual(
            r["coste_estimado_usd"],
            round(r["latencia_s"] * ad.TARIFA_L4_USD_POR_S, 5),
        )
        # Y la tarifa aplicada es la oficial de la L4: 60 s ≈ 0,01414 $.
        self.assertAlmostEqual(60 * ad.TARIFA_L4_USD_POR_S, 0.01414, places=5)

    def test_categoria_invalida(self):
        with self.assertRaises(ValueError):
            ad.probar(b"p", b"g", "gafas", model_id="x", clave="k", _post=post_ok)

    def test_sin_model_id_no_llama(self):
        with self.assertRaises(ad.MotorNoConfigurado):
            ad.probar(b"p", b"g", "tops", model_id="", clave="k", _post=post_ok)
        self.assertEqual(post_ok.llamadas, [])

    def test_reintento_acotado_ante_503(self):
        intentos = {"n": 0}

        def post_503(url, cuerpo, clave, timeout):
            intentos["n"] += 1
            raise urllib.error.HTTPError(url, 503, "no", None, None)

        with self.assertRaises(ad.ErrorMotor):
            ad.probar(
                b"p", b"g", "tops", model_id="x", clave="k",
                _post=post_503, _dormir=lambda s: None,
            )
        self.assertEqual(intentos["n"], ad.MAX_REINTENTOS + 1)

    def test_sin_reintento_ante_400(self):
        intentos = {"n": 0}

        def post_400(url, cuerpo, clave, timeout):
            intentos["n"] += 1
            raise urllib.error.HTTPError(url, 400, "no", None, None)

        with self.assertRaises(ad.ErrorMotor):
            ad.probar(
                b"p", b"g", "tops", model_id="x", clave="k",
                _post=post_400, _dormir=lambda s: None,
            )
        self.assertEqual(intentos["n"], 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
