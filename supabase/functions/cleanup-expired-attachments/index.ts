import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Deletes expired chat media (attachment_lifecycle rows with status 'temporary'
// whose temporary_expires_at passed) and the photos/videos of announcements that
// expired or were deleted (bucket announcement-media, listed by the database
// function announcement_media_garbage). Called every 15 minutes by pg_cron with
// the vault secret "attachment_cleanup_secret" in the x-cleanup-secret header.

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://nuvexa-gestao.vercel.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cleanup-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return json({ error: 'Server configuration missing' }, 500)
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // Accept the env secret (if configured) or the vault secret used by the cron job.
  const supplied = req.headers.get('x-cleanup-secret') || ''
  const envSecret = Deno.env.get('ATTACHMENT_CLEANUP_SECRET')
  let authorized = !!envSecret && supplied === envSecret
  if (!authorized && supplied) {
    const { data } = await supabase.rpc('cleanup_secret_matches', { _s: supplied })
    authorized = data === true
  }
  if (!authorized) return json({ error: 'Unauthorized' }, 401)

  const now = new Date().toISOString()
  const { data: expired, error: listError } = await supabase
    .from('attachment_lifecycle')
    .select('id, storage_bucket, storage_path')
    .eq('status', 'temporary')
    .lte('temporary_expires_at', now)
    .is('temporary_deleted_at', null)
    .limit(200)
  if (listError) return json({ error: 'Could not list expired attachments' }, 500)

  let deleted = 0
  const failures: string[] = []
  for (const item of expired ?? []) {
    const { error: storageError } = await supabase.storage.from(item.storage_bucket).remove([item.storage_path])
    if (storageError) { failures.push(item.id); continue }
    const { error: updateError } = await supabase
      .from('attachment_lifecycle')
      .update({ temporary_deleted_at: now, status: 'expired' })
      .eq('id', item.id)
      .eq('status', 'temporary')
    if (updateError) { failures.push(item.id); continue }
    deleted += 1
  }

  // Announcement photos/videos: removed from Storage when the announcement expires or is deleted.
  let annDeleted = 0
  let annFailed = 0
  const { data: garbage, error: gErr } = await supabase.rpc('announcement_media_garbage', { _limit: 500 })
  if (!gErr && Array.isArray(garbage) && garbage.length) {
    const paths = (garbage as { path: string }[]).map((g) => g.path).filter(Boolean)
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100)
      const { error: rmErr } = await supabase.storage.from('announcement-media').remove(chunk)
      if (rmErr) { annFailed += chunk.length; continue }
      await supabase.from('announcement_media').delete().in('path', chunk)
      annDeleted += chunk.length
    }
  }

  const failed = failures.length + annFailed
  return json({ checked: expired?.length ?? 0, deleted, failed: failures.length, failedIds: failures, announcementMediaDeleted: annDeleted, announcementMediaFailed: annFailed }, failed ? 207 : 200)
})
