// Disabled for security (2026-11-09): it returned every user's name, e-mail and face descriptor
// to anyone. Facial login is turned off until it is rebuilt with server-side matching + liveness.
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
Deno.serve((req) => req.method === 'OPTIONS'
  ? new Response(null, { headers: cors })
  : new Response(JSON.stringify({ error: 'Login facial desativado por segurança' }), { status: 410, headers: { ...cors, 'Content-Type': 'application/json' } }));
