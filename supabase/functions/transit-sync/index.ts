// Loads every bus / train / metro / tram line of one Brazilian state from OpenStreetMap (Overpass) into
// public.transit_lines, so the chat's "Ônibus/trem" search is instant. Public data only; a state is refreshed at most
// once a week (anyone signed in may ask; repeated calls are no-ops), so it cannot be used to hammer Overpass.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '))
const MIRRORS = ['https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass-api.de/api/interpreter']
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type El = { type: string; id: number; tags?: Record<string, string>; members?: { type: string; ref: number; role: string }[] }

const errs: string[] = []
async function overpass(q: string): Promise<El[]> {
  for (const url of MIRRORS) {
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 55_000)
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), signal: ctl.signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': 'ewvon-transit-sync/1.0 (+https://ewvon.com)' } })
      clearTimeout(tm)
      if (!r.ok) { errs.push(`${new URL(url).host} ${r.status} ${(await r.text()).slice(0, 120)}`); continue }
      return (await r.json()).elements || []
    } catch (e) { errs.push(`${new URL(url).host} ${(e as Error).name}: ${(e as Error).message}`.slice(0, 160)) }
  }
  throw new Error(errs.join(' | '))
}

const KIND: Record<string, string> = { bus: 'bus', trolleybus: 'bus', minibus: 'bus', coach: 'bus', train: 'train', subway: 'metro', monorail: 'metro', light_rail: 'tram', tram: 'tram' }
const norm = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, '')
const terminals = (t: Record<string, string>) => {
  if (t.from || t.to) return { from: t.from || '', to: t.to || '' }
  const m = /:\s*(.+?)\s*(?:=>|→|->|⇒)\s*(.+)$/.exec(t.name || '') || /^(.+?)\s*(?:=>|→|->|⇒)\s*(.+)$/.exec(t.name || '')
  return m ? { from: m[1].trim(), to: m[2].trim() } : { from: '', to: '' }
}
const cleanName = (t: Record<string, string>, ref: string) => {
  let n = (t.name || '').replace(/:\s*.+$/, '').replace(/\s*(=>|→|->|⇒).*$/, '').trim()
  n = n.replace(/^(Ônibus|Onibus|Bus)\s+/i, '').trim()
  if (ref && norm(n) === norm(ref)) n = ''
  if (ref && n.toUpperCase().startsWith(ref.toUpperCase() + ' ')) n = n.slice(ref.length).trim()   // "875A-10 Perdizes" -> "Perdizes"
  return n.slice(0, 120)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const { uf: rawUf, force } = await req.json().catch(() => ({})) as { uf?: string; force?: boolean }
  const uf = String(rawUf || '').toUpperCase()
  if (!UFS.has(uf)) return json({ error: 'uf' }, 400)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: st } = await admin.from('transit_sync').select('synced_at, status').eq('uf', uf).maybeSingle()
  const age = st?.synced_at ? Date.now() - new Date(st.synced_at).getTime() : Infinity
  if (st?.status === 'running' && age < 5 * 60_000) return json({ running: true })
  if (st?.status === 'ok' && age < 7 * 86400_000 && !force) return json({ fresh: true })
  await admin.from('transit_sync').upsert({ uf, synced_at: new Date().toISOString(), status: 'running', lines: 0 })

  try {
    const area = `area["ISO3166-2"="BR-${uf}"]->.a;`
    errs.length = 0
    const rail = await overpass(`[out:json][timeout:50];${area}rel(area.a)["type"="route"]["route"~"^(train|subway|light_rail|tram|monorail)$"]->.r;.r out body;node(r.r);out tags;`)
    const bus = await overpass(`[out:json][timeout:50];${area}rel(area.a)["type"="route"]["route"~"^(bus|trolleybus|minibus|coach)$"];out tags;`)
    const nodes = new Map<number, Record<string, string>>()
    for (const e of rail) if (e.type === 'node') nodes.set(e.id, e.tags || {})
    type Row = { uf: string; kind: string; ref: string; ref_norm: string; name: string; network: string; color: string | null; dirs: { from: string; to: string }[]; stations: string[] }
    const lines = new Map<string, Row>()
    for (const e of [...bus, ...rail]) {
      if (e.type !== 'relation') continue
      const t = e.tags || {}
      const kind = KIND[t.route]; if (!kind) continue
      const ref = (t.ref || '').trim().slice(0, 20)
      const name = cleanName(t, ref)
      if (!ref && !name) continue
      const key = `${kind}|${norm(ref) || norm(name)}|${t.network || ''}`
      const color = /^#[0-9a-f]{6}$/i.test(t.colour || '') ? t.colour.toLowerCase() : null
      const row = lines.get(key) || { uf, kind, ref, ref_norm: norm(ref), name, network: (t.network || t.operator || '').slice(0, 80), color, dirs: [], stations: [] }
      if (!row.color && color) row.color = color
      if (!row.name && name) row.name = name
      const tm = terminals(t)
      if ((tm.from || tm.to) && !row.dirs.some((d) => d.from === tm.from && d.to === tm.to) && row.dirs.length < 6) row.dirs.push(tm)
      if (kind !== 'bus' && e.members && !row.stations.length) {
        const sts: string[] = []
        for (const m of e.members) {
          if (m.type !== 'node') continue
          const n = nodes.get(m.ref) || {}
          const nm = (n.name || '').trim()
          if (!nm) continue
          if (!(m.role.startsWith('stop') || ['station', 'halt', 'stop'].includes(n.railway) || ['stop_position', 'station'].includes(n.public_transport))) continue
          if (sts[sts.length - 1] !== nm && !sts.includes(nm)) sts.push(nm.slice(0, 60))
        }
        if (sts.length >= 2) row.stations = sts.slice(0, 60)
      }
      lines.set(key, row)
    }
    const rows = [...lines.values()].map((r) => ({ ...r, updated_at: new Date().toISOString() }))
    await admin.from('transit_lines').delete().eq('uf', uf)
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await admin.from('transit_lines').insert(rows.slice(i, i + 500))
      if (error) throw error
    }
    await admin.from('transit_sync').upsert({ uf, synced_at: new Date().toISOString(), status: 'ok', lines: rows.length })
    return json({ ok: true, lines: rows.length })
  } catch (e) {
    await admin.from('transit_sync').upsert({ uf, synced_at: st?.synced_at ?? null, status: 'error', lines: 0 })
    return json({ error: (e as Error).message || 'falha' }, 502)
  }
})
