import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PermissionUpdate {
  userId: string;
  permissions: {
    canPostAnnouncements?: boolean;
    canDeleteMessages?: boolean;
    canAccessManagement?: boolean;
    canAccessPasswordChange?: boolean;
  };
}

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

    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller is admin
    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!callerRole || callerRole.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Apenas administradores podem atualizar permissões" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { userId, permissions }: PermissionUpdate = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "ID do usuário é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get target user info for audit log
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("name, email")
      .eq("user_id", userId)
      .single();

    // Check if permission record exists
    const { data: existingPerm } = await supabaseAdmin
      .from("user_permissions")
      .select("*")
      .eq("user_id", userId)
      .single();

    const permissionData = {
      can_post_announcements: permissions.canPostAnnouncements ?? false,
      can_delete_messages: permissions.canDeleteMessages ?? false,
      can_access_management: permissions.canAccessManagement ?? false,
      can_access_password_change: permissions.canAccessPasswordChange ?? false,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (existingPerm) {
      const result = await supabaseAdmin
        .from("user_permissions")
        .update(permissionData)
        .eq("user_id", userId);
      error = result.error;
    } else {
      const result = await supabaseAdmin
        .from("user_permissions")
        .insert({
          user_id: userId,
          ...permissionData,
        });
      error = result.error;
    }

    if (error) {
      console.error("Error updating permissions:", error);
      return new Response(
        JSON.stringify({ error: "Erro ao atualizar permissões" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the audit trail
    console.log(`[AUDIT] Admin ${user.email} updated permissions for user ${targetProfile?.email || userId}:`, permissions);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Permissões atualizadas com sucesso",
        updatedPermissions: permissionData
      }),
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
