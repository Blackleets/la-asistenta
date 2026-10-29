#!/bin/bash
# La Asistenta · arranque idempotente de los servicios en la máquina InstaBox.
# La máquina se pausa a los 30 min sin uso: tras despertarla, este script
# relanza webhook, API de agenda y web de la clienta, y verifica que responden.
# Uso: bash /data/la-asistenta/arrancar.sh
set -u
BASE="/data/la-asistenta"
RUN="$BASE/run-logs"
mkdir -p "$RUN"
export HERMES_HOME="$BASE/hermes-home"
export HERMES_RUNTIME_DIR="$BASE/hermes-runtime"
export HERMES_BIN="$HOME/.local/bin/hermes"
# Token de la API de agenda SOLO desde agenda.env (0600, fuera del
# repo: hallazgo D7/Fase 2). Los servicios ya no llevan ningún literal.
if [ -f "$BASE/agenda/agenda.env" ]; then
  set -a; . "$BASE/agenda/agenda.env"; set +a
fi

levantar() {
  # $1 nombre, $2 puerto, $3 comando...
  local nombre="$1" puerto="$2"; shift 2
  if curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$puerto/salud"; then
    echo "$nombre: ya estaba en marcha (puerto $puerto)"
    return 0
  fi
  setsid nohup "$@" > "$RUN/$nombre.out" 2>&1 &
  echo $! > "$RUN/$nombre.pid"
  for i in $(seq 1 20); do
    if curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$puerto/salud"; then
      echo "$nombre: OK (puerto $puerto, pid $(cat "$RUN/$nombre.pid"))"
      return 0
    fi
    sleep 0.5
  done
  echo "$nombre: NO responde en el puerto $puerto — mira $RUN/$nombre.out"
  return 1
}

levantar webhook 8080 python3 "$BASE/whatsapp/webhook.py"
levantar agenda-api 8081 python3 "$BASE/agenda/agenda_api.py"
levantar web-clienta 8090 python3 "$BASE/web/web_server.py"
