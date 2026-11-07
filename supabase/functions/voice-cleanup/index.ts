// Removes encrypted voice messages older than 7 days (ciphertext in the 'voice' bucket and
// their sealed keys). Called hourly by pg_cron with the vault 'push_secret'.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const secret = req.headers.get('x-push-secret') || ''
  const { data: paths, error } = await admin.rpc('expired_voice_media', { _secret: secret, _limit: 500 })
  if (error) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  const list = (paths || []) as string[]
  if (!list.length) return new Response(JSON.stringify({ removed: 0 }))
  const { error: rmError } = await admin.storage.from('voice').remove(list)
  if (rmError) return new Response(JSON.stringify({ error: rmError.message }), { status: 500 })
  await admin.from('e2e_media').delete().in('path', list)
  return new Response(JSON.stringify({ removed: list.length }))
})
