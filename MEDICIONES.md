# LA ASISTENTA — Mediciones de la Fase 2 (arquitectura multinegocio)

Medido el **29/10/2026** contra los servicios reales en marcha en la
máquina InstaBox `la-asistenta`, con `agenda/mediciones.py` (reproducible:
basta ejecutarlo en la máquina; crea citas «PRUEBA MEDICION» y las deja
**canceladas**, la semántica de siempre — verificado al final de la
corrida: 0 confirmadas de prueba). Latencias medidas en **localhost**
(cliente y servidor en la misma máquina): son el suelo del sistema, sin
red pública ni TLS de por medio.

## Hardware y forma actual

- InstaBox plan gratuito: **4 vCPU, 8 GiB de RAM (7.964 MB), 20 GiB**
  de disco en /data (16 GiB libres), Linux 6.18.54-instabox.
- Tres procesos Python de un solo proceso cada uno (webhook 8080,
  API de agenda 8081 solo-local, web 8090) con `ThreadingHTTPServer`,
  más el gateway de Hermes con su MCP de agenda.
- Base de datos **SQLite** en un único fichero (141 citas, 448 eventos
  al medir). Escrituras de cita serializadas por transacción
  `BEGIN IMMEDIATE` + `busy_timeout` de 30 s.
- La máquina **se pausa a los 30 min sin uso** (plan gratuito): estas
  cifras son con la máquina despierta y caliente.

## Latencias (ms)

| Medición | n | p50 | p95 | máx | Códigos |
|---|---|---|---|---|---|
| GET /salud (API agenda) | 50 | 0,3 | 0,7 | 7,4 | 200 ×50 |
| GET /salud (web) | 50 | 0,2 | 0,3 | 0,7 | 200 ×50 |
| GET /api/disponibilidad (web→API) | 30 | 2,7 | 4,8 | 5,0 | 200 ×30 |
| POST /citas crear (API, con guarda) | 12 | 1,3 | 1,6 | 4,6 | 201 ×12 (canceladas 12/12) |
| Ráfaga: 20× GET disponibilidad a la vez | 20 | 43,7 | 1.032,9 | 1.035,0 | 200 ×20 |
| Ráfaga: 5× POST al MISMO hueco a la vez | 5 | 9,3 | 10,5 | 10,5 | **1× 201, 4× 409** |

Lectura honesta: en serie, todo responde en 1–5 ms. En la ráfaga de 20
lecturas simultáneas no hay errores, pero la cola se estira hasta ~1 s
en el percentil 95: es el coste de dos servidores Python de un proceso
(hilo por petición, GIL) encadenados — la web llama a la API por HTTP —
más las lecturas SQLite. La ráfaga de escritura al mismo hueco se
resuelve en ~10 ms con exactamente una ganadora.

## Índices: antes / después (EXPLAIN QUERY PLAN, medido)

Consulta caliente 1 — citas confirmadas de un día (la guarda anti-solape):

- Antes: `SEARCH citas USING INDEX idx_citas_fecha (fecha=?)`.
- Después: `SEARCH citas USING INDEX idx_citas_negocio_fecha_estado
  (negocio_id=? AND fecha=? AND estado=?)`.

Consulta caliente 2 — embudo de eventos del mes (área profesional):

- Antes: `SCAN eventos` completo + `USE TEMP B-TREE FOR GROUP BY`.
- Después: `SEARCH eventos USING COVERING INDEX idx_eventos_negocio_tipo
  (negocio_id=?)` — sin barrido completo ni ordenación temporal.

Índices creados por la migración aditiva de la Fase 2:
`idx_citas_negocio_fecha_estado`, `idx_citas_token_hash`,
`idx_eventos_negocio_tipo`, `idx_lista_espera_negocio`,
`idx_bandeja_negocio` (+ la PK de `claves_idempotencia`).

## Qué soporta HOY esta arquitectura (sin vender humo)

- **Un negocio con holgura enorme** y, con esta misma forma, decenas
  de negocios pequeños compartiendo máquina: el coste por petición es
  de milisegundos y el aislamiento por `negocio_id` está probado
  (batería `pruebas_fase2.py`, 22/22).
- El límite práctico cercano no es la agenda: es la **pausa de 30 min**
  del plan gratuito de InstaBox y que todo vive en **una sola máquina
  y un solo proceso por servicio**.

## Qué haría falta para escalar de verdad (NO afirmado como hecho)

1. Sacar la agenda de SQLite a un servidor de base de datos (p. ej.
   PostgreSQL) cuando haya escrituras concurrentes sostenidas de
   muchos negocios: SQLite admite un solo escritor a la vez (hoy se
   resuelve con transacciones cortas de ~1,3 ms; la ráfaga lo prueba).
2. Servir la API/web con más de un proceso/worker y un equilibrador,
   en máquinas que no se pausen (plan de pago o VPS propio).
3. Medir de nuevo a cada salto con este mismo script (y con carga
   sostenida, no solo ráfagas) antes de afirmar cualquier cifra.

**No se afirma que la infraestructura actual soporte millones de
usuarios**: la Orden Maestra lo prohíbe sin arquitectura, pruebas y
mediciones que lo demuestren, y lo medido aquí es lo que hay.
