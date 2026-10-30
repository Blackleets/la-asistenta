# Probador virtual — interfaces y contratos (PREPARADO, NO ACTIVO)

> Estado a 28/10/2026: el probador virtual de moda es un **módulo
> «próximamente»** en el registro central (`web/modulos.json`,
> id `moda_probador`). Este documento define los contratos para
> incorporarlo sin reescribir la aplicación. **No hay motor
> implementado ni créditos consumiéndose**: la investigación de
> modelos vive en `MODELOS_TRYON.md` y el primer adaptador candidato
> (FASHN VTON v1.5) está construido y dormido en este directorio.
>
> El **análisis de cejas** del módulo Belleza usa su propio flujo
> (foto → Muse Spark → recomendación contra la carta) y **no** se
> acopla a estas interfaces: seguirá funcionando igual si el probador
> de moda nunca se activa.

## 1 · Perfil visual / avatar

```jsonc
// PerfilVisual — vive SOLO en el dispositivo hasta que la usuaria
// confirme un envío concreto a un motor.
{
  "fotoLocal": "dataURI | null",   // nunca sale del dispositivo por defecto
  "creadoEn": "ISO-8601",
  "consentimientos": ["identificadorDeEnvio"]  // §2
}
```

- Crear/cambiar/borrar la foto es local e inmediato; borrar elimina
  también los resultados asociados que la referencien.
- Ningún dato biométrico derivado (embeddings, landmarks persistidos)
  se guarda en esta fase de diseño: si un motor lo necesita, se
  calcula en memoria durante la generación y se descarta.

## 2 · Consentimiento y gestión de imágenes

- **Consentimiento separado y previo por envío**: mostrar a qué
  proveedor va la foto, con qué fin y cuánto se retiene, ANTES de
  enviar. El patrón ya existe en producción para el análisis de
  cejas (pantalla de consentimiento previa a la foto) y se reutiliza.
- La foto original **no se guarda en el servidor** salvo que el
  contrato del motor exija subirla para procesarla; en ese caso se
  registra solo la referencia del trabajo, no la imagen.
- Retención por defecto propuesta: resultados visibles para la
  usuaria en su dispositivo; en servidor, trabajos efímeros con la
  misma política que el análisis actual (en memoria, descarte al
  terminar, TTL corto para el sondeo).

## 3 · Catálogo de productos y variantes

```jsonc
// Producto (instantánea curada y servida por el servidor, como la
// carta del salón hoy: procedencia y fecha visibles en la UI)
{
  "id": "estable",
  "nombre": "...", "marca": "...",
  "precio": {"importe": 0, "moneda": "EUR"},   // tal cual la fuente
  "imagenPrenda": "URL",        // imagen limpia de la prenda (input del motor)
  "categoriaMotor": "tops | bottoms | one-pieces | ...",  // la que exija el adaptador
  "variantes": [{"color": "...", "talla": "...", "imagenPrenda": "URL", "disponible": true}],
  "urlCompra": "https://tienda-real/...",
  "fuente": {"proveedor": "...", "capturadoEn": "ISO-8601"}
}
```

Regla del proyecto: nada entra al catálogo sin foto, precio y
disponibilidad de un comercio real verificados. Disponibilidad y
precio se confirman de nuevo en la tienda al hacer clic en comprar.

## 4 · Adaptador de modelo de prueba virtual

Contrato ya fijado en `DIAGNOSTICO_PROBADOR.md` y cumplido por
`adaptador_fashn_baseten.py`:

```
probar(foto_persona, imagen_prenda, categoria, variante?) ->
  { imagen_resultado,
    proveedor, modelo,            // quién generó, sin ambigüedad
    latencia_s, coste_estimado,   // medidos/estimados por llamada
    trabajo_id }                  // para sondeo asíncrono
```

- **Siempre asíncrono** (patrón anti-502 ya en producción: crear
  trabajo → 202 → sondeo con progreso honesto → resultado o error
  recuperable con reintento).
- Timeouts y reintentos acotados; un proveedor caído devuelve un
  error humano, nunca una imagen simulada.
- La salida se valida antes de mostrarse (formato, tamaño) y se
  presenta como **aproximación visual**, nunca como garantía de
  talla, ajuste o resultado exacto.
- Cambiar de proveedor = escribir otro adaptador con este contrato;
  la interfaz y el orquestador no cambian.

## 5 · Orquestador

Muse Spark (ya conectado vía Baseten) interpreta la petición y
elige capacidad/producto; **no** genera la prueba. El motor
especializado genera; la aplicación decide qué enseñar.

## 6 · Resultados, comparación y looks guardados

```jsonc
// LookGuardado — en el dispositivo, como «Mis guardados» hoy
{ "productoId": "...", "variante": "...", "resultadoRef": "...",
  "creadoEn": "ISO-8601" }
```

- La usuaria puede comparar original ↔ resultado y entre variantes.
- Guardar un look guarda la referencia, no obliga a conservar la
  foto original en servidor.

## 7 · Enlaces de compra

- Solo URLs de comercios reales procedentes del catálogo (§3).
- El clic se mide (patrón de embudo existente: evento registrado en
  servidor) y abre la tienda en pestaña nueva. La plataforma no
  procesa pagos en esta fase.

## 8 · Procedimiento de activación (por configuración)

1. Cumplir y **verificar** las dependencias del módulo en
   `web/modulos.json` → `moda_probador.dependencias` (motor probado
   con generaciones reales registradas, catálogo verificado, clave
   con permisos de despliegue).
2. Servir la instantánea de catálogo (§3) desde el servidor.
3. Conectar el adaptador (§4) tras el endpoint asíncrono de trabajos.
4. Cambiar en `web/modulos.json`: `moda_probador.estado` →
   `"activo"`. La estantería, los chips de Explorar y el destino del
   módulo se actualizan solos: no se toca código.
5. Repetir las pruebas obligatorias (baterías + QA con clics) antes
   de darlo por abierto.

## 9 · Dependencias abiertas (a 28/10/2026)

| Dependencia | Estado |
|---|---|
| Clave de Baseten con permisos de despliegue | **Bloqueada**: la actual es solo de inferencia (403 al crear despliegues). La crea Lee en la consola de Baseten. |
| Motor FASHN VTON v1.5 | Truss + adaptador construidos, tests sin red 5/5, **ninguna generación ejecutada** (coste 0 $). |
| Clave de equipo de Meta (Muse Image / SAM 3.1) | Sin crear; gate en Billing de dev.meta.ai (solo Lee). **Cableado completo el 29/10/2026**: proveedor `probador/proveedor_meta.py`, interruptor de capacidad en la web (`/api/capacidades`), paso visual en el resultado del análisis y look con imagen, todo verificado contra un stub local sin clave y sin gasto (ESTADO §47). Activación en minutos: `ACTIVACION_META.md`. |
| Catálogo de productos reales | Sin instantánea: la fase de catálogo de moda se detuvo por la corrección de dirección del 28/10 23:45 y el directorio `catalogo/` quedó vacío. |
