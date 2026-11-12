// Public e-mail confirmation for the self-service signup (/assinar).
//   POST { action: 'send', email }          -> sends a 6-digit code (valid 10 min)
//   POST { action: 'verify', email, code }  -> marks the e-mail as confirmed (valid 1 h for the signup)
// The signup itself is blocked in the database (trigger on company_signups) unless the e-mail was confirmed.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { esc, layout, mailerConfigured, sendMail } from '../_shared/mailer.ts';

const SITE_URL = (Deno.env.get('SITE_URL') || 'https://ewvon.vercel.app').replace(/\/+$/, '');
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && (origin === SITE_URL || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) ? origin : SITE_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});
const enc = new TextEncoder();
const sha256 = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const hits = new Map<string, number[]>();
const limited = (key: string, max: number, windowMs = 10 * 60_000) => {
  const now = Date.now(); const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now); hits.set(key, list); return list.length > max;
};

const cnpjOk = (v: string) => {
  const d = v.replace(/\D/g, ''); if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: number) => { let sum = 0, pos = len - 7; for (let i = len; i >= 1; i--) { sum += Number(d[len - i]) * pos--; if (pos < 2) pos = 9; } const r = sum % 11; return r < 2 ? 0 : 11 - r; };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
};
const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get('Origin')), 'Content-Type': 'application/json' };
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return reply({ error: 'Método não permitido' }, 405);
  try {
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 160) : '';
    if (!EMAIL_RE.test(email)) return reply({ error: 'Informe um e-mail válido.' }, 400);

    if (body.action === 'send') {
      if (limited(ip, 12)) return reply({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' }, 429);
      if (!mailerConfigured()) return reply({ error: 'O envio de e-mail está indisponível agora. Tente novamente mais tarde.' }, 503);
      const { data: used } = await admin.from('profiles').select('id').ilike('email', email).limit(1);
      if (used?.length) return reply({ error: 'Este e-mail já tem uma conta no ewvon. Use outro e-mail para o administrador.' }, 409);
      const { data: row } = await admin.from('signup_email_codes').select('*').eq('email', email).maybeSingle();
      const now = Date.now();
      if (row) {
        if (now - new Date(row.last_sent_at).getTime() < 45_000) return reply({ error: 'Aguarde alguns segundos para pedir um novo código.' }, 429);
        const inWindow = now - new Date(row.sends_window_start).getTime() < 3_600_000;
        if (inWindow && row.sends >= 5) return reply({ error: 'Muitos códigos pedidos para este e-mail. Tente novamente em 1 hora.' }, 429);
      }
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
      const fresh = !row || now - new Date(row.sends_window_start).getTime() >= 3_600_000;
      const { error: upErr } = await admin.from('signup_email_codes').upsert({
        email, code_hash: await sha256(`${code}:${email}`), expires_at: new Date(now + 10 * 60_000).toISOString(), attempts: 0,
        sends: fresh ? 1 : (row!.sends + 1), sends_window_start: fresh ? new Date(now).toISOString() : row!.sends_window_start,
        last_sent_at: new Date(now).toISOString(), verified_at: null,
      }, { onConflict: 'email' });
      if (upErr) { console.error(upErr); return reply({ error: 'Não foi possível enviar o código agora.' }, 500); }
      try {
        await sendMail({ to: email, subject: `ewvon · seu código de confirmação: ${code}`, html: layout(
          `<div style="background:#fff;border-radius:18px;padding:28px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#18181b">
            <h2 style="margin:0 0 8px;font-size:20px">Confirme seu e-mail</h2>
            <p style="margin:0 0 18px;font-size:14px;color:#52525b">Use este código para continuar a criação da sua empresa no ewvon. Ele vale por 10 minutos.</p>
            <div style="font-size:34px;font-weight:700;letter-spacing:8px;text-align:center;background:#f4f4f5;border-radius:12px;padding:16px 0">${esc(code)}</div>
            <p style="margin:18px 0 0;font-size:12px;color:#71717a">Se você não pediu isso, ignore este e-mail. Ninguém terá acesso à sua conta.</p>
          </div>`, `Seu código: ${code}`) });
      } catch (e) { console.error('mail', e); return reply({ error: 'Não foi possível enviar o e-mail. Confira o endereço e tente de novo.' }, 502); }
      return reply({ ok: true });
    }

    if (body.action === 'verify') {
      if (limited(ip + ':v', 30)) return reply({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' }, 429);
      const code = typeof body.code === 'string' ? body.code.replace(/\D/g, '') : '';
      if (code.length !== 6) return reply({ error: 'Digite os 6 dígitos do código.' }, 400);
      const { data: row } = await admin.from('signup_email_codes').select('*').eq('email', email).maybeSingle();
      if (!row) return reply({ error: 'Peça um código para este e-mail.' }, 404);
      if (new Date(row.expires_at).getTime() < Date.now()) return reply({ error: 'O código venceu. Peça um novo.' }, 410);
      if (row.attempts >= 5) return reply({ error: 'Muitas tentativas erradas. Peça um novo código.' }, 429);
      if (row.code_hash !== await sha256(`${code}:${email}`)) {
        await admin.from('signup_email_codes').update({ attempts: row.attempts + 1 }).eq('email', email);
        return reply({ error: 'Código incorreto.' }, 400);
      }
      await admin.from('signup_email_codes').update({ verified_at: new Date().toISOString(), attempts: 0 }).eq('email', email);
      return reply({ ok: true });
    }
    if (body.action === 'company') {
      if (limited(ip + ':c', 20)) return reply({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' }, 429);
      const { data: row } = await admin.from('signup_email_codes').select('verified_at').eq('email', email).maybeSingle();
      if (!row?.verified_at || Date.now() - new Date(row.verified_at).getTime() > 3_300_000) return reply({ error: 'Confirme o e-mail novamente para continuar.' }, 403);
      const c = body.data || {};
      const out = {
        legal_name: txt(c.legal_name, 120), cnpj: txt(c.cnpj, 20).replace(/\D/g, ''), phone: txt(c.phone, 20).replace(/\D/g, ''),
        zip: txt(c.zip, 12).replace(/\D/g, ''), street: txt(c.street, 120), number: txt(c.number, 12), complement: txt(c.complement, 60),
        district: txt(c.district, 80), city: txt(c.city, 80), state: txt(c.state, 2).toUpperCase(),
      };
      if (out.legal_name.length < 3) return reply({ error: 'Informe a razão social (nome da empresa).' }, 400);
      if (!cnpjOk(out.cnpj)) return reply({ error: 'CNPJ inválido. Confira os números.' }, 400);
      if (out.zip.length !== 8) return reply({ error: 'Informe o CEP com 8 números.' }, 400);
      if (out.street.length < 3 || !out.number || out.district.length < 2 || out.city.length < 2) return reply({ error: 'Preencha o endereço completo da empresa.' }, 400);
      if (!UFS.includes(out.state)) return reply({ error: 'Informe a UF (ex.: SP).' }, 400);
      if (out.phone && (out.phone.length < 10 || out.phone.length > 11)) return reply({ error: 'Telefone inválido. Use DDD + número.' }, 400);
      const { error } = await admin.from('signup_email_codes').update({ company_data: out }).eq('email', email);
      if (error) { console.error(error); return reply({ error: 'Não foi possível salvar os dados da empresa.' }, 500); }
      return reply({ ok: true });
    }
    return reply({ error: 'Pedido inválido' }, 400);
  } catch (e) { console.error(e); return reply({ error: 'Erro inesperado. Tente novamente.' }, 500); }
});
