// Builds public/transit/<UF>.json (bus / train / metro / VLT lines of each Brazilian state) from OpenStreetMap
// (Overpass). The chat's "Ônibus/trem" search reads these static files — instant, no live Overpass call (live queries
// took 16 s – 1 min+ or timed out). Run occasionally to refresh: node scripts/build-transit.mjs [UF ...]
import { writeFileSync, mkdirSync, existsSync, readFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const UFS = process.argv.slice(2).length ? process.argv.slice(2) : 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const MIRRORS = ['https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const KIND = { bus: 'bus', trolleybus: 'bus', minibus: 'bus', coach: 'bus', train: 'train', subway: 'metro', monorail: 'metro', light_rail: 'tram', tram: 'tram' };
const norm = (s) => s.toUpperCase().replace(/[^0-9A-Z]/g, '');
const terminals = (t) => {
  if (t.from || t.to) return [t.from || '', t.to || ''];
  const m = /:\s*(.+?)\s*(?:=>|→|->|⇒)\s*(.+)$/.exec(t.name || '') || /^(.+?)\s*(?:=>|→|->|⇒)\s*(.+)$/.exec(t.name || '');
  return m ? [m[1].trim(), m[2].trim()] : ['', ''];
};
const cleanName = (t, ref) => {
  let n = (t.name || '').replace(/:\s*.+$/, '').replace(/\s*(=>|→|->|⇒).*$/, '').trim().replace(/^(Ônibus|Onibus|Bus)\s+/i, '').trim();
  if (ref && norm(n) === norm(ref)) n = '';
  if (ref && n.toUpperCase().startsWith(ref.toUpperCase() + ' ')) n = n.slice(ref.length).trim();
  return n.slice(0, 120);
};
async function overpass(q) {
  for (let round = 0; round < 3; round++) {
    for (const url of MIRRORS) {
      try {
        // curl honours the machine's proxy settings (Node's fetch does not)
        const tmp = `/tmp/ovp-${process.pid}.json`;
        const code = execFileSync('curl', ['-s', '-m', '170', '-o', tmp, '-w', '%{http_code}', '-A', 'ewvon-transit-build/1.0', '--data-urlencode', `data=${q}`, url], { encoding: 'utf8' }).trim();
        if (code !== '200') { console.log('  ', new URL(url).host, code); continue; }
        const j = JSON.parse(readFileSync(tmp, 'utf8')); unlinkSync(tmp);
        return j.elements || [];
      } catch (e) { console.log('  ', new URL(url).host, (e.message || '').slice(0, 80)); }
    }
    await new Promise((ok) => setTimeout(ok, 15000));
  }
  throw new Error('overpass');
}
mkdirSync('public/transit', { recursive: true });
for (const uf of UFS) {
  const t0 = Date.now();
  try {
    const area = `area["ISO3166-2"="BR-${uf}"]->.a;`;
    const rail = await overpass(`[out:json][timeout:140];${area}rel(area.a)["type"="route"]["route"~"^(train|subway|light_rail|tram|monorail)$"]->.r;.r out body;node(r.r);out tags;`);
    const bus = await overpass(`[out:json][timeout:140];${area}rel(area.a)["type"="route"]["route"~"^(bus|trolleybus|minibus|coach)$"];out tags;`);
    const nodes = new Map(rail.filter((e) => e.type === 'node').map((e) => [e.id, e.tags || {}]));
    const lines = new Map();
    for (const e of [...bus, ...rail]) {
      if (e.type !== 'relation') continue;
      const t = e.tags || {}; const kind = KIND[t.route]; if (!kind) continue;
      const ref = (t.ref || '').trim().slice(0, 20); const name = cleanName(t, ref);
      if (!ref && !name) continue;
      const key = `${kind}|${norm(ref) || norm(name)}|${t.network || ''}`;
      const color = /^#[0-9a-f]{6}$/i.test(t.colour || '') ? t.colour.toLowerCase() : '';
      const row = lines.get(key) || { k: kind, r: ref, n: name, c: color, d: [], s: [] };
      if (!row.c && color) row.c = color;
      if (!row.n && name) row.n = name;
      const tm = terminals(t);
      if ((tm[0] || tm[1]) && !row.d.some((d) => d[0] === tm[0] && d[1] === tm[1]) && row.d.length < 4) row.d.push(tm);
      if (kind !== 'bus' && e.members && !row.s.length) {
        const sts = [];
        for (const m of e.members) {
          if (m.type !== 'node') continue;
          const n = nodes.get(m.ref) || {}; const nm = (n.name || '').trim();
          if (!nm) continue;
          if (!(m.role.startsWith('stop') || ['station', 'halt', 'stop'].includes(n.railway) || ['stop_position', 'station'].includes(n.public_transport))) continue;
          if (!sts.includes(nm)) sts.push(nm.slice(0, 60));
        }
        if (sts.length >= 2) row.s = sts.slice(0, 60);
      }
      lines.set(key, row);
    }
    const out = [...lines.values()].map((l) => { const o = { k: l.k, r: l.r, n: l.n }; if (l.c) o.c = l.c; if (l.d.length) o.d = l.d; if (l.s.length) o.s = l.s; return o; });
    writeFileSync(`public/transit/${uf}.json`, JSON.stringify({ uf, at: new Date().toISOString().slice(0, 10), lines: out }));
    console.log(uf, out.length, 'linhas', Math.round((Date.now() - t0) / 1000) + 's');
  } catch (e) { console.log(uf, 'FALHOU', e.message, existsSync(`public/transit/${uf}.json`) ? '(mantido o arquivo anterior)' : ''); }
  await new Promise((ok) => setTimeout(ok, 4000));
}
