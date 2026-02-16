import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend@4.0.0'
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const MONTH_NAMES_DISPLAY = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function getBrazilNow() {
  const now = new Date()
  return new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
}

function formatBrDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const hour = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} ${hour}:${min}`
}

function getCurrentMonthLabel(d: Date): string {
  return `${MONTH_NAMES_DISPLAY[d.getMonth()]} de ${d.getFullYear()}`
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
  const { data, error } = await supabase.from('profiles').select('id').eq('user_id', userId).single()
  if (error || !data) throw new Error('Could not find admin profile')
  return data.id
}

function generateRecommendations(stats: { totalMessages: number; completedTasks: number; totalTasks: number; lateTasks: number; overdueTasks: number }): string[] {
  const recs: string[] = []
  if (stats.totalMessages < 5) {
    recs.push('Sua participacao nas conversas foi baixa este mes. Tente interagir mais com a equipe.')
  } else if (stats.totalMessages > 50) {
    recs.push('Excelente nivel de comunicacao! Continue mantendo esse engajamento.')
  }
  if (stats.totalTasks > 0) {
    const rate = stats.completedTasks / stats.totalTasks
    if (rate >= 0.9) recs.push('Parabens! Sua taxa de conclusao de tarefas esta excelente.')
    else if (rate >= 0.6) recs.push('Sua taxa de conclusao esta boa, mas ha espaco para melhoria.')
    else recs.push('Sua taxa de conclusao esta abaixo do ideal. Revise suas prioridades.')
  } else {
    recs.push('Nenhuma tarefa atribuida este mes. Verifique com seu supervisor.')
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
  if (pdfUrl) msg += `\n[Baixar Relatorio PDF](${pdfUrl})`
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
        <p style="color:#9ca3af;font-size:12px;margin:0;">Este e-mail foi enviado automaticamente pelo sistema ServChat.<br>2026 ${companyName}.</p>
      </div>
    </div>
  </div>
</body></html>`
}

