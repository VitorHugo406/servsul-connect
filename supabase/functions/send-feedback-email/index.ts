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
      const { data } = await supabase.from('profiles').select('id, user_id, name, display_name, email').eq('id', targetUserId).single()
      if (data) targetProfiles = [data]
    } else if (type === 'all') {
      const { data } = await supabase.from('profiles').select('id, user_id, name, display_name, email').eq('is_active', true)
      targetProfiles = data || []
    }

    if (targetProfiles.length === 0) {
      return new Response(JSON.stringify({ error: 'No recipients found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const companyName = 'Grupo Servsul'
    const currentMonth = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

    // Calculate date range for current month
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

    let sentCount = 0
    const errors: string[] = []

    for (const profile of targetProfiles) {
      try {
        // Fetch user stats for this month
        // 1. Messages sent (sector messages)
        const { count: sectorMsgCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('author_id', profile.id)
          .gte('created_at', startOfMonth)
          .lte('created_at', endOfMonth)

        // 2. Direct messages sent
        const { count: dmCount } = await supabase
          .from('direct_messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender_id', profile.id)
          .gte('created_at', startOfMonth)
          .lte('created_at', endOfMonth)

        // 3. Tasks assigned and completed
        const { data: tasksData } = await supabase
          .from('tasks')
          .select('id, status, completed_at, completed_late, due_date')
          .eq('assigned_to', profile.id)

        const totalTasks = tasksData?.length || 0
        const completedTasks = tasksData?.filter(t => t.completed_at)?.length || 0
        const lateTasks = tasksData?.filter(t => t.completed_late === true)?.length || 0
        const overdueTasks = tasksData?.filter(t => {
          if (t.completed_at) return false
          if (!t.due_date) return false
          return new Date(t.due_date) < now
        })?.length || 0

        const totalMessages = (sectorMsgCount || 0) + (dmCount || 0)
        const displayName = profile.display_name || profile.name

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
              <h2 style="color:#1f2937;margin:0 0 8px;font-size:22px;">📊 Feedback Mensal — ${currentMonth}</h2>
              <p style="color:#4b5563;line-height:1.6;margin:0 0 24px;">
                Olá, <strong>${displayName}</strong>! Aqui está o resumo da sua atividade este mês.
              </p>
              
              <!-- Stats Grid -->
              <div style="display:flex;flex-wrap:wrap;gap:12px;margin:0 0 24px;">
                <div style="flex:1;min-width:120px;background:#f0fdf4;border-radius:12px;padding:16px;text-align:center;border:1px solid #bbf7d0;">
                  <p style="color:#16a34a;font-size:28px;font-weight:700;margin:0;">${totalMessages}</p>
                  <p style="color:#4b5563;font-size:12px;margin:4px 0 0;">Mensagens Enviadas</p>
                </div>
                <div style="flex:1;min-width:120px;background:#eff6ff;border-radius:12px;padding:16px;text-align:center;border:1px solid #bfdbfe;">
                  <p style="color:#2563eb;font-size:28px;font-weight:700;margin:0;">${completedTasks}/${totalTasks}</p>
                  <p style="color:#4b5563;font-size:12px;margin:4px 0 0;">Tarefas Concluídas</p>
                </div>
              </div>

              <div style="display:flex;flex-wrap:wrap;gap:12px;margin:0 0 24px;">
                <div style="flex:1;min-width:120px;background:#fef2f2;border-radius:12px;padding:16px;text-align:center;border:1px solid #fecaca;">
                  <p style="color:#dc2626;font-size:28px;font-weight:700;margin:0;">${lateTasks}</p>
                  <p style="color:#4b5563;font-size:12px;margin:4px 0 0;">Entregas com Atraso</p>
                </div>
                <div style="flex:1;min-width:120px;background:#fff7ed;border-radius:12px;padding:16px;text-align:center;border:1px solid #fed7aa;">
                  <p style="color:#ea580c;font-size:28px;font-weight:700;margin:0;">${overdueTasks}</p>
                  <p style="color:#4b5563;font-size:12px;margin:4px 0 0;">Tarefas Pendentes Atrasadas</p>
                </div>
              </div>

              <div style="background:#f8fafc;border-radius:12px;padding:24px;margin:0 0 24px;border:1px solid #e2e8f0;">
                <h3 style="color:#374151;margin:0 0 12px;font-size:16px;">📌 Dicas para o próximo mês:</h3>
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

        const recipientEmail = profile.email
        if (!recipientEmail) {
          console.log(`Skipping user ${profile.name}: no email`)
          continue
        }

        // Without a verified domain, onboarding@resend.dev can only send to gmail.com addresses
        const isGmail = recipientEmail.toLowerCase().endsWith('@gmail.com')
        if (!isGmail) {
          console.log(`Skipping ${recipientEmail}: not gmail.com (needs verified domain)`)
          errors.push(`${profile.name}: e-mail ${recipientEmail} requer domínio verificado`)
          continue
        }

        const { error: sendError } = await resend.emails.send({
          from: 'ServChat <onboarding@resend.dev>',
          to: [recipientEmail],
          subject: `📊 Feedback Mensal — ${currentMonth}`,
          html: emailHtml,
        })

        if (sendError) {
          console.error(`Error sending to ${recipientEmail}:`, sendError)
          errors.push(`${profile.name}: ${sendError.message || 'send error'}`)
        } else {
          sentCount++
          console.log(`Feedback email sent to ${recipientEmail}`)
        }
      } catch (userError) {
        console.error(`Error processing user ${profile.name}:`, userError)
        errors.push(`${profile.name}: ${userError instanceof Error ? userError.message : 'unknown'}`)
      }
    }

    console.log(`Feedback email sent to ${sentCount}/${targetProfiles.length} recipient(s). Errors: ${errors.length}`)

    return new Response(JSON.stringify({ 
      success: true, 
      count: sentCount,
      total: targetProfiles.length,
      errors: errors.length > 0 ? errors : undefined
    }), {
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
