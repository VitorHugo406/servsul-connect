import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { email, password, name, birthDate, sectorId, registrationPassword } = await req.json();

    // Validate required fields
    if (!email || !password || !name || !birthDate || !sectorId || !registrationPassword) {
      return new Response(
        JSON.stringify({ error: "Todos os campos são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate registration password
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("key", "registration_password")
      .single();

    if (settingsError || !settings) {
      console.error("Error fetching registration password:", settingsError);
      return new Response(
        JSON.stringify({ error: "Erro ao validar senha de cadastro" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (registrationPassword !== settings.value) {
      return new Response(
        JSON.stringify({ error: "Senha de autorização inválida" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the user with admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        display_name: name.split(" ")[0],
      },
    });

    if (authError) {
      console.error("Error creating user:", authError);
      if (authError.message.includes("already been registered")) {
        return new Response(
          JSON.stringify({ error: "Este email já está cadastrado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: "Erro ao criar usuário" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the profile with birth_date and sector_id
    // The profile is created by the trigger, so we just need to update it
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        birth_date: birthDate,
        sector_id: sectorId,
      })
      .eq("user_id", authData.user.id);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      // Don't fail the registration, the profile can be updated later
    }

    // Add colaborador role by default
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: authData.user.id,
        role: "colaborador",
      });

    if (roleError) {
      console.error("Error adding role:", roleError);
    }

    return new Response(
      JSON.stringify({ success: true, user: authData.user }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
