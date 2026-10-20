import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://nuvexa-gestao.vercel.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cleanup-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const expectedSecret = Deno.env.get('ATTACHMENT_CLEANUP_SECRET')
  const suppliedSecret = req.headers.get('x-cleanup-secret')
  if (!expectedSecret || !suppliedSecret || suppliedSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration missing' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const now = new Date().toISOString()
  const { data: expired, error: listError } = await supabase
    .from('attachment_lifecycle')
    .select('id, storage_bucket, storage_path')
    .eq('status', 'temporary')
    .lte('temporary_expires_at', now)
    .is('temporary_deleted_at', null)
    .limit(200)

  if (listError) {
    return new Response(JSON.stringify({ error: 'Could not list expired attachments' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let deleted = 0
  const failures: string[] = []
  for (const item of expired ?? []) {
    const { error: storageError } = await supabase.storage
      .from(item.storage_bucket)
      .remove([item.storage_path])

    // Treat an already-missing object as safe to finalize only if storage confirms
    // no error. Errors remain pending and will be retried on the next scheduled run.
    if (storageError) {
      failures.push(item.id)
      continue
    }

    const { error: updateError } = await supabase
      .from('attachment_lifecycle')
      .update({
        temporary_deleted_at: now,
        status: 'expired',
      })
      .eq('id', item.id)
      .eq('status', 'temporary')

    if (updateError) {
      failures.push(item.id)
      continue
    }
    deleted += 1
  }

  return new Response(JSON.stringify({
    checked: expired?.length ?? 0,
    deleted,
    failed: failures.length,
    failedIds: failures,
  }), {
    status: failures.length ? 207 : 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
