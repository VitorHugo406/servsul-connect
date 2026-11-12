// Payment receipts: builds the PDF (ewvon logo) and e-mails it with the company registration data.
// Called by a trigger on company_payments (right after a payment is recorded) and by a 10-minute sweep
// that retries the ones not delivered. Auth: the billing cron secret header (Vault).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { esc, layout, mailerConfigured, sendMail } from './mailer.ts';
import { brl, buildReceiptPdf } from './receipt-pdf.ts';

const SITE_URL = (Deno.env.get('SITE_URL') || 'https://ewvon.vercel.app').replace(/\/+$/, '');
const ISSUER = { brand: 'ewvon', owner: 'Vitor Hugo Almeida Santos', place: 'São Paulo/SP', email: 'ewvonsuporte@gmail.com' };
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

const fmtCnpj = (v: string) => v.replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const fmtCep = (v: string) => v.replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2');
const fmtPhone = (v: string) => { const d = v.replace(/\D/g, ''); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : v; };

let logo: Uint8Array | null | undefined;
async function loadLogo() {
  if (logo !== undefined) return logo;
  try { const r = await fetch(`${SITE_URL}/ewwon/img/receipt-logo.png`); logo = r.ok ? new Uint8Array(await r.arrayBuffer()) : null; } catch { logo = null; }
  return logo;
}

async function sendReceipt(paymentId: string): Promise<string> {
  const { data: pay } = await admin.from('company_payments').select('*').eq('id', paymentId).maybeSingle();
  if (!pay) return 'pagamento não encontrado';
  if (pay.receipt_sent_at) return 'já enviado';
  if ((pay.receipt_attempts || 0) >= 5) return 'tentativas esgotadas';
  await admin.from('company_payments').update({ receipt_attempts: (pay.receipt_attempts || 0) + 1 }).eq('id', pay.id);
  const { data: company } = await admin.from('companies').select('id, name, slug, billing_data').eq('id', pay.company_id).maybeSingle();
  if (!company) return 'empresa não encontrada';
  const { data: signup } = await admin.from('company_signups').select('admin_email, admin_name, company_data, plan_id').eq('company_id', company.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
  const data = (company.billing_data || signup?.company_data || {}) as Record<string, string>;
  let to = signup?.admin_email || '';
  if (!to) {
    const { data: admins } = await admin.from('profiles').select('email, user_id').eq('company_id', company.id).eq('autonomy_level', 'admin').eq('is_active', true).limit(1);
    to = admins?.[0]?.email || '';
  }
  if (!to) return 'sem destinatário';
  if (!mailerConfigured()) return 'e-mail não configurado';

  const number = 'REC-' + String(pay.receipt_number || 0).padStart(6, '0');
  const addr = [
    data.street ? `${data.street}, ${data.number || 's/n'}${data.complement ? ' - ' + data.complement : ''}` : '',
    data.district || '',
    data.city ? `${data.city}${data.state ? '/' + data.state : ''}${data.zip ? ' - CEP ' + fmtCep(data.zip) : ''}` : '',
    data.phone ? 'Tel. ' + fmtPhone(data.phone) : '',
  ].filter(Boolean);
  const customer = { name: company.name, legalName: data.legal_name || company.name, cnpj: data.cnpj ? fmtCnpj(data.cnpj) : '', lines: addr, adminEmail: to };
  const pdf = await buildReceiptPdf({
    number, paidAt: new Date(pay.paid_at), paymentId: pay.provider_payment_id || '',
    items: [{ description: pay.description || 'Serviço ewvon', qty: 1, unitCents: pay.amount_cents }],
    customer, issuer: ISSUER, logoPng: await loadLogo(),
  });

  const row = (k: string, v: string) => v ? `<tr><td style="padding:5px 0;color:#71717a;font-size:13px;width:150px;vertical-align:top">${esc(k)}</td><td style="padding:5px 0;font-size:13px;font-weight:600;color:#18181b">${esc(v)}</td></tr>` : '';
  const isSignup = pay.kind === 'signup';
  const html = layout(`<div style="background:#fff;border-radius:18px;padding:28px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#18181b">
    <div style="display:inline-block;background:#dbe4f5;color:#14264a;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700">Pagamento confirmado</div>
    <h2 style="margin:14px 0 6px;font-size:22px">${isSignup ? 'Sua empresa está no ewvon!' : 'Recebemos o seu pagamento'}</h2>
    <p style="margin:0 0 18px;font-size:14px;color:#52525b">${isSignup ? `Obrigado por assinar. O pagamento de <b>${esc(brl(pay.amount_cents))}</b> foi confirmado e o acesso já está liberado.` : `Obrigado! O pagamento de <b>${esc(brl(pay.amount_cents))}</b> foi confirmado.`} O recibo em PDF está anexado a este e-mail.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border-top:1px solid #e4e4e7;border-bottom:1px solid #e4e4e7;margin-bottom:18px">
      ${row('Recibo', number)}${row('Descrição', pay.description || '')}${row('Valor', brl(pay.amount_cents))}${row('Pagamento (ID)', pay.provider_payment_id || '')}
    </table>
    ${isSignup ? `<div style="font-size:12px;font-weight:700;color:#14264a;letter-spacing:.04em;margin-bottom:4px">CADASTRO DA EMPRESA</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:18px">
      ${row('Razão social', customer.legalName)}${row('CNPJ', customer.cnpj)}${row('Endereço', addr.join(' · '))}${row('Nome no ewvon', company.name)}${row('Administrador', [signup?.admin_name, to].filter(Boolean).join(' · '))}
    </table>
    <a href="${SITE_URL}/auth?company=${encodeURIComponent(company.slug)}" style="display:inline-block;background:#14264a;color:#fff;text-decoration:none;border-radius:10px;padding:11px 20px;font-size:14px;font-weight:600">Entrar no ewvon</a>` : ''}
    <p style="margin:18px 0 0;font-size:12px;color:#71717a">Este recibo comprova o pagamento e não substitui nota fiscal. Guarde-o para o seu controle.</p>
  </div>`, `Recibo ${number} · ${brl(pay.amount_cents)}`);

  await sendMail({ to, subject: `ewvon · Recibo ${number} · pagamento confirmado`, html, attachments: [{ filename: `Recibo-ewvon-${number}.pdf`, content: pdf, contentType: 'application/pdf' }] });
  await admin.from('company_payments').update({ receipt_sent_at: new Date().toISOString() }).eq('id', pay.id);
  return 'enviado';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const { data: ok } = await admin.rpc('billing_cron_secret_ok', { _secret: req.headers.get('x-billing-cron') || '' });
  if (ok !== true) return json({ error: 'Unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  try {
    if (typeof body.payment_id === 'string') return json({ result: await sendReceipt(body.payment_id) });
    if (body.sweep) {
      const { data: list } = await admin.from('company_payments').select('id').is('receipt_sent_at', null).lt('receipt_attempts', 5)
        .gt('paid_at', new Date(Date.now() - 7 * 864e5).toISOString()).lt('paid_at', new Date(Date.now() - 2 * 60_000).toISOString()).limit(20);
      const out: Record<string, string> = {};
      for (const p of list || []) { try { out[p.id] = await sendReceipt(p.id); } catch (e) { out[p.id] = 'erro: ' + (e instanceof Error ? e.message : String(e)); } }
      return json({ swept: out });
    }
    return json({ error: 'Pedido inválido' }, 400);
  } catch (e) { console.error('receipt', e); return json({ error: e instanceof Error ? e.message : String(e) }, 500); }
});
