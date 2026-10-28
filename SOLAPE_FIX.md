# Fix de solape de agenda — La Asistenta

**Fecha:** 2026-10-27 (noche) · **Origen:** limitación nº 1 de
`PRUEBAS_ROBUSTEZ.md` (las citas #3 y #4 quedaron confirmadas el lunes 2/11 a
las 10:00 porque nadie comprobaba el hueco antes de registrar).
**Estado: ✅ hueco cerrado y probado por el camino real.**

## Cambios

### 1. `agenda/mcp_agenda.py` — `registrar_cita` valida el hueco ANTES de escribir
- Antes del INSERT, consulta las citas `confirmada` de esa fecha y compara
  intervalos `[hora, hora+duración)`: hay solape si `inicio_nuevo < fin_existente`
  y `inicio_existente < fin_nuevo`. Los bordes que se tocan (empezar justo
  cuando termina otra) **no** cuentan como solape.
- Si hay solape: **no inserta nada** y devuelve un error de herramienta
  accionable. Ejemplo real devuelto en la prueba de protocolo:

  > «Conflicto de agenda: NO se registró la cita. El hueco del 2026-11-02 a
  > las 10:00 está ocupado por: cita #3 (Laminación de cejas de Lucía,
  > 10:00–11:05); cita #4 (Laminación de cejas de Marta, 10:00–11:05). La
  > agenda queda libre a partir de las 11:05. Explica el conflicto a la
  > clienta y ofrécele la alternativa libre más cercana…»

- Las citas `cancelada` no bloquean (la comprobación filtra por
  `estado = 'confirmada'`).
- La descripción de la herramienta `registrar_cita` documenta ahora esta
  validación para que el modelo sepa qué esperar.

### 2. `hermes-home/SOUL.md` — qué hacer ante un conflicto
Nuevo punto «Conflictos de agenda»: si `registrar_cita` devuelve conflicto,
no es un fallo técnico; La Asistenta lo explica con naturalidad («justo esa
hora ya está ocupada»), ofrece la alternativa libre más cercana (la hora en
que queda libre el hueco según el aviso, u otra anterior donde quepa) y **no
registra nada** hasta que la clienta elija la nueva hora y la confirme con
el flujo de siempre: nuevo resumen en una línea → su sí → `registrar_cita`.

### 3. `whatsapp/simular_solape.py` (nuevo)
Variante del simulador que recibe los mensajes por línea de comandos, para
encadenar turnos sobre la misma sesión adaptándolos a cada respuesta. No se
tocó `whatsapp/webhook.py` ni `whatsapp/simular.py`.

## Prueba de la lógica (protocolo JSON-RPC directo, sobre una COPIA de la BD)

Para no contaminar la agenda real, las pruebas de protocolo corrieron con
`AGENDA_DB=/tmp/agenda_test.db` (copia de `agenda.db`):

| Caso | Resultado |
|---|---|
| 2/11 10:00, Laminación 65 min (solape exacto con #3 y #4) | ❌ rechazado, error con ambas citas en conflicto y «libre a partir de las 11:05» |
| 2/11 10:30 (solape parcial) | ❌ rechazado |
| 2/11 09:30, 65 min (cruza por delante, termina 10:35) | ❌ rechazado |
| 2/11 11:05 (empieza justo al terminar la ocupada) | ✅ registrado (borde libre) |
| 29/10 17:30, hueco de la cita **cancelada** de Carmen | ✅ registrado (las canceladas no bloquean) |

La copia quedó con 5 filas: las 3 originales + solo los 2 registros
legítimos. Los 3 intentos en conflicto no crearon nada.

## Prueba por el camino real (webhook + simulador, sesión nueva, dry-run)

Clienta nueva: **Elena** (34666666666), sesión `wa-34666666666`, webhook en
`127.0.0.1:8080` sin credenciales (token e id vacíos en `.env`: dry-run
confirmado).

### (a) Pedir la hora ocupada — 2/11 10:00 Laminación
| Turno | Qué pasó | Latencia Hermes |
|---|---|---|
| 1 | Elena pide laminación el lunes 2/11 a las 10:00. La Asistenta comprueba la agenda antes de ofrecer el hueco y responde que las 10:00 «justo lo tengo ocupado ya, tengo dos citas a esa hora», ofreciendo **ese mismo lunes a las 11:05** (cuando queda libre) o la tarde. | 18,7 s (arranque de sesión) |
| 2 | Elena: «Sí, déjalo así» → La Asistenta presenta el resumen de las **11:05** y pide confirmación. **No registra todavía.** | 8,7 s |

Verificación SQL tras (a): **0 citas de Elena**; la agenda seguía con sus 3
filas originales intactas (#2 cancelada, #3 y #4 confirmadas).

### (b) Elegir la alternativa con el flujo completo
| Turno | Qué pasó | Latencia Hermes |
|---|---|---|
| 3 | Elena prefiere las **11:30** → La Asistenta presenta el nuevo resumen (Laminación, lunes 2/11, 11:30, 45 €, 65 min) y pregunta «¿Lo dejo así?». Sin registrar. | 9,4 s |
| 4 | Elena: «Sí, perfecto, déjalo confirmado» → llama a `registrar_cita`, la herramienta valida el hueco y registra: anuncia la **cita #5** confirmada. | 8,8 s |

## Verificación SQL final (agenda/agenda.db real)

```
2|Carmen|Diseño de cejas|2026-10-29|17:30|25|18.0|cancelada
3|Lucía|Laminación de cejas|2026-11-02|10:00|65|45.0|confirmada
4|Marta|Laminación de cejas|2026-11-02|10:00|65|45.0|confirmada
5|Elena|Laminación de cejas|2026-11-02|11:30|65|45.0|confirmada
```

Comprobación de solapes entre confirmadas (cálculo por intervalos):
- La cita nueva (#5 Elena, 11:30–12:35) **no solapa con ninguna**.
- El único par solapado que subsiste es **#3 × #4 (Lucía × Marta)**: es el
  dato histórico de prueba que originó esta tarea y se conserva a propósito
  como escenario; el fix impide que se creen solapes **nuevos**, no reescribe
  el historial.

## Honestidad sobre cómo se ejerció el rechazo

En la conversación real de Elena, el rechazo de las 10:00 llegó **antes** de
cualquier intento de registro: el modelo usó `consultar_citas` (el SOUL se lo
permite «si duda») y condujo la conversación a la alternativa sin llamar a
`registrar_cita` con la hora ocupada. Por tanto, el rechazo *duro* de la
herramienta quedó probado a nivel de protocolo (los 3 casos de la tabla,
contra la copia de la BD), no dentro de la conversación de Elena. La
garantía es la misma venga el intento de donde venga: el registro pasa
siempre por `registrar_cita`, y `registrar_cita` ya no escribe si el hueco
está ocupado — que era exactamente el hueco que permitió la doble reserva
de Lucía y Marta.

## Latencias observadas

- Protocolo MCP directo: instantáneo (sin Hermes).
- Camino real: primer turno de sesión nueva 18,7 s (arranque de Hermes +
  MCP); turnos siguientes 8,7–9,4 s. En línea con lo ya medido en H3.

## Notas operativas

- El webhook quedó escuchando en `http://127.0.0.1:8080/webhook` en modo
  dry-run (arrancado para esta prueba).
- Los datos de prueba previos (Carmen cancelada; Lucía y Marta el 2/11) no
  se tocaron, como pedía el encargo.
