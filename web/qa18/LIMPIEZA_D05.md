# LIMPIEZA D-05 · Restos de prueba en la agenda del piloto (29/10/2026)

Cierre del abierto D-05 de QA18: la agenda de Ari Vivas Beauty
arrastraba citas y mensajes de nuestras propias QA/baterías.
Ejecutado con `agenda/limpiar_d05.py` (primero `--solo-informe`,
después la limpieza), siempre vía API para que queden los eventos
del embudo. Respaldo previo de la BD:
`backups/agenda.db.bak-20261029-d05` (copia en línea, 263 citas).

## Regla de identificación usada

Un registro es «de prueba» SOLO si el nombre de la clienta lleva
la marca de las baterías/QA: empieza por **«PRUEBA»** (cualquier
capitalización: `PRUEBA MECANICAS 2`, `PRUEBA PROFESIONAL`,
`Prueba Pasado`…) o por **«QA» + dígito** (`QA18 Hoy A`,
`QA18 Verif`…). Los teléfonos de las baterías (600111222,
611222333, 600123456, 600000000, +34600123456, +34600999888) se
usan como corroboración en este informe, **nunca como criterio
único**. Ante la duda, el registro no se toca y se lista abajo.

Acciones posibles según el modelo del sistema (nada se borra):
- cita de prueba aún «confirmada» → cancelarla (queda
  «cancelada»);
- mensaje de prueba «pendiente» en la bandeja de salida →
  «descartada» (estado terminal existente);
- citas de prueba en estados terminales (cumplida / no_show /
  cancelada) → son historial; no se tocan.

## Conteos antes / después (ejecución de la limpieza)

| | Antes | Después |
|---|---|---|
| Citas «cancelada» | 248 | 249 |
| Citas «confirmada» | 6 | 5 |
| Citas «cumplida» | 27 | 27 |
| Citas «no_show» | 3 | 3 |
| Bandeja «pendiente» | 6 | **0** |

Acciones aplicadas (todas respondieron 200):
- **Cita 282** «PRUEBA PROFESIONAL» (hoy 19:30, confirmada;
  residuo de una pasada de la batería web abortada por el
  rate-limit de acceso) → **cancelada**.
- **Bandeja 23, 24, 25, 28, 30, 31** (agradecimientos post-cita
  de «PRUEBA MECANICAS 2», tel. +34600123456) → **descartadas**.

## No tocados — ambiguos, para decisión del principal

Sin marca de prueba inequívoca; quedan exactamente como estaban:

| Cita | Nombre | Datos | Sospecha (no basta para tocar) |
|---|---|---|---|
| 3 | Lucía | whatsapp, sin tel., 02/11 10:00 Laminación | Creada el 27/10 22:02 en la ráfaga de las primeras pruebas del receptor (con 2 «Carmen» 21:34, 4 «Marta» 22:04 y 5 «Elena» 22:07) |
| 4 | Marta | whatsapp, sin tel., 02/11 10:00 Laminación | Misma ráfaga; comparte hueco con la 3, algo que la guarda anti-solape no permitiría hoy |
| 5 | Elena | whatsapp, sin tel., 02/11 11:30 Laminación | Misma ráfaga (27/10 22:07) |
| 73 | Arianna | web, tel. omitido, hoy 11:00 Ombré Brows Henna | Creada el 28/10 21:49; parece la propia Arianna probando su web |
| 74 | Arianna | web, tel. omitido, 30/10 19:45 Depilación rápida | Creada el 28/10 21:51, dos minutos tras la 73 |

(La cita 2 «Carmen», de la misma ráfaga del 27/10, ya estaba
cancelada y tampoco se ha tocado.)

## Verificación de cierre

Tras la limpieza y la última pasada de baterías (web 32/32 ·
guarda 8/8 · mecánicas 23/23 · fase2 22/22):

- Citas: {cancelada 253 · confirmada 5 · cumplida 27 · no_show
  5} — la diferencia con el «después» son las pasadas de
  verificación, que se auto-cierran en estados terminales.
- **Confirmadas vivas de prueba: 0.** Las 5 vivas son las
  ambiguas de la tabla.
- **«Hoy» del área profesional sin ninguna cita viva de
  prueba** (las de prueba de hoy están todas en estados
  terminales: cancelada / cumplida / no_show).
- **Bandeja de salida: 0 pendientes en total** (31 descartadas).
- Lista de espera sin tocar (atendida 2 · descartada 29): la
  anomalía única registrada en QA18 no se reabre — la limpieza
  no toca ese flujo.