async function generatePdf(displayName: string, stats: any, recommendations: string[], currentMonth: string, companyName: string, dateStr: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842]) // A4
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const { width, height } = page.getSize()

  const rate = stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0
  const name = sanitize(displayName)
  const month = sanitize(currentMonth)
  const company = sanitize(companyName)

  // Header background
  page.drawRectangle({ x: 0, y: height - 120, width, height: 120, color: rgb(0.12, 0.23, 0.54) })

  // Header text
  page.drawText('ServChat', { x: 40, y: height - 45, size: 28, font: helveticaBold, color: rgb(1, 1, 1) })
  page.drawText(company, { x: 40, y: height - 65, size: 11, font: helvetica, color: rgb(0.8, 0.85, 1) })
  page.drawText(`Relatorio Mensal - ${month}`, { x: 40, y: height - 95, size: 16, font: helveticaBold, color: rgb(1, 1, 1) })
  page.drawText(`Gerado em: ${dateStr}`, { x: width - 200, y: height - 95, size: 9, font: helvetica, color: rgb(0.8, 0.85, 1) })

  let y = height - 155

  // Collaborator
  page.drawText(`Colaborador: ${name}`, { x: 40, y, size: 13, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) })
  y -= 35

  // Stats section
  const drawStatCard = (x: number, yPos: number, value: string, label: string, r: number, g: number, b: number) => {
    page.drawRectangle({ x, y: yPos - 5, width: 120, height: 55, color: rgb(0.96, 0.97, 0.98), borderColor: rgb(0.85, 0.87, 0.9), borderWidth: 1 })
    page.drawText(value, { x: x + 10, y: yPos + 28, size: 22, font: helveticaBold, color: rgb(r, g, b) })
    page.drawText(label, { x: x + 10, y: yPos + 5, size: 9, font: helvetica, color: rgb(0.4, 0.45, 0.5) })
  }

  drawStatCard(40, y, String(stats.totalMessages), 'Mensagens', 0.15, 0.39, 0.92)
  drawStatCard(175, y, `${stats.completedTasks}/${stats.totalTasks}`, 'Concluidas', 0.09, 0.64, 0.25)
  drawStatCard(310, y, String(stats.lateTasks), 'Com Atraso', 0.85, 0.46, 0.02)
  drawStatCard(445, y, String(stats.overdueTasks), 'Pendentes', 0.86, 0.15, 0.15)

  y -= 75

  // Progress bar section
  page.drawText('Taxa de Conclusao', { x: 40, y, size: 13, font: helveticaBold, color: rgb(0.1, 0.15, 0.2) })
  y -= 20
  // Bar background
  page.drawRectangle({ x: 40, y: y - 2, width: width - 80, height: 16, color: rgb(0.88, 0.9, 0.92) })
  // Bar fill
  const barWidth = ((width - 80) * Math.min(rate, 100)) / 100
  if (barWidth > 0) {
    page.drawRectangle({ x: 40, y: y - 2, width: barWidth, height: 16, color: rgb(0.13, 0.77, 0.37) })
  }
  page.drawText(`${rate}%`, { x: 45, y: y + 1, size: 9, font: helveticaBold, color: rgb(1, 1, 1) })

  y -= 40

  // Summary
  page.drawText('Resumo de Atividades', { x: 40, y, size: 13, font: helveticaBold, color: rgb(0.1, 0.15, 0.2) })
  y -= 5
  page.drawRectangle({ x: 40, y: y - 85, width: width - 80, height: 85, color: rgb(0.96, 0.97, 0.98), borderColor: rgb(0.88, 0.9, 0.92), borderWidth: 1 })
  y -= 15
  const summaryLines = [
    `Mensagens enviadas no mes: ${stats.totalMessages}`,
    `Tarefas concluidas: ${stats.completedTasks} de ${stats.totalTasks} (${rate}%)`,
    `Entregas realizadas com atraso: ${stats.lateTasks}`,
    `Tarefas pendentes e atrasadas: ${stats.overdueTasks}`,
  ]
  for (const line of summaryLines) {
    page.drawText(`  ${line}`, { x: 50, y, size: 11, font: helvetica, color: rgb(0.22, 0.26, 0.32) })
    y -= 18
  }

  y -= 25

  // Recommendations
  if (recommendations.length > 0) {
    page.drawText('Recomendacoes Personalizadas', { x: 40, y, size: 13, font: helveticaBold, color: rgb(0.1, 0.15, 0.2) })
    y -= 20
    for (const rec of recommendations) {
      const cleanRec = sanitize(rec)
      // Wrap long text
      const maxChars = 85
      const lines: string[] = []
      for (let i = 0; i < cleanRec.length; i += maxChars) {
        lines.push(cleanRec.substring(i, i + maxChars))
      }
      for (const line of lines) {
        if (y < 60) break
        page.drawText(`  - ${line}`, { x: 50, y, size: 10, font: helvetica, color: rgb(0.22, 0.26, 0.32) })
        y -= 16
      }
      y -= 4
    }
  }

  // Footer
  page.drawText(`Relatorio gerado automaticamente pelo ServChat em ${dateStr} | 2026 ${company}`, {
    x: 40, y: 30, size: 8, font: helvetica, color: rgb(0.58, 0.64, 0.7)
  })

  return await pdfDoc.save()
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

        // Generate real PDF using pdf-lib
        let pdfUrl: string | undefined
        try {
          const pdfBytes = await generatePdf(displayName, stats, recommendations, currentMonth, companyName, dateStr)
          const monthSlug = currentMonth.replace(/\s+/g, '-').toLowerCase()
          const fileName = `feedback/${monthSlug}/${profile.id}.pdf`

          const { error: uploadError } = await supabase.storage
            .from('attachments')
            .upload(fileName, pdfBytes, {
              contentType: 'application/pdf',
              upsert: true,
            })

          if (uploadError) {
            console.error(`PDF upload error for ${profile.name}:`, uploadError)
          } else {
            const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(fileName)
            pdfUrl = urlData?.publicUrl
            sentPdfCount++
          }
        } catch (pdfError) {
          console.error(`PDF generation error for ${profile.name}:`, pdfError)
        }

        // Send DM
        try {
          const chatMessage = buildChatMessage(displayName, stats, recommendations, currentMonth, pdfUrl)
          const { error: dmError } = await supabase.from('direct_messages').insert({
            sender_id: senderProfileId,
            receiver_id: profile.id,
            content: chatMessage,
          })
          if (dmError) {
            console.error(`DM error for ${profile.name}:`, dmError)
            errors.push(`DM para ${profile.name}: ${dmError.message}`)
          } else {
            sentDmCount++
          }
        } catch (dmError) {
          console.error(`DM exception for ${profile.name}:`, dmError)
        }

        // Send email
        if (resendApiKey && profile.email) {
          try {
            const resend = new Resend(resendApiKey)
            const emailHtml = buildEmailHtml(displayName, stats, recommendations, currentMonth, companyName)
            const { error: emailError } = await resend.emails.send({
              from: 'ServChat <onboarding@resend.dev>',
              to: [profile.email],
              subject: `Feedback Mensal - ${currentMonth} | ServChat`,
              html: emailHtml,
            })
            if (emailError) {
              console.error(`Email error for ${profile.email}:`, emailError)
              errors.push(`Email para ${profile.email}: ${(emailError as any).message}`)
            } else {
              sentEmailCount++
            }
          } catch (emailError) {
            console.error(`Email exception for ${profile.email}:`, emailError)
          }
        }
      } catch (profileError) {
        console.error(`Error processing ${profile.name}:`, profileError)
        errors.push(`Erro ao processar ${profile.name}`)
      }
    }

    const summary = {
      success: true,
      totalRecipients: targetProfiles.length,
      emailsSent: sentEmailCount,
      dmsSent: sentDmCount,
      pdfsSent: sentPdfCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Feedback enviado: ${sentDmCount} mensagens, ${sentEmailCount} e-mails, ${sentPdfCount} PDFs`,
    }

    console.log('Feedback summary:', JSON.stringify(summary))

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Fatal error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
