#!/usr/bin/env bash
# activar-meta.sh — guarda la clave de Meta en la casa de La Asistenta.
#
# Pide la clave SIN eco (read -s), la escribe en web/meta.env con
# permisos 600 y comprueba que el probador visual se ha encendido.
# La clave nunca se imprime, nunca se registra en logs y no queda
# en el historial: se lee por stdin, no viaja como argumento.
#
# Variables de entorno SOLO para probar el propio guion sin tocar
# el fichero real (lo que hace Aragan al verificarlo):
#   META_ENV_DEST          destino alternativo del fichero
#   META_CAPACIDADES_URL   URL alternativa de comprobación

DESTINO="${META_ENV_DEST:-/data/la-asistenta/web/meta.env}"
URL_CAPACIDADES="${META_CAPACIDADES_URL:-http://127.0.0.1:8090/api/capacidades}"

echo "Esto guarda tu clave de Meta en la casa de La Asistenta (enciende el probador visual en la web)."
echo

# Lectura sin eco: la clave no se ve en pantalla mientras la pegas.
read -s -p "Pega tu clave de Meta y pulsa Enter: " CLAVE
echo

# La clave no contiene espacios: se quitan por si al pegar se coló alguno.
CLAVE="${CLAVE//[[:space:]]/}"

if [ -z "$CLAVE" ]; then
  echo "No has pegado ninguna clave, así que no he guardado nada."
  echo "Vuelve a ejecutar el guion cuando la tengas a mano."
  exit 1
fi

# Escritura en fichero privado: umask restrictiva y chmod 600.
umask 077
printf 'META_MODEL_API_KEY=%s\n' "$CLAVE" > "$DESTINO"
chmod 600 "$DESTINO"
unset CLAVE

echo "Clave guardada en su fichero privado."
echo "Comprobando que la web la ve…"

RESPUESTA="$(curl -s -m 15 "$URL_CAPACIDADES" 2>/dev/null || true)"
ESTADO="$(printf '%s' "$RESPUESTA" | python3 -c 'import sys, json
try:
    d = json.load(sys.stdin)
    print("true" if d.get("probador_visual_cejas", {}).get("disponible") else "false")
except Exception:
    print("error")' 2>/dev/null || echo error)"

case "$ESTADO" in
  true)
    echo "✅ ENCENDIDO: el probador visual de cejas ya está activo en la web de La Asistenta."
    ;;
  false)
    echo "Todavía NO se ha encendido. Revisa esto:"
    echo " · Que has pegado la clave completa, sin cortar el principio ni el final."
    echo " · Si la página de Meta ya no te deja ver la clave antigua, crea una"
    echo "   nueva en API keys (se muestra una sola vez) y repite este guion con esa."
    ;;
  *)
    echo "La clave está guardada, pero la web no ha respondido a la comprobación."
    echo "Puede estar dormida: abre la web de La Asistenta una vez y vuelve a"
    echo "ejecutar este guion para comprobarlo."
    ;;
esac

echo
echo "Ya está. Puedes cerrar esta consola; Aragan hace el resto."
