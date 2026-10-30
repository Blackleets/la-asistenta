#!/usr/bin/env python3
"""QA-B4 · Transformación del Bloque B4 (tokens y escala) sobre los tres
ficheros HTML + sw.js, en local. Determinista y auditada: imprime cada
cambio y aborta si cualquier conteo no coincide con el inventario."""
import re, hashlib, sys

BASE = '/home/hatch/workspace/la-asistenta/web/'
LOG = []
def log(*a): LOG.append(' '.join(str(x) for x in a))
def fail(msg):
    print('ABORTA:', msg); sys.exit(1)

def balanced_block(txt, start):
    """Devuelve el bloque {…} equilibrado que empieza en el índice start (la '{')."""
    assert txt[start] == '{'
    depth = 0
    for i in range(start, len(txt)):
        if txt[i] == '{': depth += 1
        elif txt[i] == '}':
            depth -= 1
            if depth == 0: return txt[start:i+1]
    fail('bloque sin cerrar')

# ============ 1 · TOKENS: bloque canónico ==============
idx = open(BASE + 'index.html', encoding='utf-8').read()
m = re.search(r':root\s*(?=\{)', idx)
root_ini = idx.index('{', m.start())
root_idx = ':root' + balanced_block(idx, root_ini)
assert '--gris:#626878' in root_idx and '--positivo:#1d7e00' in root_idx, 'B1 no está en el bloque canónico'
assert '--sombra:0 1px 3px rgba(13,13,13,.05)' in root_idx

ESCALA = """  /* Escala tipográfica cerrada (MUSA B4, 29/10): 11 micro · 12,5 apoyo ·
     13,5 cuerpo · 15 acción · 19 destacado · 23 titular · 28 hero.
     Excepción funcional: inputs y textarea a 16 (iOS hace zoom al
     enfocar por debajo de 16). Peso 800: solo titulares y números
     display; precios, estados y llamadas a la acción van a 700. */
"""
root_canon = root_idx[:-1].rstrip() + '\n' + ESCALA + '}'
idx = idx.replace(root_idx, root_canon, 1)
log('TOKENS index: bloque canónico + comentario de escala')

files = {}
for nombre in ('cita.html', 'profesional.html'):
    t = open(BASE + nombre, encoding='utf-8').read()
    m = re.search(r':root\s*(?=\{)', t)
    ini = t.index('{', m.start())
    viejo = ':root' + balanced_block(t, ini)
    assert '--sombra:0 10px 30px rgba(13,13,13,.08)' in viejo, f'{nombre}: sombra inesperada'
    t = t.replace(viejo, root_canon, 1)
    files[nombre] = t
    log(f'TOKENS {nombre}: :root sustituido por el canónico (sombra .08 → .05 susurro, entran ease y escala)')
files['index.html'] = idx

# ============ 2 · ESCALA TIPOGRÁFICA (solo dentro de <style>) ==============
MAP = {'10':'11','11':'11','11.5':'11','12':'12.5','12.5':'12.5','13':'13.5',
       '13.5':'13.5','14':'13.5','14.5':'15','15':'15','15.5':'15','16':'15',
       '16.5':'15','17':'19','18':'19','19':'19','20':'19','21':'23','22':'23',
       '23':'23','24':'23','25':'23','27':'28','29':'28','31':'28'}
EXCEP = {  # (fichero, selector normalizado, valor actual) -> peldaño
  ('index.html', '.reco .datos', '14'): '15',
  ('cita.html', '.hueco', '14'): '15',
  ('cita.html', '.codigo', '21'): '23',        # = genérico, se deja constancia
  ('profesional.html', '.cita .hora', '21'): '19',
}
def norm_sel(s): return ' '.join(s.split())

