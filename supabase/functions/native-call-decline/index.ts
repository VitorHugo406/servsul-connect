// "Recusar" on the native call notification: the app has no web session at that moment, so it proves who it is with the
// device secret. A refused direct call ends as "declined" (the caller's screen stops showing "chamando").
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const H = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: H })
const sha = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { ...H, 'Access-Control-Allow-Headers': '*' } })
  const { secret, callId } = await req.json().catch(() => ({})) as { secret?: string; callId?: string }
  if (!secret || secret.length < 20 || !callId || !/^[0-9a-f-]{36}$/.test(callId)) return json({ error: 'bad request' }, 400)
  const { data: dev } = await admin.from('native_devices').select('profile_id').eq('secret_hash', await sha(secret)).maybeSingle()
  if (!dev) return json({ error: 'unauthorized' }, 401)
  const { data: me } = await admin.from('profiles').select('id, company_id, name').eq('id', dev.profile_id).maybeSingle()
  const { data: call } = await admin.from('chat_calls').select('id, company_id, caller_id, conv, status').eq('id', callId).maybeSingle()
  if (!me || !call || call.company_id !== me.company_id || call.caller_id === me.id) return json({ ok: false })
  if (call.conv === 'dm' && call.status === 'ringing') {
    await admin.from('chat_calls').update({ status: 'declined', ended_at: new Date().toISOString() }).eq('id', callId).is('ended_at', null)
  }
  // Tell the caller's open screen right away (same broadcast the web "Recusar" button sends).
  try {
    const ch = admin.channel(`ewvon-ring-${call.caller_id}`)
    await new Promise<void>((ok) => { ch.subscribe((s: string) => { if (s === 'SUBSCRIBED' || s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') ok() }); setTimeout(ok, 3000) })
    await ch.send({ type: 'broadcast', event: 'declined', payload: { callId, name: me.name || 'A pessoa' } })
    await admin.removeChannel(ch)
  } catch { /* the status change is enough */ }
  return json({ ok: true })
})
