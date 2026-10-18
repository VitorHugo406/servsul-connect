import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";
import { MIGRATIONS } from "./migrations.ts";
const TOKEN = "52bdc2f04860cd85bd42775f9ed52d68";
Deno.serve(async (req) => {
  if (req.headers.get("x-apply-token") !== TOKEN) return new Response("no", { status: 403 });
  const from = Number(new URL(req.url).searchParams.get("from") ?? "0");
  const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 1, prepare: false });
  const results: any[] = [];
  const t0 = Date.now();
  for (let i = from; i < MIGRATIONS.length; i++) {
    if (Date.now() - t0 > 90000) { results.push({ i, ok: true, paused: true }); break; }
    const [name, body] = MIGRATIONS[i];
    try { await sql.begin(async (tx) => { await tx.unsafe(body); }); results.push({ i, name, ok: true }); }
    catch (e) { results.push({ i, name, ok: false, error: String((e as any)?.message ?? e) }); break; }
  }
  await sql.end();
  return new Response(JSON.stringify({ total: MIGRATIONS.length, results: results.filter(r=>!r.ok), last: results.at(-1) }), { headers: { "content-type": "application/json" } });
});