def pasar_estilos(nombre, txt):
    out, pos = [], 0
    for sm in re.finditer(r'<style[^>]*>.*?</style>', txt, re.S):
        out.append(txt[pos:sm.start()])
        seg = sm.group(0)
        def cambia_regla(rm):
            sel_raw, body = rm.group(1), rm.group(2)
            sels = [norm_sel(s) for s in sel_raw.split(',')]
            if any(('input' in s or 'textarea' in s) for s in sels):
                if re.search(r'font-size\s*:', body): log(f'  PROTEGIDA (inputs) {nombre}: {sels}')
                return rm.group(0)
            def cambia_fs(fm):
                val = fm.group(2)
                destino = None
                for s in sels:
                    destino = EXCEP.get((nombre, s, val), destino)
                nuevo = destino if destino is not None else MAP.get(val)
                if nuevo is None: fail(f'{nombre}: font-size fuera de inventario: {val}px en {sels}')
                if nuevo != val: log(f'  FS {nombre}: {sels} {val} → {nuevo}')
                return fm.group(1) + nuevo + 'px'
            body2 = re.sub(r'(font-size\s*:\s*)([0-9.]+)px', cambia_fs, body)
            return sel_raw + '{' + body2 + '}'
        seg2 = re.sub(r'([^{}]+)\{([^{}]*)\}', cambia_regla, seg)
        out.append(seg2)
        pos = sm.end()
    out.append(txt[pos:])
    return ''.join(out)

for nombre in files:
    files[nombre] = pasar_estilos(nombre, files[nombre])
log('ESCALA aplicada dentro de <style> en los 3 ficheros')

# font-size fuera de <style>: dos puntos concretos
t = files['index.html']
assert t.count('<h2 style="font-size:18px">Alternativa</h2>') == 1
files['index.html'] = t.replace('<h2 style="font-size:18px">Alternativa</h2>',
                                '<h2 style="font-size:19px">Alternativa</h2>', 1)
log('FS index (inline): h2 «Alternativa» 18 → 19')
t = files['profesional.html']
assert t.count('font-size:17px;font-weight:800') == 2
files['profesional.html'] = t.replace('font-size:17px;font-weight:800',
                                      'font-size:19px;font-weight:800')
log('FS profesional (plantillas JS): h2 de Por avisar 17 → 19 ×2 (titulares: el 800 se queda)')

# ============ 3 · PESO 800 → 700 por rol ==============
DEMOTE = {
 'index.html': {'.fila-servicio .fs-precio','.salon-barra .sb-btn','.salon-card .rc-cta-txt',
   '.reco-card .rc-cta-txt','.servicio-card .sc-precio','.servicio-card .sc-cta','.reco .etiqueta',
   '.cal-dow','.cal-dia.sel','.hora-fila.sel .hf-hora','.pasos-ind .pi','.resumen-mini .rm-etq',
   '.resumen-mini .rm-precio','.tu-cita .tc-etq','.tu-cita .tc-total','.video-card .vc-tag',
   '.resena .r-nombre','.chip-estado','.mod-card .m-nombre'},
 'cita.html': {'.pastilla'},
 'profesional.html': {'.cita .hora','.cita-linea .h','.dia .fila .h','.rejilla .celda b','.serv-fila .p'},
}
KEEP = {
 'index.html': {'#p-inicio .seccion-titulo','.marca','.codigo-grande','.cal-mes','.estado-honesto h3'},
 'cita.html': set(),
 'profesional.html': {'.marca .nombre','.tarjeta h2','.resumen .dato b','.dia h3'},
}
def pasar_pesos(nombre, txt):
    conteo = [0]
    def en_estilo(sm):
        seg = sm.group(0)
        def cambia(rm):
            sel_raw, body = rm.group(1), rm.group(2)
            if not re.search(r'font-weight\s*:\s*800', body): return rm.group(0)
            sels = {norm_sel(s) for s in sel_raw.split(',')}
            if sels & KEEP[nombre] and sels & DEMOTE[nombre]:
                fail(f'{nombre}: regla mixta keep/demote: {sels}')
            if sels & DEMOTE[nombre]:
                conteo[0] += 1
                log(f'  W800→700 {nombre}: {sorted(sels & DEMOTE[nombre])}')
                body = re.sub(r'(font-weight\s*:\s*)800', r'\g<1>700', body)
            return sel_raw + '{' + body + '}'
        return re.sub(r'([^{}]+)\{([^{}]*)\}', cambia, seg)
    txt = re.sub(r'<style[^>]*>.*?</style>', en_estilo, txt, flags=re.S)
    log(f'PESOS {nombre}: {conteo[0]} reglas reclasificadas a 700')
    return txt
