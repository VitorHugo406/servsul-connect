// Edge function: seed the global super-admin user (idempotent).
// Call once (any authenticated user or anon) — if the target email already exists, nothing changes.
// Password is embedded intentionally per user's setup request; rotate anytime via Supabase Auth.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPER_ADMIN_EMAIL = "vitor.santospess@gmail.com";
const SUPER_ADMIN_PASSWORD = "Hugo4062006*";
const ADMIN_COMPANY_ID = "00000000-0000-0000-0000-0000000000a1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Try to find user by email
    const { data: existing } = await supabase.auth.admin.listUsers();
    let userId = existing?.users?.find((u) => u.email === SUPER_ADMIN_EMAIL)?.id;

    if (!userId) {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email: SUPER_ADMIN_EMAIL,
        password: SUPER_ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: {
          name: "Super Admin",
          display_name: "Super Admin",
          company_id: ADMIN_COMPANY_ID,
        },
      });
      if (error || !created?.user) {
        return new Response(
          JSON.stringify({ error: error?.message || "failed to create user" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      userId = created.user.id;
    }

    // Ensure profile is linked to Admin company + active + admin autonomy
    await supabase
      .from("profiles")
      .update({
        company_id: ADMIN_COMPANY_ID,
        autonomy_level: "admin",
        is_active: true,
      })
      .eq("user_id", userId);

    // Ensure super_admin role exists
    await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role: "super_admin" }, { onConflict: "user_id,role" });

    // Also give it 'admin' role for convenience (bypasses old admin-scoped policies)
    await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

    return new Response(
      JSON.stringify({ success: true, user_id: userId, email: SUPER_ADMIN_EMAIL }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
