# Prueba real de FASHN VTON v1.5 en Baseten — registro (28/10/2026)

**Veredicto: BLOQUEADA por permisos de la clave. Coste incurrido: 0 $.**
Autorización de Lee (28/10 23:34): despliegue + primera prueba real con
≈1–3 $ del crédito Baseten ya concedido (100 $), tope duro 5 $.

## Lo que SÍ se hizo (verificado)

1. **La cuenta responde en la API de plataforma con la clave actual**:
   `GET https://api.baseten.co/v1/models` → HTTP 200, `{"models": []}`.
2. **El truss quedó construido y validado por la CLI oficial** (truss
   0.18.36): `probador/truss-fashn/` — config con GPU **L4** (la más
   pequeña con bf16 digno; la T4 es Turing y el modelo trabaja en
   bfloat16), `model/model.py` que descarga los pesos oficiales de
   HuggingFace (`fashn-ai/fashn-vton-1.5` + `fashn-ai/DWPose`, ~2,3 GB)
   en `load()` y expone el pipeline oficial sin modificar.
3. **El adaptador existe y su lógica está probada sin red**
   (`probador/adaptador_fashn_baseten.py`, contrato del diagnóstico;
   `probador/test_adaptador_fashn.py`: 5/5 — forma de petición, parseo,
   fórmula de coste con la tarifa oficial L4 de 0,01414 $/min,
   reintentos acotados, error claro sin despliegue). Esto NO es una
   prueba E2E: ninguna generación se ha ejecutado.
4. **Imágenes de la prueba preparadas, con procedencia oficial**:
   `persona-oficial.webp` (832×1248, 135.640 B) y `prenda-oficial.webp`
   (576×864, 34.150 B) = `examples/data/model.webp` y
   `examples/data/garment.webp` del repo oficial
   `github.com/fashn-AI/fashn-vton-1.5` (tamaños idénticos a los del
   listado oficial del repo). Son las imágenes del propio ejemplo
   oficial (`basic_inference.py`, categoría `tops`). Ninguna foto de
   Lee, Arianna o clientas se ha usado ni se usará para esta prueba.

## El bloqueo, con la evidencia literal de la plataforma

- `truss push truss-fashn --promote` (desde la máquina, clave en el
  entorno del servidor):
  `ERROR ApiError: The user does not have the authorization to perform the request`
- Llamada directa equivalente, para aislar la causa:
  `POST https://api.baseten.co/v1/models` →
  **HTTP 403** `{"code": "PERMISSION_DENIED", "message": "Authorization error"}`
- `GET /v1/api_keys` también devuelve error de autorización: la clave
  no puede ni listar claves. Tras el intento, `GET /v1/models` siguió
  devolviendo `[]`: **no se creó nada ni se gastó nada**.

**Interpretación honesta**: la clave de la que disponemos (la del
conector custom.baseten, la misma que usa Hermes para Spark) es una
clave **de inferencia** (Model API): sirve para llamar modelos, no
para crear despliegues propios. No se puede distinguir desde aquí si
además el crédito del hackathon está restringido a Model APIs; ambas
hipótesis llevan a la misma acción de desbloqueo.

## Qué desbloquea (acción de Lee, en la consola de Baseten)

1. Baseten → Settings → API Keys → crear una clave **con permisos de
   despliegue** (workspace/full access, no solo inferencia) y guardarla
   en la bóveda / en la máquina como se hizo con la actual.
2. Si la consola exigiera método de pago para despliegues dedicados
   pese al crédito, eso ya sería un gasto nuevo: requiere su OK aparte
   (no se ha puesto ninguna tarjeta).

Con esa clave, el despliegue es UN comando desde la máquina
(`truss push` del truss ya construido) y la prueba E2E es el CLI del
adaptador con las dos imágenes oficiales de esta carpeta. Presupuesto
estimado al desbloquear: L4 a 0,01414 $/min; arranque en frío con
descarga de pesos (~2,3 GB) + 3–5 generaciones ≈ 20–40 min de réplica
activa ≈ **0,3–0,6 $**, dentro de lo autorizado.

## Estado del despliegue

- **No existe**: ningún modelo ni réplica quedó creado; no hay coste
  en reposo que gestionar. Cuando exista, la configuración prevista es
  autoscaling con `min_replicas: 0` (escalado a cero, el defecto de
  Baseten) y se verificará por API tras el push.
