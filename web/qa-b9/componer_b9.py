from PIL import Image, ImageDraw, ImageFont
import os
BASE = os.path.expanduser("~/workspace/la-asistenta/web")
ANCHO = 824
BANDA = 64

def escalar(img):
    if img.width == ANCHO: return img
    return img.resize((ANCHO, round(img.height * ANCHO / img.width)), Image.LANCZOS)

def componer(antes_path, despues_path, etiqueta_d, destinos):
    a = escalar(Image.open(antes_path).convert("RGB"))
    d = escalar(Image.open(despues_path).convert("RGB"))
    alto = max(a.height, d.height) + BANDA
    lienzo = Image.new("RGB", (ANCHO * 2 + 6, alto), (255, 255, 255))
    lienzo.paste(a, (0, BANDA)); lienzo.paste(d, (ANCHO + 6, BANDA))
    dr = ImageDraw.Draw(lienzo)
    dr.rectangle([ANCHO, 0, ANCHO + 6, alto], fill=(105, 80, 243))
    fuente = None
    for ruta in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",):
        if os.path.exists(ruta): fuente = ImageFont.truetype(ruta, 34); break
    if fuente is None: fuente = ImageFont.load_default()
    dr.text((24, 14), "ANTES", fill=(13, 13, 13), font=fuente)
    dr.text((ANCHO + 30, 14), etiqueta_d, fill=(13, 13, 13), font=fuente)
    for destino in destinos:
        lienzo.save(destino); print(destino, lienzo.size, os.path.getsize(destino))

componer(f"{BASE}/qa-b9/antes/foto-bloque.png", f"{BASE}/qa-b9/despues/foto-bloque.png",
         "DESPUÉS · B9",
         [f"{BASE}/qa-b9/comparativa-foto.png", f"{BASE}/icons/vista-b9-foto.png"])
componer(f"{BASE}/qa-b9/antes/resultado-completo.png", f"{BASE}/qa-b9/despues/resultado-completo.png",
         "DESPUÉS · B9 (sin cambios: verificación)",
         [f"{BASE}/qa-b9/comparativa-resultado.png", f"{BASE}/icons/vista-b9-resultado.png"])
