// Disabled for security (2026-11-09): it issued a login link for any { userId, email } without
// checking the face on the server. Facial login stays off until rebuilt with server-side matching + liveness.
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
Deno.serve((req) => req.method === 'OPTIONS'
  ? new Response(null, { headers: cors })
  : new Response(JSON.stringify({ error: 'Login facial desativado por segurança' }), { status: 410, headers: { ...cors, 'Content-Type': 'application/json' } }));
