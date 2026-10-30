#!/usr/bin/env python3
# QA-B5 · MUSA Bloque B5 — una sola voz de titular (29/10/2026)
# Transformación determinista y auditada: cada sustitución exige
# coincidencia EXACTA y ÚNICA del texto de partida; si algo no
# coincide, el script muere sin escribir ningún fichero.
#
# Mapeo (voz canónica = la de Inicio: Montserrat; titulares de
# sección/hero en 800 con letter-spacing -.01em como #p-inicio
# .seccion-titulo; títulos de tarjeta en 700 como .salon-card h3):
#   index  .salon-titulo   Fraunces 28/600 lh1.12 → Montserrat 28/800 lh1.15 ls-.01em
#   index  .tarjeta h2     Fraunces 23/600        → Montserrat 23/700
#   index  .seccion-titulo Fraunces 23/600        → Montserrat 23/800 ls-.01em
#   index  .reco h3        Fraunces 23/600        → Montserrat 23/700
#   index  .confirmada h2  Fraunces 28/600        → Montserrat 28/800
#   index  .lounge-card h3 Fraunces 19/600        → Montserrat 19/700
#   index  .prod-card h3   Fraunces 19/600        → Montserrat 19/700
#   index  @font-face Fraunces normal → RETIRADO (la recta queda sin
#          uso; sobrevive solo la itálica para dos acentos de cita:
#          .salon-sub em —lema— y .resena p —reseñas literales—)
#   cita   header h1       Fraunces 28/600 lh1.12 → Montserrat 28/800 lh1.15 ls-.01em
#   cita   header h1 em    + font-style:normal (acento por color; la
#          Montserrat cargada no tiene itálica y no se fingen oblicuas)
#   cita   .tarjeta h2     Fraunces 23/600        → Montserrat 23/700
#   cita   .codigo         Fraunces 23/700        → Montserrat 23/800
#          (el código de la confirmación en index ya es Montserrat 800)
#   cita   @font-face Fraunces ×2 → RETIRADOS (sin ningún uso)
#   prof.  h1              Fraunces 28/600        → Montserrat 28/800 ls-.01em
#   prof.  @font-face Fraunces → RETIRADO (sin ningún uso)
#   sw.js  shell v23 → v24; EXTRAS deja de precachear fraunces-normal
import sys, pathlib

WEB = pathlib.Path(__file__).resolve().parent.parent
FF_NORMAL = "@font-face{font-family:'Fraunces';src:url('/fonts/fraunces-normal.woff2') format('woff2');font-weight:400 700;font-style:normal;font-display:swap}\n"
FF_ITALIC = "@font-face{font-family:'Fraunces';src:url('/fonts/fraunces-italic.woff2') format('woff2');font-weight:400 700;font-style:italic;font-display:swap}\n"

CAMBIOS = {
 'index.html': [
  (FF_NORMAL, ''),
  (".salon-titulo{font-family:'Fraunces',serif;font-size:28px;font-weight:600;line-height:1.12;color:var(--negro)}",
   ".salon-titulo{font-family:'Montserrat',sans-serif;font-size:28px;font-weight:800;line-height:1.15;letter-spacing:-.01em;color:var(--negro)}"),
  (".tarjeta h2{font-family:'Fraunces',serif;font-size:23px;font-weight:600;margin-bottom:8px;line-height:1.15}",
   ".tarjeta h2{font-family:'Montserrat',sans-serif;font-size:23px;font-weight:700;margin-bottom:8px;line-height:1.15}"),
  (".seccion-titulo{font-family:'Fraunces',serif;font-size:23px;font-weight:600;margin:26px 0 4px;line-height:1.15}",
   ".seccion-titulo{font-family:'Montserrat',sans-serif;font-size:23px;font-weight:800;margin:26px 0 4px;line-height:1.15;letter-spacing:-.01em}"),
  (".reco h3{font-family:'Fraunces',serif;font-size:23px;font-weight:600;margin:6px 0 4px;line-height:1.15}",
   ".reco h3{font-family:'Montserrat',sans-serif;font-size:23px;font-weight:700;margin:6px 0 4px;line-height:1.15}"),
  (".confirmada h2{font-family:'Fraunces',serif;font-size:28px;font-weight:600;margin-bottom:8px}",
   ".confirmada h2{font-family:'Montserrat',sans-serif;font-size:28px;font-weight:800;margin-bottom:8px}"),
  (".lounge-card h3{font-family:'Fraunces',serif;font-size:19px;font-weight:600}",
   ".lounge-card h3{font-family:'Montserrat',sans-serif;font-size:19px;font-weight:700}"),
  (".prod-card h3{font-family:'Fraunces',serif;font-size:19px;font-weight:600;line-height:1.15}",
   ".prod-card h3{font-family:'Montserrat',sans-serif;font-size:19px;font-weight:700;line-height:1.15}"),
 ],
 'cita.html': [
  (FF_NORMAL, ''),
  (FF_ITALIC, ''),
  ("header h1{font-family:'Fraunces',serif;font-weight:600;font-size:28px;line-height:1.12;margin-top:8px}",
   "header h1{font-family:'Montserrat',sans-serif;font-weight:800;font-size:28px;line-height:1.15;margin-top:8px;letter-spacing:-.01em}"),
  ("header h1 em{color:var(--violeta-claro)}",
   "header h1 em{color:var(--violeta-claro);font-style:normal}"),
  (".tarjeta h2{font-family:'Fraunces',serif;font-size:23px;font-weight:600;margin-bottom:8px}",
   ".tarjeta h2{font-family:'Montserrat',sans-serif;font-size:23px;font-weight:700;margin-bottom:8px}"),
  ("font-family:'Fraunces',serif;font-size:23px;font-weight:700;letter-spacing:.12em",
   "font-family:'Montserrat',sans-serif;font-size:23px;font-weight:800;letter-spacing:.12em"),
 ],
 'profesional.html': [
  (FF_NORMAL, ''),
  ("h1{font-family:'Fraunces',serif;font-size:28px;font-weight:600;line-height:1.15;margin:10px 0 4px}",
   "h1{font-family:'Montserrat',sans-serif;font-size:28px;font-weight:800;line-height:1.15;margin:10px 0 4px;letter-spacing:-.01em}"),
 ],
 'sw.js': [
  ("const CACHE = 'la-asistenta-shell-v23';", "const CACHE = 'la-asistenta-shell-v24';"),
  ("  '/fonts/fraunces-normal.woff2',\n", ''),
 ],
}

total = 0
for nombre, pares in CAMBIOS.items():
    ruta = WEB / nombre
    texto = ruta.read_text(encoding='utf-8')
    for antes, despues in pares:
        n = texto.count(antes)
        if n != 1:
            print(f'ERROR en {nombre}: {n} coincidencias (esperaba 1) de: {antes[:70]!r}')
            sys.exit(1)
        texto = texto.replace(antes, despues)
        total += 1
        print(f'{nombre}: {antes[:58]!r}… → {despues[:58]!r}…')
    ruta.write_text(texto, encoding='utf-8')
print(f'OK · {total} sustituciones aplicadas')
