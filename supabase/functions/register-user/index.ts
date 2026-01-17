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

    const { 
      email, 
      password, 
      name, 
      birthDate, 
      sectorId, 
      registrationPassword,
      // New fields
      phone,
      address,
      company,
      registrationNumber,
      profileType,
      isActive,
      additionalSectors,
      permissions,
    } = await req.json();

    // Validate required fields
    if (!email || !password || !name || !birthDate || !sectorId || !registrationPassword) {
      return new Response(
        JSON.stringify({ error: "Todos os campos obrigatórios devem ser preenchidos" }),
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

    // Update the profile with all fields
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        birth_date: birthDate,
        sector_id: sectorId,
        phone: phone || null,
        address: address || null,
        company: company || null,
        registration_number: registrationNumber || null,
        profile_type: profileType || 'user',
        is_active: isActive !== undefined ? isActive : true,
      })
      .eq("user_id", authData.user.id);

    if (profileError) {
      console.error("Error updating profile:", profileError);
    }

    // Add role based on profile type
    const role = profileType === 'admin' ? 'admin' : 'colaborador';
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: authData.user.id,
        role: role,
      });

    if (roleError) {
      console.error("Error adding role:", roleError);
    }

    // Add additional sectors if provided
    if (additionalSectors && additionalSectors.length > 0) {
      const sectorInserts = additionalSectors.map((sId: string) => ({
        user_id: authData.user.id,
        sector_id: sId,
      }));

      const { error: sectorsError } = await supabaseAdmin
        .from("user_additional_sectors")
        .insert(sectorInserts);

      if (sectorsError) {
        console.error("Error adding additional sectors:", sectorsError);
      }
    }

    // Add permissions if provided
    if (permissions) {
      const { error: permError } = await supabaseAdmin
        .from("user_permissions")
        .insert({
          user_id: authData.user.id,
          can_post_announcements: permissions.canPostAnnouncements || false,
          can_delete_messages: permissions.canDeleteMessages || false,
          can_access_management: permissions.canAccessManagement || false,
          can_access_password_change: permissions.canAccessPasswordChange || false,
        });

      if (permError) {
        console.error("Error adding permissions:", permError);
      }
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