for nombre in files:
    files[nombre] = pasar_pesos(nombre, files[nombre])

# ============ 4 · BOTONES ==============
t = files['index.html']
n = t.count('btn-lavanda'); assert n == 6, f'index btn-lavanda: {n}'
t = t.replace('btn-lavanda', 'btn-secundario'); log('BTN index: .btn-lavanda → .btn-secundario ×6 (blanco con borde: el nombre ya dice lo que pinta)')
n = t.count('btn-verde'); assert n == 3, f'index btn-verde: {n}'
t = t.replace('btn-verde', 'btn-whatsapp'); log('BTN index: .btn-verde → .btn-whatsapp ×3 (solo enlaces wa.me)')
def quita_reglas(txt, selectores, nombre):
    for sel in selectores:
        pat = re.compile(re.escape(sel) + r'\{[^{}]*\}')
        txt, k = pat.subn('', txt)
        assert k == 1, f'{nombre}: reglas de {sel}: {k}'
        log(f'BTN {nombre}: retirada la regla muerta {sel}')
    return txt
t = quita_reglas(t, ['.btn-videos svg', '.btn-videos:active', '.btn-videos'], 'index')
log('BTN index: .btn-videos era CSS muerto (0 usos en markup/JS) — 3 reglas fuera')
files['index.html'] = t

t = files['cita.html']
n = t.count('btn-lavanda'); assert n == 2, f'cita btn-lavanda: {n}'
t = t.replace('btn-lavanda', 'btn-violeta'); log('BTN cita: .btn-lavanda → .btn-violeta ×2 (pintaba violeta; definición idéntica a la del panel)')
assert t.count('class="btn btn-verde" id="btn-reagendar"') == 1
t = t.replace('class="btn btn-verde" id="btn-reagendar"', 'class="btn btn-primario" id="btn-reagendar"', 1)
log('BTN cita: «Mover mi cita» (acción principal) sale del verde → .btn-primario (negro)')
assert t.count('btn-verde') == 1, 'cita: btn-verde debería quedar solo en su definición'
t = quita_reglas(t, ['.btn-verde'], 'cita')
assert 'btn-verde' not in t
files['cita.html'] = t

t = files['profesional.html']
n = t.count('btn-verde'); assert n == 4, f'profesional btn-verde: {n}'
t = t.replace('btn-verde', 'btn-whatsapp'); log('BTN profesional: .btn-verde → .btn-whatsapp ×4 (solo enlaces wa.me)')
files['profesional.html'] = t

# ============ 5 · SW ==============
sw = open(BASE + 'sw.js', encoding='utf-8').read()
assert sw.count('la-asistenta-shell-v22') == 1
sw = sw.replace('la-asistenta-shell-v22', 'la-asistenta-shell-v23')
log('SW: la-asistenta-shell-v22 → v23')

# ============ escritura y comprobaciones finales ==============
for nombre, t in files.items():
    open(BASE + nombre, 'w', encoding='utf-8').write(t)
open(BASE + 'sw.js', 'w', encoding='utf-8').write(sw)

raices = set()
for nombre in ('index.html', 'cita.html', 'profesional.html'):
    t = open(BASE + nombre, encoding='utf-8').read()
    m = re.search(r':root\s*(?=\{)', t)
    bloque = ':root' + balanced_block(t, t.index('{', m.start()))
    raices.add(hashlib.sha256(bloque.encode()).hexdigest())
    assert 'btn-lavanda' not in t and 'btn-verde' not in t, f'{nombre}: queda un nombre viejo'
assert len(raices) == 1, f'los :root no son idénticos: {raices}'
log('VERIFICADO: los tres :root son byte-idénticos (SHA ' + list(raices)[0][:12] + '…)')
print('\n'.join(LOG))
print(f'TOTAL cambios registrados: {len(LOG)}')
