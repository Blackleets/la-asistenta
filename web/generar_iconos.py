#!/usr/bin/env python3
"""Genera los iconos PWA de LA ASISTENTA desde un motivo propio dibujado
con PIL (sin dependencias externas): arco de ceja lavanda sobre carbón
índigo con destello verde suave. Salida en web/icons/.

El mismo motivo vive en vector en web/icon.svg (favicon y manifest).
"""
import math
import os

from PIL import Image, ImageDraw

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")
CARBON = (37, 37, 51, 255)        # #252533
LAVANDA = (197, 180, 242, 255)    # #C5B4F2
VERDE = (122, 183, 167, 255)      # #7AB7A7
SS = 4  # supermuestreo


def bezier(p0, p1, p2, p3, t):
    mt = 1 - t
    x = mt**3 * p0[0] + 3 * mt**2 * t * p1[0] + 3 * mt * t**2 * p2[0] + t**3 * p3[0]
    y = mt**3 * p0[1] + 3 * mt**2 * t * p1[1] + 3 * mt * t**2 * p2[1] + t**3 * p3[1]
    return x, y


def radio_en(t):
    """Grosor de la ceja: fina en la cola, llena en el cuerpo."""
    return 15 + 26 * math.sin(math.pi * min(1.0, t * 1.12)) ** 1.3 - 11 * max(0.0, t - 0.72) / 0.28


def dibujar_motivo(draw, escala, dx=0.0, dy=0.0):
    """Arco de ceja (curva cúbica con grosor variable) + destello."""
    p0 = (104, 298)
    p1 = (198, 204)
    p2 = (332, 194)
    p3 = (410, 270)
    pasos = 420
    for i in range(pasos + 1):
        t = i / pasos
        x, y = bezier(p0, p1, p2, p3, t)
        r = max(2.2, radio_en(t)) * escala
        cx, cy = (x * escala + dx), (y * escala + dy)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=LAVANDA)
    # Destello de 4 puntas (verde suave), arriba a la derecha de la ceja.
    cx, cy, s, q = 398 * escala + dx, 168 * escala + dy, 36 * escala, 9 * escala
    estrella = [
        (cx, cy - s), (cx + q, cy - q), (cx + s, cy), (cx + q, cy + q),
        (cx, cy + s), (cx - q, cy + q), (cx - s, cy), (cx - q, cy - q),
    ]
    draw.polygon(estrella, fill=VERDE)


def icono(tam, redondeado=True, escala_motivo=1.0):
    lienzo = 512 * SS
    img = Image.new("RGBA", (lienzo, lienzo), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if redondeado:
        d.rounded_rectangle([0, 0, lienzo - 1, lienzo - 1],
                            radius=int(lienzo * 0.225), fill=CARBON)
    else:
        d.rectangle([0, 0, lienzo - 1, lienzo - 1], fill=CARBON)
    esc = SS * escala_motivo
    off = (512 * SS - 512 * esc) / 2
    dibujar_motivo(d, esc, off, off)
    return img.resize((tam, tam), Image.LANCZOS)


def splash(ancho, alto):
    img = Image.new("RGBA", (ancho * 2, alto * 2), CARBON)
    d = ImageDraw.Draw(img)
    esc = (ancho * 2) * 0.36 / 512
    off_x = (ancho * 2 - 512 * esc) / 2
    off_y = (alto * 2 - 512 * esc) / 2 - alto * 0.12
    dibujar_motivo(d, esc, off_x, off_y)
    return img.resize((ancho, alto), Image.LANCZOS)


def main():
    os.makedirs(BASE, exist_ok=True)
    salidas = {
        "icon-192.png": icono(192),
        "icon-512.png": icono(512),
        "icon-maskable-512.png": icono(512, redondeado=False, escala_motivo=0.78),
        "apple-touch-icon.png": icono(180, redondeado=False),
        "splash-750x1334.png": splash(750, 1334),
        "splash-828x1792.png": splash(828, 1792),
        "splash-1170x2532.png": splash(1170, 2532),
        "splash-1179x2556.png": splash(1179, 2556),
        "splash-1290x2796.png": splash(1290, 2796),
    }
    for nombre, img in salidas.items():
        ruta = os.path.join(BASE, nombre)
        img.convert("RGB").save(ruta, optimize=True)
        print(nombre, img.size, os.path.getsize(ruta), "bytes")


if __name__ == "__main__":
    main()
