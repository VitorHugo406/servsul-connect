// E-mails a new announcement (aviso) to every active user of the author's company,
// through the support Gmail account (see ../_shared/mailer.ts), with the ewvon signature.
// The announcement is read from the database (never trusted from the request body)
// and only its author can trigger the e-mail.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { esc, layout, sendBulk } from '../_shared/mailer.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const PRIORITY: Record<string, { label: string; color: string }> = {
  normal: { label: 'Aviso', color: '#18181b' },
  high: { label: 'Importante', color: '#d97706' },
  important: { label: 'Importante', color: '#d97706' },
  urgent: { label: 'Urgente', color: '#dc2626' },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) return json({ error: 'Unauthorized' }, 401)
    const { data: { user }, error: userError } = await admin.auth.getUser(token)
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json().catch(() => ({}))
    const announcementId = typeof body?.announcementId === 'string' ? body.announcementId : null
    if (!announcementId) return json({ error: 'announcementId obrigatório' }, 400)

    const { data: me } = await admin.from('profiles').select('id, company_id, name, display_name').eq('user_id', user.id).eq('is_active', true).maybeSingle()
    if (!me) return json({ error: 'Perfil não encontrado' }, 403)

    const { data: a } = await admin.from('announcements').select('id, title, content, priority, author_id, company_id, created_at').eq('id', announcementId).maybeSingle()
    if (!a || a.author_id !== me.id || a.company_id !== me.company_id) return json({ error: 'Aviso não encontrado' }, 404)
    if (Date.now() - new Date(a.created_at).getTime() > 15 * 60e3) return json({ error: 'Aviso antigo demais para disparo' }, 400)

    const [{ data: company }, { data: people }] = await Promise.all([
      admin.from('companies').select('name').eq('id', a.company_id).maybeSingle(),
      admin.from('profiles').select('email').eq('company_id', a.company_id).eq('is_active', true).neq('profile_type', 'bot'),
    ])
    const emails = (people || []).map((p: { email: string | null }) => p.email || '').filter(Boolean)
    if (!emails.length) return json({ error: 'Nenhum destinatário' }, 400)

    const p = PRIORITY[a.priority] || PRIORITY.normal
    const author = me.display_name || me.name || 'Administração'
    const companyName = company?.name || 'ewvon'
    const when = new Date(a.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const inner = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#ffffff;border-radius:20px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
  <tr><td style="padding:28px 28px 8px">
    <div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#71717a;font-weight:700">${esc(companyName)} · Avisos</div>
    <div style="margin-top:12px"><span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${p.color};color:#fff;font-size:12px;font-weight:700">${esc(p.label)}</span></div>
    <h1 style="margin:14px 0 0;font-size:24px;line-height:1.25;color:#09090b">${esc(a.title)}</h1>
  </td></tr>
  <tr><td style="padding:12px 28px 24px;color:#3f3f46;font-size:15px;line-height:1.65;white-space:pre-wrap">${esc(a.content)}</td></tr>
  <tr><td style="padding:16px 28px;border-top:1px solid #f4f4f5;color:#71717a;font-size:13px">Publicado por <b style="color:#18181b">${esc(author)}</b> · ${esc(when)}</td></tr>
</table>`
    const sent = await sendBulk(emails, { subject: `${p.label}: ${a.title}`, html: layout(inner, a.content.slice(0, 120)), fromName: companyName })
    return json({ success: true, count: sent })
  } catch (error) {
    console.error('Error sending announcement email:', error)
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
