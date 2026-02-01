import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Parse request body - contains the matched user info
    const { userId, email } = await req.json();

    if (!userId || !email) {
      return new Response(
        JSON.stringify({ error: 'userId e email são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Create admin client
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify the user exists and is active
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Error finding profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (!profile.is_active) {
      return new Response(
        JSON.stringify({ error: 'Usuário inativo. Entre em contato com o administrador.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Get the origin for redirect
    const origin = req.headers.get('origin') || 'https://serv-hub-connect.lovable.app';

    // Generate a magic link for the user
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: `${origin}/`,
      },
    });

    if (linkError) {
      console.error('Error generating magic link:', linkError);
      return new Response(
        JSON.stringify({ error: 'Erro ao gerar link de acesso' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`Generated magic link for facial login: ${email}`);

    // The linkData contains the full action_link URL
    // We need to return this URL so the frontend can use it
    const actionLink = linkData.properties?.action_link;

    if (!actionLink) {
      console.error('No action link in response');
      return new Response(
        JSON.stringify({ error: 'Erro ao gerar link de acesso' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Return the magic link URL for client-side redirect
    return new Response(
      JSON.stringify({ 
        success: true,
        actionLink: actionLink,
        email: email,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error in facial-login:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
