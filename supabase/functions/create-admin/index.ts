// Disabled for security (2026-11-09): legacy bootstrap that let any company admin create new
// admin accounts outside their company. Company admins are created by the super admin
// (create-company-admin) and users by register-user, both company-scoped.
Deno.serve(() => new Response(JSON.stringify({ error: 'Desativado' }), { status: 410, headers: { 'Content-Type': 'application/json' } }));
