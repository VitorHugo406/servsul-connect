# Merges the SPTrans "Relatório de passageiros" (portal de transparência, .xlsx, column "Linha" = "270810 - A/B") into
# public/transit/SP.json: adds the bus lines OpenStreetMap lacks (ref 2708-10, Ida/Volta from the two terminals).
# Run after scripts/build-transit.mjs SP (which rewrites SP.json):  python3 scripts/merge-sptrans.py <arquivo.xlsx> public/transit/SP.json
import sys, re, json, openpyxl
xlsx, transit = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)
ws = wb.worksheets[0]
SMALL = {'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o'}
KEEP = {'CPTM', 'USP', 'UNIFESP', 'SESC', 'FMU', 'AACD', 'CEU', 'II', 'III', 'IV', 'BNH', 'COHAB', 'CDHU', 'ETEC', 'SENAC', 'SESI'}
def tc(s):
    out = []
    for i, w in enumerate(s.split()):
        if w in KEEP: out.append(w)
        elif w.lower() in SMALL and i: out.append(w.lower())
        else: out.append(w[:1] + w[1:].lower())
    return ' '.join(out)
lines = {}
for row in ws.iter_rows(min_row=5, values_only=True):
    v = row[3]
    if not v or ' - ' not in str(v): continue
    code, name = str(v).split(' - ', 1)
    code = code.strip().upper()
    m = re.match(r'^([0-9A-Z]{4})([0-9]{2})$', code)
    if not m: continue
    ref = f'{m.group(1)}-{m.group(2)}'
    parts = [p.strip() for p in re.split(r'/| - ', name) if p.strip()]
    a, b = (tc(parts[0]), tc(parts[-1])) if len(parts) >= 2 else (tc(name.strip()), '')
    lines[ref] = (a, b)
print('sptrans', len(lines), '6034-10' in lines, lines.get('6034-10'))
d = json.load(open(transit))
norm = lambda s: re.sub('[^0-9A-Z]', '', s.upper())
have = {norm(l['r']): l for l in d['lines'] if l['k'] == 'bus'}
added = filled = 0
for ref, (a, b) in lines.items():
    l = have.get(norm(ref))
    if l:
        if not l.get('d') and a and b: l['d'] = [[a, b], [b, a]]; filled += 1
        continue
    o = {'k': 'bus', 'r': ref, 'n': f'{a} / {b}' if b else a}
    if a and b: o['d'] = [[a, b], [b, a]]
    d['lines'].append(o); added += 1
d['src'] = 'OpenStreetMap + SPTrans (relatório de passageiros, out/2026)'
json.dump(d, open(transit, 'w'), ensure_ascii=False, separators=(',', ':'))
print('adicionadas', added, 'completadas', filled, 'total', len(d['lines']))
