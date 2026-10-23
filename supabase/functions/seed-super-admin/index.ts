import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (_req: Request) => new Response(JSON.stringify({
  error: "Endpoint desativado por segurança. Use o painel administrativo seguro para gerenciar o superadministrador.",
  code: "ENDPOINT_RETIRED"
}), { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }));
