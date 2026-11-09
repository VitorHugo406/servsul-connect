// Retired: ewvon calls are peer-to-peer (WebRTC + Supabase Realtime); the Daily.co integration was removed.
Deno.serve(() => new Response(JSON.stringify({ error: 'Gone' }), { status: 410, headers: { 'Content-Type': 'application/json' } }));
