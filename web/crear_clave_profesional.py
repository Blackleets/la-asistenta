#!/usr/bin/env python3
"""Crea (solo si no existe) la clave del área profesional en el servidor.

La clave se genera y se escribe en /data/la-asistenta/web/profesional.env
(permisos 600). Este script NUNCA imprime el valor: solo el nombre de la
variable y la longitud, para verificar sin exponer el secreto."""
import os
import secrets
import sys

RUTA = "/data/la-asistenta/web/profesional.env"

if os.path.exists(RUTA):
    with open(RUTA, encoding="utf-8") as f:
        for linea in f:
            if linea.startswith("PROFESIONAL_CLAVE="):
                valor = linea.split("=", 1)[1].strip()
                print(f"YA EXISTIA: PROFESIONAL_CLAVE longitud {len(valor)} (no se toca)")
                sys.exit(0)
    print("El fichero existe pero sin la variable: no se toca")
    sys.exit(1)

clave = secrets.token_urlsafe(24)
with open(RUTA, "w", encoding="utf-8") as f:
    f.write("PROFESIONAL_CLAVE=" + clave + "\n")
os.chmod(RUTA, 0o600)
print(f"CREADA: PROFESIONAL_CLAVE longitud {len(clave)} en {RUTA} (0600)")
