import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = req.headers.get('Authorization')
  if (!url || !anonKey || !serviceKey || !authorization) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: { storagePath?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const storagePath = body.storagePath
  if (typeof storagePath !== 'string' || !storagePath.startsWith(authData.user.id + '/') ||
      storagePath.includes('..') || storagePath.startsWith('/')) {
    return new Response(JSON.stringify({ error: 'Invalid storage path' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: object, error: objectError } = await admin.storage
    .from('attachments').list(authData.user.id, {
      search: storagePath.slice(authData.user.id.length + 1),
      limit: 100,
    })
  const fileName = storagePath.slice(authData.user.id.length + 1)
  if (objectError || !object?.some((item) => item.name === fileName)) {
    return new Response(JSON.stringify({ error: 'Uploaded object not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data, error } = await admin.from('attachment_lifecycle').insert({
    storage_bucket: 'attachments',
    storage_path: storagePath,
    uploaded_by: authData.user.id,
  }).select('id, temporary_expires_at').single()

  if (error) {
    return new Response(JSON.stringify({ error: 'Could not register attachment lifecycle' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(data), {
    status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
