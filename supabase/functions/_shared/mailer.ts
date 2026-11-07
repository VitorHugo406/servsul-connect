// Outgoing e-mail for every edge function: plain SMTP with the support Gmail account
// (no custom domain needed, unlike Resend). Every message gets the ewvon signature.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   GMAIL_APP_PASSWORD  app password of ewvonsuporte@gmail.com (Google account → Security → App passwords)
//   GMAIL_USER          optional, defaults to ewvonsuporte@gmail.com
// Port 465 (implicit TLS) is used because Supabase blocks outbound 25/587.
import nodemailer from 'npm:nodemailer@6.9.16'

export const SUPPORT_EMAIL = 'ewvonsuporte@gmail.com'
const LOGO_URL = Deno.env.get('EWVON_LOGO_URL') || 'https://ewvon.vercel.app/ewwon/img/logo-full.png'

export const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

export interface MailAttachment { filename: string; content: Uint8Array | string; contentType?: string }
export interface Mail {
  to?: string | string[]
  bcc?: string | string[]
  subject: string
  /** Inner HTML of the message; the signature is appended automatically. */
  html: string
  text?: string
  replyTo?: string
  attachments?: MailAttachment[]
  /** Name shown as the sender, e.g. the company name. */
  fromName?: string
}

let transport: ReturnType<typeof nodemailer.createTransport> | null = null
function getTransport() {
  const pass = Deno.env.get('GMAIL_APP_PASSWORD')?.replace(/\s+/g, '')
  if (!pass) throw new Error('GMAIL_APP_PASSWORD não configurada nas secrets das Edge Functions')
  if (!transport) {
    transport = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: Deno.env.get('GMAIL_USER') || SUPPORT_EMAIL, pass },
      pool: true, maxConnections: 2, maxMessages: 50,
    })
  }
  return transport
}

export const mailerConfigured = () => !!Deno.env.get('GMAIL_APP_PASSWORD')

/** The ewvon signature added to every e-mail. */
export function signatureHtml() {
  const year = new Date().getFullYear()
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-collapse:collapse">
  <tr><td style="background:#0b0b0e;border-radius:18px;padding:22px 24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
      <td style="vertical-align:middle"><img src="${LOGO_URL}" alt="ewvon" width="150" style="display:block;width:150px;height:auto;border:0"></td>
      <td style="vertical-align:middle;text-align:right;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
        <div style="color:#ffffff;font-size:13px;font-weight:700">Equipe ewvon</div>
        <div style="color:#a1a1aa;font-size:12px;margin-top:2px">Suporte e comunicação</div>
        <a href="mailto:${SUPPORT_EMAIL}" style="color:#d4d4d8;font-size:12px;text-decoration:none">${SUPPORT_EMAIL}</a>
      </td>
    </tr></table>
    <div style="border-top:1px solid #27272a;margin-top:16px;padding-top:12px;color:#71717a;font-size:11px;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
      Mensagem automática enviada pelo ewvon · Gestão corporativa. Dúvidas? Responda este e-mail ou escreva para ${SUPPORT_EMAIL}.<br>© ${year} ewvon. Todos os direitos reservados.
    </div>
  </td></tr>
</table>`
}

/** Wraps any inner HTML in the standard ewvon layout with the signature. */
export function layout(inner: string, preheader = '') {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;border-collapse:collapse"><tr><td align="center" style="padding:32px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;border-collapse:collapse"><tr><td>
${inner}
${signatureHtml()}
</td></tr></table>
</td></tr></table></body></html>`
}

const plain = (html: string) => html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|h\d)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\n{3,}/g, '\n\n').trim()

export async function sendMail(m: Mail) {
  const html = /<html/i.test(m.html) ? m.html.replace(/<\/body>/i, `${m.html.includes(LOGO_URL) ? '' : signatureHtml()}</body>`) : layout(m.html)
  const user = Deno.env.get('GMAIL_USER') || SUPPORT_EMAIL
  const info = await getTransport().sendMail({
    from: { name: m.fromName ? `${m.fromName} · ewvon` : 'ewvon', address: user },
    to: m.to, bcc: m.bcc, subject: m.subject, replyTo: m.replyTo || SUPPORT_EMAIL,
    html,
    text: (m.text || plain(html)) + `\n\n--\nEquipe ewvon · Suporte e comunicação\n${SUPPORT_EMAIL}`,
    attachments: [
      ...(m.attachments || []).map((a) => ({ filename: a.filename, content: typeof a.content === 'string' ? a.content : new Uint8Array(a.content), contentType: a.contentType })),
    ],
  })
  return info.messageId as string
}

/** Sends the same message to many people in BCC batches (Gmail accepts up to 100 recipients per message). */
export async function sendBulk(recipients: string[], m: Omit<Mail, 'to' | 'bcc'>, batch = 50) {
  const list = [...new Set(recipients.map((e) => e.trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))]
  let sent = 0
  for (let i = 0; i < list.length; i += batch) {
    const part = list.slice(i, i + batch)
    await sendMail({ ...m, to: Deno.env.get('GMAIL_USER') || SUPPORT_EMAIL, bcc: part })
    sent += part.length
  }
  return sent
}
