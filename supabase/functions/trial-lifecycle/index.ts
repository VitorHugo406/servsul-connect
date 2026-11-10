// Daily trial lifecycle ("Avaliação até <data>", set by the super admin):
//   7 days before the end -> notice to the company's base admin (Comunicados chat + e-mail)
//   on the end date       -> company access closes (status "canceled"); admin is told about the 30 days to subscribe
//   30 days after the end -> the super admin gets a "Comunicados" message with two buttons
//                            (delete the company's data / keep it). Nothing is deleted here: only the button does.
// Called by pg_cron with the Vault secret (x-billing-cron), or manually by the super admin.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { esc, layout, mailerConfigured, sendMail } from '../_shared/mailer.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const SYSTEM_SENDER_ID = '00000000-0000-0000-0000-0000000000c1';
const ADMIN_COMPANY_ID = '00000000-0000-0000-0000-0000000000a1';
const GRACE_DAYS = 30;
const DAY = 864e5;
const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const headers = { 'Content-Type': 'application/json' };
const reply = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers });

async function companyAdmin(companyId: string) {
  const { data } = await admin.from('profiles').select('id, email, name').eq('company_id', companyId).eq('autonomy_level', 'admin').eq('is_active', true).order('created_at').limit(1).maybeSingle();
  return data as { id: string; email: string; name: string } | null;
}
async function dm(receiverId: string, companyId: string, content: string) {
  const { data, error } = await admin.from('direct_messages').insert({ sender_id: SYSTEM_SENDER_ID, receiver_id: receiverId, content, company_id: companyId }).select('id').single();
  if (error) throw error;
  return data.id as string;
}
async function tellCompanyAdmin(companyId: string, companyName: string, title: string, lines: string[]) {
  const target = await companyAdmin(companyId);
  if (!target) return 'sem administrador';
  await dm(target.id, companyId, `*${title}*\n\n${lines.join('\n\n')}`);
  if (target.email && mailerConfigured()) {
    const html = `<div style="background:#fff;border-radius:18px;padding:28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#18181b">
      <h2 style="margin:0 0 12px;font-size:20px">${esc(title)}</h2>
      ${lines.map((l) => `<p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#3f3f46">${esc(l)}</p>`).join('')}
      <p style="margin:16px 0 0;font-size:13px;color:#71717a">Empresa: <b>${esc(companyName)}</b></p></div>`;
    try { await sendMail({ to: target.email, subject: `ewvon · ${title}`, html: layout(html, title) }); } catch (e) { console.error('mail', e); }
  }
  return 'enviado';
}
async function superAdminProfile() {
  const { data: supers } = await admin.from('user_roles').select('user_id').eq('role', 'super_admin');
  const ids = (supers ?? []).map((r: any) => r.user_id);
  if (!ids.length) return null;
  const { data } = await admin.from('profiles').select('id').in('user_id', ids).eq('company_id', ADMIN_COMPANY_ID).order('created_at').limit(1).maybeSingle();
  return data as { id: string } | null;
}

async function run() {
  const out: Record<string, string> = {};
  const { data: subs } = await admin.from('company_subscriptions')
    .select('company_id, status, trial_ends_at, trial_notice_7d_for, trial_notice_expired_for, trial_deletion_asked_for')
    .in('status', ['trialing', 'canceled']).not('trial_ends_at', 'is', null);
  if (!subs?.length) return out;
  const { data: comps } = await admin.from('companies').select('id, name, is_system').in('id', subs.map((s: any) => s.company_id));
  const byId = new Map((comps ?? []).map((c: any) => [c.id, c]));
  const now = Date.now();
  for (const s of subs as any[]) {
    const comp: any = byId.get(s.company_id);
    if (!comp || comp.is_system) continue;
    try {
      const endsIso: string = s.trial_ends_at;
      const ends = new Date(endsIso).getTime();
      const daysLeft = Math.ceil((ends - now) / DAY);
      const deleteFrom = ends + GRACE_DAYS * DAY;
      // 1. Seven days before the end.
      if (s.status === 'trialing' && daysLeft > 0 && daysLeft <= 7 && s.trial_notice_7d_for !== endsIso) {
        const when = daysLeft === 1 ? 'amanhã' : `em ${daysLeft} dias`;
        out[comp.name] = '7d: ' + await tellCompanyAdmin(comp.id, comp.name, `O período de avaliação termina ${when}`, [
          `A avaliação gratuita do ewvon para a empresa ${comp.name} termina ${when} (${fmt(new Date(ends))}).`,
          'Para continuar usando o sistema sem perder nada, assine um plano antes dessa data: fale com a equipe ewvon pelo e-mail de suporte ou pelo chat.',
        ]);
        await admin.from('company_subscriptions').update({ trial_notice_7d_for: endsIso }).eq('company_id', s.company_id);
      }
      // 2. The end date: close access and explain the 30 days.
      if (now >= ends && s.trial_notice_expired_for !== endsIso) {
        if (s.status === 'trialing') await admin.from('company_subscriptions').update({ status: 'canceled', notes: 'Avaliação encerrada em ' + fmt(new Date(ends)) + '. Dados mantidos por 30 dias.' }).eq('company_id', s.company_id);
        out[comp.name] = 'fim: ' + await tellCompanyAdmin(comp.id, comp.name, 'O período de avaliação terminou', [
          `A avaliação gratuita da empresa ${comp.name} terminou em ${fmt(new Date(ends))} e o acesso aos recursos foi pausado.`,
          `Seus dados continuam guardados por ${GRACE_DAYS} dias, até ${fmt(new Date(deleteFrom))}. Se você assinar um plano até lá, tudo volta como estava.`,
          'Se não houver assinatura nesse prazo, os dados da empresa poderão ser excluídos definitivamente. Antes disso, entre em contato para exportar o que precisar.',
        ]);
        await admin.from('company_subscriptions').update({ trial_notice_expired_for: endsIso }).eq('company_id', s.company_id);
      }
      // 3. Thirty days later and still no plan: ask the super admin (two buttons).
      if (s.status === 'canceled' && now >= deleteFrom && s.trial_deletion_asked_for !== endsIso) {
        const sa = await superAdminProfile();
        if (!sa) { out[comp.name] = 'sem super admin'; continue; }
        const [{ count: people }, { data: used }] = await Promise.all([
          admin.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', comp.id),
          admin.rpc('company_storage_used', { _company_id: comp.id }),
        ]);
        const { data: reqRow, error } = await admin.from('company_deletion_requests').insert({ company_id: comp.id, company_name: comp.name, trial_ends_at: endsIso, people: people ?? 0, storage_bytes: Number(used) || 0 }).select('id').single();
        if (error) throw error;
        await dm(sa.id, ADMIN_COMPANY_ID, `*Excluir os dados de ${comp.name}?*\n\nA avaliação terminou em ${fmt(new Date(ends))} e já se passaram ${GRACE_DAYS} dias sem assinatura.\newvon-delete:${reqRow.id}`);
        await admin.from('company_subscriptions').update({ trial_deletion_asked_for: endsIso }).eq('company_id', s.company_id);
        out[comp.name] = 'pedido de exclusão enviado ao super admin';
      }
    } catch (e) { out[comp.name] = 'erro: ' + (e as Error).message; }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  let allowed = false;
  const secret = req.headers.get('x-billing-cron') || '';
  if (secret) { const { data } = await admin.rpc('billing_cron_secret_ok', { _secret: secret }); allowed = data === true; }
  if (!allowed) {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: u } = token ? await admin.auth.getUser(token) : { data: { user: null } } as any;
    if (u?.user) { const { data: r } = await admin.from('user_roles').select('role').eq('user_id', u.user.id).eq('role', 'super_admin').maybeSingle(); allowed = !!r; }
  }
  if (!allowed) return reply({ error: 'Unauthorized' }, 401);
  try { return reply({ ok: true, checked: await run() }); }
  catch (e) { console.error('trial-lifecycle', e); return reply({ error: 'Erro interno' }, 500); }
});
