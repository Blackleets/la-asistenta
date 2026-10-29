# QA18 · Barrido completo de organización y matriz funcional (29/10/2026)

Recorrido completo a 412×915 (Chromium en la máquina, CDP, capturas
revisadas desde los bytes): clienta (Inicio, Explorar, Salón,
reserva E2E, enlace mágico, análisis, Probador, Perfil), profesional
(Hoy, Agenda, Por avisar, bandeja, Mi negocio) y transversal
(desborde, textos cortados, consola, offline). Baterías antes y
después: web 32/32 · guarda 8/8 · mecánicas 20/20 · fase2 22/22.
Fases: A1/A2/A3 (recorrido visual), B (matriz funcional), C
(verificación de arreglos). Scripts y logs: `qa18_a*.mjs`,
`qa18_b.mjs`, `qa18_c.mjs`, `log-*.json` en este directorio.

## Defectos corregidos en la pasada (SW v15 → v16)

- **D-04 · ALTA · Salón → barra «Reservar ahora» rota en posición.**
  La barra quedaba anclada al final del documento y fuera de la
  pantalla (medido: left 206 / right 558 en un viewport de 412;
  botón casi entero fuera; única pantalla con desborde horizontal,
  scrollW 558). Causa: la animación genérica «sube» terminaba en
  `transform:none` con fill `both`, anulando para siempre el
  `translateX(-50%)` del centrado; y la barra vivía dentro de la
  pantalla del salón (ancestro con transform = bloque contenedor
  del `position:fixed`). Arreglo: la barra vive ahora a nivel
  global (como la navegación) y su entrada usa keyframes propios
  `subeBarra` que conservan el centrado. Verificado en la fase C:
  barra y botón enteros dentro del viewport, scrollW 412
  (`vista-barrido-salon-barra.png`).
- **D-01 · MEDIA · Pie global con el lema de otro módulo.** El pie
  de la app decía «Descubre cómo te quedaría antes de comprarlo»
  (lema del probador de moda, dormido) en la app de cejas. Arreglo:
  lema de marca «Tu belleza, mejor entendida» (el mismo de
  cita.html y de la ficha del salón). Verificado en la fase C.
- **D-02 · MEDIA · cita.html no reflejaba el estado real.** La
  pastilla decía siempre «CONFIRMADA» y las acciones de preparar,
  reagendar y cancelar se ofrecían también sobre citas ya
  cumplidas o no realizadas. Arreglo de presentación: la pastilla
  pinta el estado real (CONFIRMADA/CUMPLIDA/NO REALIZADA), las
  acciones solo se muestran con la cita viva, y una cita ya
  realizada muestra el aviso «Esta cita ya se realizó…».
  Verificado en la fase C con una cita marcada cumplida desde el
  área profesional (`vista-barrido-cita-cumplida.png`).
- **D-03 · BAJA · «← Volver» de la próxima apertura siempre iba a
  Inicio** aunque se viniera de Explorar o del Probador. Arreglo:
  se anota la pantalla de origen y se vuelve a ella; el botón pasa
  a decir «← Volver». Verificado en la fase C desde los tres
  orígenes.
- **D-06 · BAJA · Pastilla «Próximamente» en posición variable**
  entre las tarjetas hermanas de «Más en camino» (al lado del
  título o debajo según su longitud). Arreglo CSS: la pastilla va
  siempre en su propia línea bajo el nombre. Verificado en captura.
- **D-09 · MICRO · Mensaje de enlace no válido en minúscula**
  inicial en la web («este enlace no corresponde…»). Arreglo:
  mayúscula en los dos sitios de `web_server.py`.

## Abiertos (documentados, sin parchear a ciegas)

> **CIERRE (29/10/2026, §45 de ESTADO_PROYECTO.md): D-02b y
> D-05 están CERRADOS.** D-02b: guarda simétrica en el cancelar
> de la agenda (API por id y por enlace + MCP) — una cumplida
> responde 409 «Esta cita ya se realizó» sin cambiar de estado;
> 3 pruebas nuevas en la batería de mecánicas (23/23). D-05:
> limpieza ejecutada con `agenda/limpiar_d05.py` — 1 cita de
> prueba cancelada (id 282) y 6 mensajes de la bandeja
> descartados; bandeja a 0 pendientes y «Hoy» sin citas vivas
> de prueba; 5 citas ambiguas listadas SIN tocar en
> `LIMPIEZA_D05.md` (mismo directorio). El texto original de
> ambos abiertos se conserva debajo como registro.

- **D-02b · MEDIA-ALTA · La agenda permite CANCELAR una cita ya
  cumplida desde su enlace mágico.** La guarda sí protege
  reagendar («solo se puede reagendar una cita confirmada») pero
  no cancelar. Reproducción exacta: crear una cita → la
  profesional la marca cumplida → abrir `/cita/<token>` → «Quiero
  cancelar mi cita» → «Sí, cancelar» → la cita queda `cancelada`
  en la agenda en vez de `cumplida` (evidencia QA18: cita AS-AAHW).
  Es un defecto de la AGENDA, fuera del alcance de presentación de
  esta pasada. Recomendación: guarda simétrica en el cancelar de
  la agenda («solo se puede cancelar una cita confirmada») + una
  prueba en la batería de mecánicas. La mitad visible del problema
  ya está cerrada por D-02: la página ya no ofrece cancelar una
  cita cumplida.
- **D-05 · MEDIA · Operativo: restos de pruebas en la agenda del
  piloto.** El «Hoy» del área profesional mostraba 25 citas de
  pruebas de las QA anteriores (y la bandeja, mensajes de prueba).
  No es un defecto de código. Recomendación: limpieza de la agenda
  antes del ensayo del 02/11 (decisión del principal; son datos
  del negocio). Las citas de esta QA18 llevan nombre «QA18 …» y
  quedaron en estados finales correctos; los bloqueos de prueba,
  cancelados.

## Anomalía no reproducible (transparencia)

- **Lista de espera, fase A3:** en una única ejecución, la interfaz
  mostró la confirmación del alta sin que quedara rastro en los
  logs ni en la base de datos (la fase B corría en paralelo sobre
  la misma agenda). El alta por API y por web directa persistió
  correctamente en dos sondeos, y la RE-EJECUCIÓN completa de la
  fase C (alta desde la interfaz → entrada id 28 `esperando` →
  liberar hueco → `por_avisar` → visible en el panel con «¡Hueco
  liberado!» → descartada) salió íntegra. Se deja constancia de la
  anomalía; el veredicto vigente es FUNCIONA con la evidencia de
  la re-ejecución.

## Verificado SIN defecto (evidencia en los logs)

- Cero errores JS de consola en todo el recorrido (solo los
  400/401/404/409/429 esperados de las propias pruebas y el
  `ERR_INTERNET_DISCONNECTED` del modo sin conexión).
- Cero textos cortados en ninguna pantalla; desborde horizontal
  solo en p-salon por D-04 (corregido).
- Modal de TikTok: abre con el vídeo correcto, título y enlace
  oficial; al cerrar, el marco se vacía.
- Buscador sin resultados: mensaje claro y cero tarjetas.
- Offline: la portada guardada se muestra con su aviso.
- Compartir, «Añadir al calendario» (.ics con horas correctas) y
  el botón de instalar (oculto sin `beforeinstallprompt`) se
  comportan como deben; en headless el Web Share no da feedback
  visual, en el móvil sí (con copia al portapapeles de reserva).
