// Long poll for the native Android app. The app sends its device secret and the last event id it has seen; the answer
// comes as soon as there is something new for that person (messages, notices, calls) or after ~25 s with nothing.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const H = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: H })
const sha = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('')
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { ...H, 'Access-Control-Allow-Headers': '*' } })
  const { secret, after } = await req.json().catch(() => ({})) as { secret?: string; after?: number }
  if (!secret || secret.length < 20) return json({ error: 'unauthorized' }, 401)
  const { data: dev } = await admin.from('native_devices').select('id, profile_id, last_seen').eq('secret_hash', await sha(secret)).maybeSingle()
  if (!dev) return json({ error: 'unauthorized' }, 401)
  if (!dev.last_seen || Date.now() - new Date(dev.last_seen).getTime() > 60_000) {
    await admin.from('native_devices').update({ last_seen: new Date().toISOString() }).eq('id', dev.id)
    await admin.from('native_events').delete().lt('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())
  }
  let last = Number.isFinite(after) && (after as number) >= 0 ? (after as number) : -1
  if (last < 0) {   // first connection: start from now (nothing old is replayed)
    const { data: m } = await admin.from('native_events').select('id').eq('profile_id', dev.profile_id).order('id', { ascending: false }).limit(1).maybeSingle()
    return json({ events: [], last: m?.id ?? 0 })
  }
  const deadline = Date.now() + 25_000
  while (Date.now() < deadline) {
    const { data: rows } = await admin.from('native_events').select('id, payload').eq('profile_id', dev.profile_id).gt('id', last).order('id').limit(50)
    if (rows && rows.length) return json({ events: rows.map((r) => ({ id: r.id, ...r.payload })), last: rows[rows.length - 1].id })
    await sleep(1500)
  }
  return json({ events: [], last })
})
