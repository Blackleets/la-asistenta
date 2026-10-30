#!/usr/bin/env python3
"""Pruebas del proveedor Meta Model API contra un STUB LOCAL.

Ejercitan el cliente REAL (proveedor_meta.py) por HTTP de verdad
contra stub_meta.py en 127.0.0.1: petición bien formada, respuesta
procesada y lista para guardarse como look, errores mapeados
(401 → ClaveNoValida sin reintentos y sin filtrar nada; timeout →
reintentos acotados; 429 → espera y reintento) y el interruptor de
capacidad volcándose al poner una clave FALSA en el entorno.

PROHIBIDO llamar a api.meta.ai real desde estas pruebas: la base se
fuerza siempre al stub vía META_MODEL_API_BASE.

Uso: python3 -m unittest probador/test_proveedor_meta.py
     (desde ~/workspace/la-asistenta) o ruta directa al fichero.
"""

import base64
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import proveedor_meta as pm
import stub_meta

FOTO = b"\xff\xd8\xff\xe0" + b"foto-de-prueba" * 4  # JPEG «de mentira»
PNG_STUB = base64.b64decode(stub_meta.PNG_1PX_B64)
ANALISIS = {
    "servicio_recomendado": "Diseño de cejas",
    "motivo": "perfila sin oscurecer",
    "resumen": "Cejas pobladas y rectas.",
}
PREFS = {"naturalidad": 4, "grosor": "medio", "arco": "suave",
         "tono": "+1", "intensidad": "natural"}


