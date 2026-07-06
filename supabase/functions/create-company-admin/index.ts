import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Payload {
  company_id: string;
  email: string;
  password: string;
  name: string;
  display_name?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'missing auth' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify caller is super_admin
    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, service);
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'super_admin')
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as Payload;
    if (!body?.company_id || !body?.email || !body?.password || !body?.name) {
      return new Response(JSON.stringify({ error: 'invalid payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ensure company exists and is not the system company
    const { data: company, error: cErr } = await admin
      .from('companies')
      .select('id, is_system')
      .eq('id', body.company_id)
      .maybeSingle();
    if (cErr || !company) {
      return new Response(JSON.stringify({ error: 'company not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        name: body.name,
        display_name: body.display_name || body.name,
        company_id: body.company_id,
      },
    });

    if (createErr || !created?.user) {
      return new Response(
        JSON.stringify({ error: createErr?.message || 'failed to create user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const newUserId = created.user.id;

    // Force the profile to the target company (trigger already inserted a profile row)
    await admin
      .from('profiles')
      .update({
        company_id: body.company_id,
        name: body.name,
        display_name: body.display_name || body.name,
        autonomy_level: 'admin',
        is_active: true,
      })
      .eq('user_id', newUserId);

    // Grant admin role
    await admin.from('user_roles').upsert(
      { user_id: newUserId, role: 'admin' as any },
      { onConflict: 'user_id,role' },
    );

    // Grant full permissions
    await admin.from('user_permissions').upsert(
      {
        user_id: newUserId,
        can_post_announcements: true,
        can_delete_messages: true,
        can_access_management: true,
        can_access_password_change: true,
        can_create_war_room: true,
        can_access_bh: true,
        can_access_fechamento: true,
        can_access_orbs: true,
      } as any,
      { onConflict: 'user_id' },
    );

    return new Response(
      JSON.stringify({ ok: true, user_id: newUserId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
