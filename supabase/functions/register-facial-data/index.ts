import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    
    // Create user client to verify auth
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader || '' } }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    
    if (authError || !user) {
      throw new Error('Não autorizado');
    }

    // Parse request body
    const { email, descriptors } = await req.json();

    if (!email || !descriptors || !Array.isArray(descriptors)) {
      throw new Error('Email e descriptors são obrigatórios');
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
      console.error('Error finding profile:', profileError);
      throw new Error('Perfil não encontrado');
    }

    // Check if user already has facial data
    const { data: existing } = await adminClient
      .from('user_facial_data')
      .select('id')
      .eq('user_id', profile.user_id)
      .single();

    if (existing) {
      // Update existing
      const { error: updateError } = await adminClient
        .from('user_facial_data')
        .update({
          facial_descriptors: descriptors,
          updated_at: new Date().toISOString(),
          registered_by: user.id,
        })
        .eq('user_id', profile.user_id);

      if (updateError) {
        console.error('Error updating facial data:', updateError);
        throw new Error('Erro ao atualizar dados faciais');
      }

      console.log(`Updated facial data for user ${email}`);
    } else {
      // Insert new
      const { error: insertError } = await adminClient
        .from('user_facial_data')
        .insert({
          user_id: profile.user_id,
          profile_id: profile.id,
          facial_descriptors: descriptors,
          registered_by: user.id,
        });

      if (insertError) {
        console.error('Error inserting facial data:', insertError);
        throw new Error('Erro ao cadastrar dados faciais');
      }

      console.log(`Created facial data for user ${email}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error in register-facial-data:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
