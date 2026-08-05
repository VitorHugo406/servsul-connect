import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Nuvexa Conference API Proxy
 * 
 * Proxies requests to the Nuvexa Conference external API.
 * Base URL: https://bghzxmdnqgmbyuwakktn.supabase.co/functions/v1/meetings-api
 * 
 * === SUPPORTED ENDPOINTS ===
 * 
 * POST /meetings
 *   Body: { title, scheduled_at (ISO 8601), duration_minutes }
 *   Response: { meeting: {...}, join_url: "https://..." }
 * 
 * GET /meetings
 *   Query: status (live|scheduled|ended), limit (default 50)
 *   Response: { meetings: [{ id, title, meeting_code, status }] }
 * 
 * GET /meetings/:id
 *   Response: meeting details
 * 
 * PUT /meetings/:id
 *   Body: { title, status, scheduled_at }
 * 
 * DELETE /meetings/:id
 *   Encerra reunião
 * 
 * GET /meetings/:id/join
 *   Response: { join_url: "https://..." }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CONFERENCE_API_BASE =
  "https://bghzxmdnqgmbyuwakktn.supabase.co/functions/v1/meetings-api";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const userId = claimsData.claims.sub;
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Only admins can use Nuvexa Conference" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const apiKey = Deno.env.get("NUVEXA_CONFERENCE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Conference API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse the request path from query param
    const url = new URL(req.url);
    const path = url.searchParams.get("path") || "/meetings";
    const targetUrl = `${CONFERENCE_API_BASE}${path}`;

    // Forward the request
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
    };

    if (req.method === "POST" || req.method === "PUT") {
      fetchOptions.body = await req.text();
    }

    const response = await fetch(targetUrl, fetchOptions);
    const responseData = await response.text();

    return new Response(responseData, {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Nuvexa Conference proxy error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
