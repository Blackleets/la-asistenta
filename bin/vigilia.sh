#!/bin/bash
# La Asistenta · vigilia anti-sueño (plan aprobado por Lee, 29/10/2026).
#
# La máquina InstaBox `la-asistenta` se pausa a los 30 min sin uso y una
# visita web NO la despierta. Este script la despierta por API y comprueba
# que los tres servicios responden en /salud:
#   8080 webhook · 8081 agenda · 8090 web
# Si algo falla tras el despertar, reintenta UNA sola vez (sin bucles).
#
# Uso: bash ~/workspace/la-asistenta/bin/vigilia.sh
# Deja UNA línea por ejecución en run-logs/vigilia.log y sale con
# código 0 si todo está sano, 1 si algo quedó caído tras el reintento.
set -u

BASE="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$BASE/run-logs/vigilia.log"
HELPER="$HOME/workspace/custom-connectors/custom.instabox/bin/instabox_api.py"
MID="m_agqyfjnmnvcrrnfraerzrpu5ye"
SUFIJO="agqyfjnmnvcrrnfraerzrpu5ye"
mkdir -p "$BASE/run-logs"

TS="$(TZ=Europe/Madrid date '+%Y-%m-%dT%H:%M:%S%z')"
INICIO=$(date +%s)

estado_maquina() {
  python3 "$HELPER" machine "$MID" 2>/dev/null \
    | python3 -c 'import json,sys
try:
    print(json.load(sys.stdin).get("state","?"))
except Exception:
    print("?")'
}

# Chequeo interno de los tres /salud (localhost dentro de la máquina).
# Imprime líneas "8080=200" etc.; vacío si el exec falla.
chequeo_interno() {
  python3 "$HELPER" exec "$MID" 'for p in 8080 8081 8090; do printf "%s=" $p; curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:$p/salud; echo; done' 2>/dev/null \
    | python3 -c 'import json,sys
try:
    d=json.load(sys.stdin)
    print(d.get("stdout","") or "")
except Exception:
    pass'
}

codigo_http() { # $1=url
  curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$1" 2>/dev/null || echo "000"
}

valor() { # $1=salida chequeo, $2=puerto -> código o "?"
  echo "$1" | grep -E "^$2=" | tail -1 | cut -d= -f2
}

despertar_y_esperar() {
  python3 "$HELPER" wake "$MID" >/dev/null 2>&1
  local i est
  for i in $(seq 1 18); do
    est=$(estado_maquina)
    [ "$est" = "running" ] && return 0
    sleep 10
  done
  [ "$(estado_maquina)" = "running" ]
}

EST_INICIAL=$(estado_maquina)
WAKE="omitido"
if [ "$EST_INICIAL" != "running" ]; then
  if despertar_y_esperar; then WAKE="ok"; else WAKE="fallo"; fi
fi

INTENTO=1
while true; do
  INTERNO=$(chequeo_interno)
  C8080=$(valor "$INTERNO" 8080); C8080=${C8080:-sin-respuesta}
  C8081=$(valor "$INTERNO" 8081); C8081=${C8081:-sin-respuesta}
  C8090=$(valor "$INTERNO" 8090); C8090=${C8090:-sin-respuesta}
  E8080=$(codigo_http "https://8080-$SUFIJO.instabox.tech/salud")
  E8090=$(codigo_http "https://8090-$SUFIJO.instabox.tech/salud")
  if [ "$C8080" = "200" ] && [ "$C8081" = "200" ] && [ "$C8090" = "200" ] \
     && [ "$E8080" = "200" ] && [ "$E8090" = "200" ]; then
    RESULTADO="OK"; RC=0; break
  fi
  if [ "$INTENTO" -ge 2 ]; then
    RESULTADO="FALLO"; RC=1; break
  fi
  INTENTO=2
  sleep 20
  # Segundo y último intento: si la máquina volvió a caer, se despierta otra vez.
  if [ "$(estado_maquina)" != "running" ]; then
    if despertar_y_esperar; then WAKE="${WAKE}+ok"; else WAKE="${WAKE}+fallo"; fi
  fi
done

DUR=$(( $(date +%s) - INICIO ))
echo "$TS inicial=$EST_INICIAL wake=$WAKE intento=$INTENTO 8080=$C8080 8081=$C8081 8090=$C8090 ext8080=$E8080 ext8090=$E8090 resultado=$RESULTADO duracion=${DUR}s" >> "$LOG"
echo "vigilia: inicial=$EST_INICIAL wake=$WAKE 8080=$C8080 8081=$C8081 8090=$C8090 ext8080=$E8080 ext8090=$E8090 resultado=$RESULTADO (${DUR}s)"
exit $RC
