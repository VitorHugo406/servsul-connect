import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Validate JWT properly using getClaims
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado - token não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);

    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado - token inválido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const userId = claimsData.claims.sub;

    // Parse request body
    const { email, descriptors } = await req.json();

    if (!email || !descriptors || !Array.isArray(descriptors)) {
      return new Response(
        JSON.stringify({ error: 'Email e descriptors são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Create admin client to bypass RLS
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Find the profile by email
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, user_id')
      .eq('email', email)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Perfil não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Check if user already has facial data
    const { data: existing } = await adminClient
      .from('user_facial_data')
      .select('id')
      .eq('user_id', profile.user_id)
      .single();

    if (existing) {
      const { error: updateError } = await adminClient
        .from('user_facial_data')
        .update({
          facial_descriptors: descriptors,
          updated_at: new Date().toISOString(),
          registered_by: userId,
        })
        .eq('user_id', profile.user_id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar dados faciais' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    } else {
      const { error: insertError } = await adminClient
        .from('user_facial_data')
        .insert({
          user_id: profile.user_id,
          profile_id: profile.id,
          facial_descriptors: descriptors,
          registered_by: userId,
        });

      if (insertError) {
        return new Response(
          JSON.stringify({ error: 'Erro ao cadastrar dados faciais' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error in register-facial-data:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
