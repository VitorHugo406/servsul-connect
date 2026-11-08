// Disabled for security (2026-11-09): one-off bootstrap that was publicly callable and had a
// hard-coded credential. The super admin already exists; this endpoint does nothing now.
Deno.serve(() => new Response(JSON.stringify({ error: 'Desativado' }), { status: 410, headers: { 'Content-Type': 'application/json' } }));
