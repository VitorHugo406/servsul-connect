// Sends a native-app event through Firebase Cloud Messaging (HTTP v1) to the phones of one person.
// Needs the secret FCM_SERVICE_ACCOUNT (the service-account JSON of the Firebase project). Without it, nothing is sent
// and the app keeps working through its own background connection.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } })
const b64url = (b: ArrayBuffer | string) => btoa(typeof b === 'string' ? b : String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

let cached: { token: string; exp: number } | null = null
async function accessToken(sa: { client_email: string; private_key: string }) {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token
  const iat = Math.floor(Date.now() / 1000)
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 }))
  const der = Uint8Array.from(atob(sa.private_key.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${claim}`))
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${b64url(sig)}` }) })
  const j = await r.json()
  if (!j.access_token) throw new Error('oauth: ' + JSON.stringify(j).slice(0, 200))
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 }
  return cached.token
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const { data: cfg } = await admin.rpc('push_config', { _secret: req.headers.get('x-push-secret') || '' })
  if (!(Array.isArray(cfg) ? cfg[0] : cfg)?.private_key) return json({ error: 'Unauthorized' }, 401)
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT')
  if (!raw) return json({ skipped: 'FCM_SERVICE_ACCOUNT not set' })
  const sa = JSON.parse(raw)
  const { profile_id, payload } = await req.json().catch(() => ({})) as { profile_id?: string; payload?: Record<string, unknown> }
  if (!profile_id || !payload) return json({ error: 'bad request' }, 400)
  const { data: devs } = await admin.from('native_devices').select('id, fcm_token').eq('profile_id', profile_id).not('fcm_token', 'is', null)
  if (!devs?.length) return json({ sent: 0 })
  const token = await accessToken(sa)
  const call = payload.kind === 'call'
  let sent = 0
  await Promise.all(devs.map(async (d) => {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { token: d.fcm_token, data: { p: JSON.stringify(payload) }, android: { priority: 'HIGH', ttl: call ? '60s' : '86400s' } } }),
    })
    if (r.ok) sent++
    else {
      const t = await r.text()
      if (/UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT/.test(t)) await admin.from('native_devices').update({ fcm_token: null }).eq('id', d.id)
      else console.error('fcm', r.status, t.slice(0, 200))
    }
  }))
  return json({ sent })
})
