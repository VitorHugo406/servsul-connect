import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend@4.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const MONTH_NAMES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const MONTH_NAMES_DISPLAY = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function getBrazilNow() {
  // Deno runs in UTC. Subtract 3 hours for Brazil (UTC-3)
  const now = new Date()
  const brMs = now.getTime() - (3 * 60 * 60 * 1000)
  return new Date(brMs)
}

function formatBrDate(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const year = d.getUTCFullYear()
  const hour = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} ${hour}:${min}`
}

function getCurrentMonthLabel(d: Date): string {
  return `${MONTH_NAMES_DISPLAY[d.getUTCMonth()]} de ${d.getUTCFullYear()}`
}

function sanitize(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{FE00}-\u{FEFF}]/gu, '')
    .replace(/[\u{200B}-\u{200F}]/gu, '')
    .replace(/[\u{2000}-\u{206F}]/gu, '')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '')
    .trim()
}

async function getAdminProfileId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single()
  if (error || !data) throw new Error('Could not find admin profile')
  return data.id
}

function generateRecommendations(stats: { totalMessages: number; completedTasks: number; totalTasks: number; lateTasks: number; overdueTasks: number }): string[] {
  const recs: string[] = []
  if (stats.totalMessages < 5) {
    recs.push('Sua participacao nas conversas foi baixa este mes. Tente interagir mais com a equipe para manter a comunicacao fluida.')
  } else if (stats.totalMessages > 50) {
    recs.push('Excelente nivel de comunicacao! Continue mantendo esse engajamento com a equipe.')
  }
  if (stats.totalTasks > 0) {
    const rate = stats.completedTasks / stats.totalTasks
    if (rate >= 0.9) recs.push('Parabens! Sua taxa de conclusao de tarefas esta excelente. Continue assim!')
    else if (rate >= 0.6) recs.push('Sua taxa de conclusao de tarefas esta boa, mas ha espaco para melhoria.')
    else recs.push('Sua taxa de conclusao de tarefas esta abaixo do ideal. Considere revisar suas prioridades.')
  } else {
    recs.push('Nenhuma tarefa foi atribuida a voce este mes. Verifique com seu supervisor se ha atividades pendentes.')
  }
  if (stats.lateTasks > 0) recs.push(`Voce teve ${stats.lateTasks} entrega(s) com atraso. Planeje melhor os prazos.`)
  if (stats.overdueTasks > 0) recs.push(`Existem ${stats.overdueTasks} tarefa(s) pendentes e atrasadas. Priorize resolve-las.`)
  if (stats.lateTasks === 0 && stats.overdueTasks === 0 && stats.totalTasks > 0) recs.push('Nenhuma tarefa atrasada! Otima gestao de tempo.')
  return recs
}

function buildChatMessage(displayName: string, stats: any, recommendations: string[], currentMonth: string, pdfUrl?: string): string {
  const rate = stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0
  let msg = `*Feedback Mensal - ${currentMonth}*\n\n`
  msg += `Ola, *${displayName}*! Aqui esta o seu resumo mensal:\n\n`
  msg += `Mensagens enviadas: *${stats.totalMessages}*\n`
  msg += `Tarefas concluidas: *${stats.completedTasks}/${stats.totalTasks}* (${rate}%)\n`
  msg += `Entregas com atraso: *${stats.lateTasks}*\n`
  msg += `Pendencias atrasadas: *${stats.overdueTasks}*\n\n`
  if (recommendations.length > 0) {
    msg += `*Recomendacoes:*\n`
    recommendations.forEach(r => { msg += `_${r}_\n` })
  }
  if (pdfUrl) msg += `\n[Relatorio PDF - ${currentMonth}](${pdfUrl})`
  msg += `\n\n_Mensagem automatica do ServChat_`
  return msg
}

function buildEmailHtml(displayName: string, stats: any, recommendations: string[], currentMonth: string, companyName: string): string {
  const rate = stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:16px 16px 0 0;padding:40px 32px;text-align:center;">
      <h1 style="color:white;margin:0;font-size:28px;font-weight:700;">ServChat</h1>
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">${companyName}</p>
    </div>
    <div style="background:white;border-radius:0 0 16px 16px;padding:32px;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
      <h2 style="color:#1f2937;margin:0 0 8px;font-size:22px;">Feedback Mensal - ${currentMonth}</h2>
      <p style="color:#4b5563;line-height:1.6;margin:0 0 24px;">Ola, <strong>${displayName}</strong>! Aqui esta o resumo da sua atividade este mes.</p>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin:0 0 24px;">
        <div style="flex:1;min-width:120px;background:#f0fdf4;border-radius:12px;padding:16px;text-align:center;border:1px solid #bbf7d0;">
          <p style="color:#16a34a;font-size:28px;font-weight:700;margin:0;">${stats.totalMessages}</p>
          <p style="color:#4b5563;font-size:12px;margin:4px 0 0;">Mensagens Enviadas</p>
        </div>
        <div style="flex:1;min-width:120px;background:#eff6ff;border-radius:12px;padding:16px;text-align:center;border:1px solid #bfdbfe;">
          <p style="color:#2563eb;font-size:28px;font-weight:700;margin:0;">${stats.completedTasks}/${stats.totalTasks}</p>
          <p style="color:#4b5563;font-size:12px;margin:4px 0 0;">Tarefas Concluidas</p>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin:0 0 24px;">
        <div style="flex:1;min-width:120px;background:#fef2f2;border-radius:12px;padding:16px;text-align:center;border:1px solid #fecaca;">
          <p style="color:#dc2626;font-size:28px;font-weight:700;margin:0;">${stats.lateTasks}</p>
          <p style="color:#4b5563;font-size:12px;margin:4px 0 0;">Entregas com Atraso</p>
        </div>
        <div style="flex:1;min-width:120px;background:#fff7ed;border-radius:12px;padding:16px;text-align:center;border:1px solid #fed7aa;">
          <p style="color:#ea580c;font-size:28px;font-weight:700;margin:0;">${stats.overdueTasks}</p>
          <p style="color:#4b5563;font-size:12px;margin:4px 0 0;">Tarefas Pendentes</p>
        </div>
      </div>
      ${recommendations.length > 0 ? `<div style="background:#f8fafc;border-radius:12px;padding:24px;margin:0 0 24px;border:1px solid #e2e8f0;">
        <h3 style="color:#374151;margin:0 0 12px;font-size:16px;">Recomendacoes:</h3>
        <ul style="color:#4b5563;margin:0;padding:0 0 0 20px;line-height:1.8;">${recommendations.map(r => `<li>${r}</li>`).join('')}</ul>
      </div>` : ''}
      <div style="text-align:center;padding:16px 0;">
        <p style="color:#9ca3af;font-size:12px;margin:0;">Este e-mail foi enviado automaticamente pelo sistema ServChat.<br>${new Date().getFullYear()} ${companyName}.</p>
      </div>
    </div>
  </div>
</body></html>`
}

