import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (_req: Request) => new Response(JSON.stringify({
  error: "Endpoint administrativo desativado por segurança. Migrações devem ser executadas por canal administrativo seguro.",
  code: "ENDPOINT_RETIRED"
}), { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }));
