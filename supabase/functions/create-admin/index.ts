import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  }});
  return new Response(JSON.stringify({
    error: "Endpoint legado de criação de administradores desativado. Use o fluxo de cadastro com validação de empresa e permissões.",
    code: "ENDPOINT_RETIRED"
  }), { status: 410, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json", "Cache-Control": "no-store" } });
});
