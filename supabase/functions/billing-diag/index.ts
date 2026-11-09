// Disabled: temporary Mercado Pago account diagnostics, no longer needed.
Deno.serve(() => new Response(JSON.stringify({ error: 'Gone' }), { status: 410, headers: { 'Content-Type': 'application/json' } }));
