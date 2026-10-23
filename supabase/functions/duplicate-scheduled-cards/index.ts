import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (_req: Request) => new Response(JSON.stringify({
  error: "Automação temporariamente desativada durante revisão de segurança."
}), { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }));
