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

    // Check if admin
    const userId = claims.claims.sub as string
    const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').single()
    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const { type, targetUserId } = body

    const resend = new Resend(resendApiKey)

    // Get active users with emails
    let targetProfiles: any[] = []

    if (type === 'individual' && targetUserId) {
      const { data } = await supabase.from('profiles').select('id, name, display_name, email').eq('id', targetUserId).single()
      if (data) targetProfiles = [data]
    } else if (type === 'all') {
      const { data } = await supabase.from('profiles').select('id, name, display_name, email').eq('is_active', true)
      targetProfiles = data || []
    }

    if (targetProfiles.length === 0) {
      return new Response(JSON.stringify({ error: 'No recipients found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get system settings for company name
    const companyName = 'Grupo Servsul'
    const currentMonth = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
        <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:16px 16px 0 0;padding:40px 32px;text-align:center;">
          <h1 style="color:white;margin:0;font-size:28px;font-weight:700;">ServChat</h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">${companyName}</p>
        </div>
        <div style="background:white;border-radius:0 0 16px 16px;padding:32px;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
          <h2 style="color:#1f2937;margin:0 0 16px;font-size:22px;">📊 Feedback Mensal — ${currentMonth}</h2>
          <p style="color:#4b5563;line-height:1.6;margin:0 0 24px;">
            Olá! Este é o seu feedback mensal do ServChat. Acompanhe sua participação e contribuição para a equipe.
          </p>
          <div style="background:#f8fafc;border-radius:12px;padding:24px;margin:0 0 24px;border:1px solid #e2e8f0;">
            <h3 style="color:#374151;margin:0 0 12px;font-size:16px;">📌 Dicas para este mês:</h3>
            <ul style="color:#4b5563;margin:0;padding:0 0 0 20px;line-height:1.8;">
              <li>Mantenha suas tarefas atualizadas no quadro Kanban</li>
              <li>Responda mensagens pendentes no chat</li>
              <li>Confira os avisos importantes publicados</li>
              <li>Atualize seu status de presença</li>
            </ul>
          </div>
          <div style="text-align:center;padding:16px 0;">
            <p style="color:#9ca3af;font-size:12px;margin:0;">
              Este e-mail foi enviado automaticamente pelo sistema ServChat.<br>
              © ${new Date().getFullYear()} ${companyName}. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>`

    const emails = targetProfiles.map(p => p.email).filter(Boolean)

    if (emails.length === 1) {
      const { error } = await resend.emails.send({
        from: 'ServChat <onboarding@resend.dev>',
        to: emails,
        subject: `📊 Feedback Mensal — ${currentMonth}`,
        html: emailHtml,
      })
      if (error) throw error
    } else {
      // Send single email with all recipients in BCC
      const { error } = await resend.emails.send({
        from: 'ServChat <onboarding@resend.dev>',
        to: ['onboarding@resend.dev'],
        bcc: emails,
        subject: `📊 Feedback Mensal — ${currentMonth}`,
        html: emailHtml,
      })
      if (error) throw error
    }

    console.log(`Feedback email sent to ${emails.length} recipient(s)`)

    return new Response(JSON.stringify({ success: true, count: emails.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    console.error('Error sending feedback email:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