class TestProveedorMeta(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.servidor, _, cls.base = stub_meta.crear_servidor(0)

    @classmethod
    def tearDownClass(cls):
        cls.servidor.shutdown()

    def setUp(self):
        self._env_previo = dict(os.environ)
        os.environ.pop("META_MODEL_API_KEY", None)
        os.environ["META_MODEL_API_BASE"] = self.base
        # Aislamiento: por defecto, ningún fichero de entorno.
        fd, self._env_inexistente = tempfile.mkstemp()
        os.close(fd)
        os.unlink(self._env_inexistente)
        os.environ["META_ENV_FILE"] = self._env_inexistente
        self.servidor.registro.clear()
        with self.servidor.lock:
            self.servidor.contadores.clear()
        self.esperas = []

    def tearDown(self):
        os.environ.clear()
        os.environ.update(self._env_previo)

    def _posts(self):
        return [r for r in self.servidor.registro if r["metodo"] == "POST"]

    # ---------- interruptor de capacidad ----------

    def test_sin_clave_no_hay_capacidad_ni_llamadas(self):
        self.assertFalse(pm.configurado())
        self.assertEqual(pm.fuente_clave(), "ninguna")
        with self.assertRaises(pm.ProveedorNoConfigurado):
            pm.editar_cejas(FOTO, "instrucción")
        with self.assertRaises(pm.ProveedorNoConfigurado):
            pm.listar_modelos()
        self.assertEqual(self.servidor.registro, [])

    def test_interruptor_vuelca_con_clave_falsa_en_entorno(self):
        os.environ["META_MODEL_API_KEY"] = "stub-falsa-de-prueba"
        self.assertTrue(pm.configurado())
        self.assertEqual(pm.fuente_clave(), "entorno")

    def test_interruptor_vuelca_con_clave_falsa_en_fichero(self):
        fd, ruta = tempfile.mkstemp()
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write("META_MODEL_API_KEY=stub-falsa-en-fichero\n")
        os.environ["META_ENV_FILE"] = ruta
        try:
            self.assertTrue(pm.configurado())
            self.assertEqual(pm.fuente_clave(), "fichero")
            self.assertEqual(pm.clave(), "stub-falsa-en-fichero")
        finally:
            os.unlink(ruta)

    def test_fichero_sin_clave_no_activa(self):
        fd, ruta = tempfile.mkstemp()
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write("OTRA_COSA=1\nMETA_MODEL_API_KEY=\n")
        os.environ["META_ENV_FILE"] = ruta
        try:
            self.assertFalse(pm.configurado())
        finally:
            os.unlink(ruta)

    # ---------- camino feliz ----------

    def test_peticion_bien_formada(self):
        os.environ["META_MODEL_API_KEY"] = "stub-ok"
        pm.editar_cejas(FOTO, "edita solo las cejas", _dormir=lambda s: None)
        posts = self._posts()
        self.assertEqual(len(posts), 1)
        p = posts[0]
        self.assertEqual(p["ruta"], "/v1/responses")
        self.assertEqual(p["modelo"], "muse-image-1.0")
        self.assertTrue(p["tiene_imagen"])
        self.assertEqual(p["textos"], ["edita solo las cejas"])

    def test_respuesta_procesada_y_payload_de_look(self):
        os.environ["META_MODEL_API_KEY"] = "stub-ok"
        r = pm.editar_cejas(FOTO, "edita solo las cejas",
                            _dormir=lambda s: None)
        self.assertEqual(r["imagen"], PNG_STUB)
        self.assertEqual(r["mime"], "image/png")
        self.assertEqual(r["proveedor"], "meta-model-api")
        self.assertEqual(r["modelo"], "muse-image-1.0")
        self.assertEqual(r["coste_estimado_usd"], 0.01)
        self.assertEqual(r["respuesta_id"], "resp_stub_imagen")
        # La forma en que viaja a la web y se guarda como look:
        payload = pm.payload_visual(r)
        self.assertEqual(payload["estado"], "listo")
        self.assertTrue(payload["imagen"].startswith("data:image/png;base64,"))
        self.assertEqual(
            base64.b64decode(payload["imagen"].split(",", 1)[1]), PNG_STUB)

    def test_listar_modelos(self):
        os.environ["META_MODEL_API_KEY"] = "stub-ok"
        self.assertEqual(
            pm.listar_modelos(_dormir=lambda s: None),
            ["muse-spark-1.3", "muse-image-1.0", "sam-3.1"])

    def test_segmentar_parsea_formato_real(self):
        # Formato real confirmado el 30/10/2026 (§62): tokens box/mask
        # en un output_text; el stub ya emite esa forma.
        os.environ["META_MODEL_API_KEY"] = "stub-ok"
        r = pm.segmentar(FOTO, _dormir=lambda s: None)
        self.assertEqual(r["caja"], {"x1": 10, "y1": 20, "x2": 110,
                                     "y2": 70, "w": 1200, "h": 1800})
        self.assertTrue(r["mascara_datos"].startswith("51,101,"))
        self.assertEqual(r["mascara_dims"], (51, 101))
        self.assertEqual(r["mascara_origen"], {"x": 0, "y": 0})
        self.assertEqual(r["modelo"], "sam-3.1")
        self.assertEqual(r["prompt"], "eyebrows")
        self.assertEqual(r["coste_estimado_usd"], 0.0025)
        self.assertEqual(r["respuesta_id"], "resp_stub_sam")
        self.assertEqual(self._posts()[0]["textos"], ["eyebrows"])

    def test_instruccion_desde_analisis_validado(self):
        texto = pm.construir_instruccion(ANALISIS, PREFS)
        self.assertIn("Diseño de cejas", texto)
        self.assertIn("SOLO en la zona de las cejas", texto)
        self.assertIn("identidad de la persona", texto)
        self.assertIn("intensidad natural", texto)

    # ---------- errores mapeados ----------

    def test_401_clave_no_valida_sin_reintentos(self):
        os.environ["META_MODEL_API_KEY"] = "stub-401"
        with self.assertRaises(pm.ClaveNoValida):
            pm.editar_cejas(FOTO, "x", _dormir=lambda s: None)
        self.assertEqual(len(self._posts()), 1)

    def test_429_espera_y_reintenta(self):
        os.environ["META_MODEL_API_KEY"] = "stub-429-una-vez"
        r = pm.editar_cejas(FOTO, "x", _dormir=self.esperas.append)
        self.assertEqual(r["imagen"], PNG_STUB)
        self.assertEqual(len(self._posts()), 2)
        # El stub manda Retry-After: 1 y el cliente lo respeta.
        self.assertEqual(self.esperas, [1])

    def test_timeout_reintenta_y_llega(self):
        os.environ["META_MODEL_API_KEY"] = "stub-lenta-una-vez"
        r = pm.editar_cejas(FOTO, "x", _dormir=lambda s: None, timeout=1)
        self.assertEqual(r["imagen"], PNG_STUB)
        self.assertEqual(len(self._posts()), 2)

    def test_timeout_persistente_agota_reintentos(self):
        os.environ["META_MODEL_API_KEY"] = "stub-lenta-siempre"
        with self.assertRaises(pm.ErrorProveedor):
            pm.editar_cejas(FOTO, "x", _dormir=lambda s: None, timeout=1)
        self.assertEqual(len(self._posts()), pm.MAX_REINTENTOS + 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
