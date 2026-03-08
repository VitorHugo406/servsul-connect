import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PermissionUpdate {
  userId: string;
  permissions: {
    canPostAnnouncements?: boolean;
    canDeleteMessages?: boolean;
    canAccessManagement?: boolean;
    canAccessPasswordChange?: boolean;
    canCreateWarRoom?: boolean;
  };
}

const MANAGEMENT_AUTONOMY_LEVELS = ['supervisor', 'gerente', 'diretoria'];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, permissions }: PermissionUpdate = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "ID do usuário é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!permissions || Object.keys(permissions).length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma permissão enviada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: callerRoles }, { data: callerProfile }, { data: callerPermissions }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id),
      supabaseAdmin.from("profiles").select("autonomy_level").eq("user_id", user.id).maybeSingle(),
      supabaseAdmin.from("user_permissions").select("can_access_management").eq("user_id", user.id).maybeSingle(),
    ]);

    const isCallerAdmin = (callerRoles || []).some(r => r.role === "admin");
    const hasManagementAccess =
      isCallerAdmin ||
      MANAGEMENT_AUTONOMY_LEVELS.includes(callerProfile?.autonomy_level || '') ||
      callerPermissions?.can_access_management === true;

    if (!hasManagementAccess) {
      return new Response(JSON.stringify({ error: "Você não tem permissão para atualizar permissões" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isCallerAdmin) {
      const requestedKeys = Object.keys(permissions);
      const onlyWarRoomPermission = requestedKeys.every(key => key === 'canCreateWarRoom');

      if (!onlyWarRoomPermission) {
        return new Response(JSON.stringify({ error: "Somente administradores podem alterar estas permissões" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("name, email")
      .eq("user_id", userId)
      .single();

    const { data: existingPerm } = await supabaseAdmin
      .from("user_permissions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const permissionData = {
      can_post_announcements: permissions.canPostAnnouncements ?? existingPerm?.can_post_announcements ?? false,
      can_delete_messages: permissions.canDeleteMessages ?? existingPerm?.can_delete_messages ?? false,
      can_access_management: permissions.canAccessManagement ?? existingPerm?.can_access_management ?? false,
      can_access_password_change: permissions.canAccessPasswordChange ?? existingPerm?.can_access_password_change ?? false,
      can_create_war_room: permissions.canCreateWarRoom ?? existingPerm?.can_create_war_room ?? false,
      updated_at: new Date().toISOString(),
    };

    const { error } = existingPerm
      ? await supabaseAdmin.from("user_permissions").update(permissionData).eq("user_id", userId)
      : await supabaseAdmin.from("user_permissions").insert({ user_id: userId, ...permissionData });

    if (error) {
      console.error("Error updating permissions:", error);
      return new Response(JSON.stringify({ error: "Erro ao atualizar permissões" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[AUDIT] ${user.email} updated permissions for user ${targetProfile?.email || userId}:`, permissions);

    return new Response(
      JSON.stringify({ success: true, message: "Permissões atualizadas com sucesso", updatedPermissions: permissionData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
