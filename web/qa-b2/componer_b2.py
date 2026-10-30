from PIL import Image, ImageDraw, ImageFont
import os
BASE = os.path.expanduser("~/workspace/la-asistenta/web")
a = Image.open(f"{BASE}/qa-b2/antes/resultado-completo.png").convert("RGB")
d = Image.open(f"{BASE}/qa-b2/despues/resultado-completo.png").convert("RGB")
ANCHO = 824
def escalar(img):
    if img.width == ANCHO: return img
    return img.resize((ANCHO, round(img.height * ANCHO / img.width)), Image.LANCZOS)
a, d = escalar(a), escalar(d)
BANDA = 64
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
dr.text((ANCHO + 30, 14), "DESPUÉS · B2", fill=(13, 13, 13), font=fuente)
for destino in (f"{BASE}/qa-b2/comparativa-resultado.png", f"{BASE}/icons/vista-b2-resultado.png"):
    lienzo.save(destino); print(destino, lienzo.size, os.path.getsize(destino))