function generatePdfHtml(displayName: string, stats: any, recommendations: string[], currentMonth: string, companyName: string, dateStr: string): string {
  const rate = stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0
  const barWidth = Math.max(rate, 2)

  let recsHtml = ''
  if (recommendations.length > 0) {
    recsHtml = recommendations.map(r => `<div style="display:flex;gap:10px;margin-bottom:8px;"><div style="width:4px;background:#3b82f6;border-radius:2px;flex-shrink:0;"></div><p style="margin:0;font-size:13px;color:#374151;line-height:1.6;">${sanitize(r)}</p></div>`).join('')
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Relatorio Mensal - ${sanitize(displayName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; background: #fff; color: #1a1a1a; padding: 0; }
  .header { background: linear-gradient(135deg, #1e3a8a, #3b82f6); padding: 32px 40px; color: white; }
  .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
  .header .subtitle { font-size: 13px; opacity: 0.85; }
  .header .report-title { font-size: 18px; font-weight: 600; margin-top: 16px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.3); }
  .content { padding: 32px 40px; }
  .collaborator { font-size: 15px; color: #475569; margin-bottom: 24px; }
  .collaborator strong { color: #1e293b; }
  .stats-grid { display: flex; gap: 12px; margin-bottom: 28px; flex-wrap: wrap; }
  .stat-card { flex: 1; min-width: 100px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; text-align: center; }
  .stat-card .number { font-size: 28px; font-weight: 700; }
  .stat-card .label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
  .stat-blue .number { color: #2563eb; }
  .stat-green .number { color: #16a34a; }
  .stat-orange .number { color: #d97706; }
  .stat-red .number { color: #dc2626; }
  .section-title { font-size: 15px; font-weight: 700; color: #1e293b; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #3b82f6; display: inline-block; }
  .progress-bar { background: #e2e8f0; border-radius: 8px; height: 14px; margin-bottom: 24px; overflow: hidden; }
  .progress-fill { background: linear-gradient(90deg, #22c55e, #16a34a); height: 100%; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 9px; font-weight: 700; }
  .recs { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 28px; }
  .summary-box { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 28px; }
  .summary-item { font-size: 13px; color: #374151; line-height: 2; }
  .footer { border-top: 1px solid #e2e8f0; padding: 16px 40px; text-align: center; color: #94a3b8; font-size: 10px; }
  @media print { body { padding: 0; } .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
<div class="header">
  <h1>ServChat</h1>
  <div class="subtitle">${sanitize(companyName)}</div>
  <div class="report-title">Relatorio Mensal de Atividades - ${sanitize(currentMonth)}</div>
</div>
<div class="content">
  <p class="collaborator">Colaborador: <strong>${sanitize(displayName)}</strong></p>
  <div class="stats-grid">
    <div class="stat-card stat-blue"><div class="number">${stats.totalMessages}</div><div class="label">Mensagens</div></div>
    <div class="stat-card stat-green"><div class="number">${stats.completedTasks}/${stats.totalTasks}</div><div class="label">Concluidas</div></div>
    <div class="stat-card stat-orange"><div class="number">${stats.lateTasks}</div><div class="label">Com Atraso</div></div>
    <div class="stat-card stat-red"><div class="number">${stats.overdueTasks}</div><div class="label">Pendentes</div></div>
  </div>
  <div class="section-title">Taxa de Conclusao</div>
  <div class="progress-bar"><div class="progress-fill" style="width:${barWidth}%">${rate}%</div></div>
  <div class="section-title">Resumo de Atividades</div>
  <div class="summary-box">
    <div class="summary-item">- Mensagens enviadas no mes: ${stats.totalMessages}</div>
    <div class="summary-item">- Tarefas concluidas: ${stats.completedTasks} de ${stats.totalTasks} (${rate}%)</div>
    <div class="summary-item">- Entregas realizadas com atraso: ${stats.lateTasks}</div>
    <div class="summary-item">- Tarefas pendentes e atrasadas: ${stats.overdueTasks}</div>
  </div>
  ${recommendations.length > 0 ? `<div class="section-title">Recomendacoes Personalizadas</div><div class="recs">${recsHtml}</div>` : ''}
</div>
<div class="footer">Relatorio gerado automaticamente pelo ServChat em ${dateStr} | ${new Date().getFullYear()} ${sanitize(companyName)}</div>
</body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const userId = user.id
    const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').single()
    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const { type, targetUserId } = body
    console.log(`Feedback request: type=${type}, targetUserId=${targetUserId}`)

    const senderProfileId = await getAdminProfileId(supabase, userId)

    let targetProfiles: any[] = []
    if (type === 'individual' && targetUserId) {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id, name, display_name, email')
        .eq('id', targetUserId)
        .single()
      if (profileError) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (data) targetProfiles = [data]
    } else if (type === 'all') {
      const { data } = await supabase
        .from('profiles')
        .select('id, user_id, name, display_name, email')
        .eq('is_active', true)
        .neq('profile_type', 'bot')
      targetProfiles = data || []
    } else {
      return new Response(JSON.stringify({ error: 'Invalid type' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (targetProfiles.length === 0) {
      return new Response(JSON.stringify({ error: 'No recipients found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const companyName = 'Grupo Servsul'
    const brNow = getBrazilNow()
    const currentMonth = getCurrentMonthLabel(brNow)
    const dateStr = formatBrDate(brNow)
    const now = new Date()
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
    const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)).toISOString()

    let sentEmailCount = 0
    let sentDmCount = 0
    let sentPdfCount = 0
    const errors: string[] = []

    for (const profile of targetProfiles) {
      try {
        const { count: sectorMsgCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('author_id', profile.id)
          .gte('created_at', startOfMonth)
          .lte('created_at', endOfMonth)

        const { count: dmCount } = await supabase
          .from('direct_messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender_id', profile.id)
          .gte('created_at', startOfMonth)
          .lte('created_at', endOfMonth)

        const { data: tasksData } = await supabase
          .from('tasks')
          .select('id, status, completed_at, completed_late, due_date')
          .eq('assigned_to', profile.id)

        const totalTasks = tasksData?.length || 0
        const completedTasks = tasksData?.filter((t: any) => t.completed_at)?.length || 0
        const lateTasks = tasksData?.filter((t: any) => t.completed_late === true)?.length || 0
        const overdueTasks = tasksData?.filter((t: any) => {
          if (t.completed_at) return false
          if (!t.due_date) return false
          return new Date(t.due_date) < now
        })?.length || 0

        const totalMessages = (sectorMsgCount || 0) + (dmCount || 0)
        const displayName = sanitize(profile.display_name || profile.name)

        const stats = { totalMessages, completedTasks, totalTasks, lateTasks, overdueTasks }
        const recommendations = generateRecommendations(stats)

        // Generate styled HTML PDF and upload
        let pdfUrl: string | undefined
        try {
          const pdfHtml = generatePdfHtml(displayName, stats, recommendations, currentMonth, companyName, dateStr)
          const monthSlug = currentMonth.replace(/\s+/g, '-').toLowerCase()
          const fileName = `feedback/${monthSlug}/${profile.id}.html`
          
          const { error: uploadError } = await supabase.storage
            .from('attachments')
            .upload(fileName, new Blob([pdfHtml], { type: 'text/html' }), {
              contentType: 'text/html',
              upsert: true,
            })

          if (uploadError) {
            console.error(`PDF upload error for ${profile.name}:`, uploadError)
          } else {
            const { data: urlData } = supabase.storage
              .from('attachments')
              .getPublicUrl(fileName)
            pdfUrl = urlData?.publicUrl
            sentPdfCount++
          }
        } catch (pdfErr) {
          console.error(`PDF generation error for ${profile.name}:`, pdfErr)
        }

        // 1. Try to send email
        if (resendApiKey && profile.email) {
          try {
            const resend = new Resend(resendApiKey)
            const emailHtml = buildEmailHtml(displayName, stats, recommendations, currentMonth, companyName)
            const { error: sendError } = await resend.emails.send({
              from: 'ServChat <onboarding@resend.dev>',
              to: [profile.email],
              subject: `Feedback Mensal - ${currentMonth}`,
              html: emailHtml,
            })
            if (!sendError) sentEmailCount++
            else console.error(`Email error for ${profile.email}:`, sendError)
          } catch (emailErr) {
            console.error(`Email exception for ${profile.email}:`, emailErr)
          }
        }

        // 2. Always send DM
        if (profile.id !== senderProfileId) {
          try {
            const chatMessage = buildChatMessage(displayName, stats, recommendations, currentMonth, pdfUrl)
            const { error: dmError } = await supabase
              .from('direct_messages')
              .insert({ sender_id: senderProfileId, receiver_id: profile.id, content: chatMessage })
            if (dmError) {
              errors.push(`DM ${profile.name}: ${dmError.message}`)
            } else {
              sentDmCount++
            }
          } catch (dmErr) {
            errors.push(`DM ${profile.name}: ${dmErr instanceof Error ? dmErr.message : 'unknown'}`)
          }
        }
      } catch (userError) {
        errors.push(`${profile.name}: ${userError instanceof Error ? userError.message : 'unknown'}`)
      }
    }

    return new Response(JSON.stringify({ 
      success: true, emailCount: sentEmailCount, dmCount: sentDmCount, pdfCount: sentPdfCount,
      total: targetProfiles.length, errors: errors.length > 0 ? errors : undefined
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
