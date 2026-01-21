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
    
    // Parse request body - contains the matched user info
    const { userId, email } = await req.json();

    if (!userId || !email) {
      throw new Error('userId e email são obrigatórios');
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
      throw new Error('Usuário não encontrado');
    }

    if (!profile.is_active) {
      throw new Error('Usuário inativo. Entre em contato com o administrador.');
    }

    // Generate a magic link for the user
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: `${req.headers.get('origin') || 'https://serv-hub-connect.lovable.app'}/`,
      },
    });

    if (linkError) {
      console.error('Error generating magic link:', linkError);
      throw new Error('Erro ao gerar link de acesso');
    }

    console.log(`Generated magic link for facial login: ${email}`);

    // Return the magic link token for client-side verification
    return new Response(
      JSON.stringify({ 
        success: true,
        token: linkData.properties?.hashed_token,
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
        status: 400,
      }
    );
  }
});
