// Disabled for security (2026-11-09): it ran SQL migrations with the database URL behind a token
// that was committed to the repository. Migrations are applied through the Supabase migration tools.
Deno.serve(() => new Response(JSON.stringify({ error: 'Desativado' }), { status: 410, headers: { 'Content-Type': 'application/json' } }));
