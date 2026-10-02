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

    const json = (b: unknown, status: number) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: callerData } = token ? await supabaseAdmin.auth.getUser(token) : { data: { user: null } } as any;
    const callerId = callerData?.user?.id;
    if (!callerId) return json({ error: "Não autorizado" }, 401);
    const [{ data: callerRoles }, { data: callerProfile }, { data: callerPerms }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", callerId),
      supabaseAdmin.from("profiles").select("company_id, autonomy_level").eq("user_id", callerId).maybeSingle(),
      supabaseAdmin.from("user_permissions").select("can_access_management").eq("user_id", callerId).maybeSingle(),
    ]);
    const roleNames = (callerRoles || []).map((r: any) => r.role);
    const callerIsSuper = roleNames.includes("super_admin");
    const callerCompanyId = callerProfile?.company_id;
    const callerAllowed = callerIsSuper || roleNames.includes("admin") || callerProfile?.autonomy_level === "admin" || callerPerms?.can_access_management === true;

    let {
      email, 
      password, 
      name, 
      birthDate, 
      sectorId, 
      registrationPassword,
      companyId,
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
    if (!email || !password || !name || !birthDate || !sectorId) {
      return new Response(
        JSON.stringify({ error: "Todos os campos obrigatórios devem ser preenchidos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!callerAllowed) {
      return new Response(
        JSON.stringify({ error: "Você não tem permissão para cadastrar usuários" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // Non super admins can only create users in their own company
    if (!callerIsSuper) companyId = callerCompanyId;

    if (!companyId) return json({ error: "Empresa não identificada" }, 400);
    // Create the user with admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        display_name: name.split(" ")[0],
        company_id: companyId,
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

    // Map profileType to autonomy_level
    const autonomyMap: Record<string, string> = {
      admin: 'admin',
      gestor: 'gestor',
      gerente: 'gerente',
      supervisor: 'supervisor',
      diretoria: 'diretoria',
      user: 'colaborador',
    };
    const autonomyLevel = autonomyMap[profileType] || 'colaborador';

    // Update the profile with all fields
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        company_id: companyId,
        birth_date: birthDate,
        sector_id: sectorId,
        phone: phone || null,
        address: address || null,
        company: company || null,
        registration_number: registrationNumber || null,
        profile_type: profileType || 'user',
        autonomy_level: autonomyLevel,
        is_active: isActive !== undefined ? isActive : true,
      })
      .eq("user_id", authData.user.id);

    if (profileError) {
      console.error("Error updating profile:", profileError);
    }

    // Add role based on profile type
    const roleMap: Record<string, string> = {
      admin: 'admin',
      gestor: 'gestor',
      gerente: 'gerente',
      supervisor: 'supervisor',
      diretoria: 'diretoria',
      user: 'colaborador',
    };
    const role = roleMap[profileType] || 'colaborador';
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
