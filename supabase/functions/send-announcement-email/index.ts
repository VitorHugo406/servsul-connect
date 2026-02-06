import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend@4.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Auth check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const token = authHeader.replace('Bearer ', '')
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(token)
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const { title, content, priority, authorName } = body

    const resend = new Resend(resendApiKey)

    // Get all active users' emails
    const { data: profiles } = await supabase.from('profiles').select('email').eq('is_active', true)
    const emails = (profiles || []).map(p => p.email).filter(Boolean)

    if (emails.length === 0) {
      return new Response(JSON.stringify({ error: 'No recipients' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const priorityLabel: Record<string, string> = { normal: 'Normal', important: '⚠️ Importante', urgent: '🚨 Urgente' }
    const priorityColor: Record<string, string> = { normal: '#6366f1', important: '#f59e0b', urgent: '#ef4444' }
    const pLabel = priorityLabel[priority] || 'Normal'
    const pColor = priorityColor[priority] || '#6366f1'

    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
        <div style="background:linear-gradient(135deg,${pColor},${pColor}dd);border-radius:16px 16px 0 0;padding:40px 32px;text-align:center;">
          <h1 style="color:white;margin:0;font-size:28px;font-weight:700;">📢 Novo Aviso</h1>
          <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">ServChat — Grupo Servsul</p>
        </div>
        <div style="background:white;border-radius:0 0 16px 16px;padding:32px;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
          <div style="display:inline-block;background:${pColor}15;color:${pColor};font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;border:1px solid ${pColor}30;margin:0 0 16px;">
            ${pLabel}
          </div>
          <h2 style="color:#1f2937;margin:0 0 16px;font-size:22px;font-weight:700;">${title}</h2>
          <div style="color:#4b5563;line-height:1.7;margin:0 0 24px;font-size:15px;white-space:pre-wrap;">${content}</div>
          <div style="border-top:1px solid #e5e7eb;padding-top:16px;display:flex;align-items:center;gap:12px;">
            <div style="width:36px;height:36px;border-radius:50%;background:${pColor};display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;">
              ${(authorName || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <p style="margin:0;color:#374151;font-size:14px;font-weight:600;">${authorName || 'Administrador'}</p>
              <p style="margin:0;color:#9ca3af;font-size:12px;">${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        </div>
        <div style="text-align:center;padding:24px 0;">
          <p style="color:#9ca3af;font-size:11px;margin:0;">
            Este e-mail foi enviado automaticamente pelo ServChat.<br>
            © ${new Date().getFullYear()} Grupo Servsul. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </body>
    </html>`

    // Send single email with all in BCC
    const { error } = await resend.emails.send({
      from: 'ServChat <onboarding@resend.dev>',
      to: ['noreply@servsul.com.br'],
      bcc: emails,
      subject: `📢 ${pLabel}: ${title}`,
      html: emailHtml,
    })

    if (error) throw error

    console.log(`Announcement email sent to ${emails.length} recipients for: ${title}`)

    return new Response(JSON.stringify({ success: true, count: emails.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    console.error('Error sending announcement email:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
