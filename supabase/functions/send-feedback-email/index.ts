import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendMail, mailerConfigured, esc } from '../_shared/mailer.ts'
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1'

// "Comunicados": system sender of automations (migration 20261109030000_system_sender).
const SYSTEM_SENDER_ID = '00000000-0000-0000-0000-0000000000c1'

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

// Brazil (America/Sao_Paulo) has used a fixed UTC-03:00 offset (no DST) since 2019.
const SAO_PAULO_OFFSET_HOURS = 3

/**
 * Returns the start/end ISO timestamps (in UTC) that correspond to the previous
 * full calendar month in America/Sao_Paulo local time, plus a display label.
 * e.g. if run on any day of August, returns July 1st 00:00:00 -> July 31st 23:59:59 (SP time).
 */
function getPreviousMonthRangeSaoPaulo(brNow: Date): { startIso: string; endIso: string; monthLabel: string } {
  const currentYear = brNow.getFullYear()
  const currentMonth = brNow.getMonth() // 0-indexed, month of "now" in SP time

  // Previous month (handling year rollover)
  const prevMonthIndex = currentMonth === 0 ? 11 : currentMonth - 1
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear

  // SP local midnight of day 1 of prevMonth == UTC time at (day1, SAO_PAULO_OFFSET_HOURS:00:00)
  const startIso = new Date(Date.UTC(prevYear, prevMonthIndex, 1, SAO_PAULO_OFFSET_HOURS, 0, 0)).toISOString()
  // Last instant (23:59:59) of prevMonth in SP time == UTC time at (day1 of NEXT month, SAO_PAULO_OFFSET_HOURS - 1 : 59 : 59)
  const endIso = new Date(Date.UTC(prevYear, prevMonthIndex + 1, 1, SAO_PAULO_OFFSET_HOURS - 1, 59, 59, 999)).toISOString()

  const monthLabel = `${MONTH_NAMES_DISPLAY[prevMonthIndex]} de ${prevYear}`

  return { startIso, endIso, monthLabel }
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
  msg += `\n\n_Mensagem automatica do ewvon_`
  return msg
}

function buildEmailHtml(displayName: string, stats: any, recommendations: string[], currentMonth: string, companyName: string): string {
  const rate = stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0
  const tile = (v: string | number, l: string, c: string) => `<td width="25%" style="padding:4px"><div style="background:#f4f4f5;border-radius:14px;padding:14px 8px;text-align:center"><div style="font-size:22px;font-weight:800;color:${c}">${v}</div><div style="font-size:11px;color:#71717a;margin-top:2px">${l}</div></div></td>`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#fff;border-radius:20px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
<tr><td style="background:#0b0b0e;padding:26px 28px"><div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#a1a1aa;font-weight:700">${esc(companyName)} · Feedback mensal</div><div style="font-size:24px;font-weight:800;color:#fff;margin-top:8px">${esc(currentMonth)}</div></td></tr>
<tr><td style="padding:24px 28px 8px;color:#3f3f46;font-size:15px;line-height:1.6">Olá, <b style="color:#09090b">${esc(displayName)}</b>! Aqui está o resumo da sua atividade no mês. O relatório completo segue em PDF anexo.</td></tr>
<tr><td style="padding:8px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>${tile(stats.totalMessages, 'mensagens', '#18181b')}${tile(`${rate}%`, `${stats.completedTasks}/${stats.totalTasks} tarefas`, '#16a34a')}${tile(stats.lateTasks, 'com atraso', '#d97706')}${tile(stats.overdueTasks, 'pendentes', '#dc2626')}</tr></table></td></tr>
${recommendations.length ? `<tr><td style="padding:16px 28px 26px"><div style="font-size:13px;font-weight:700;color:#09090b;margin-bottom:8px">Recomendações</div>${recommendations.map((r) => `<div style="font-size:14px;color:#3f3f46;line-height:1.55;padding:8px 12px;border-left:3px solid #18181b;background:#fafafa;border-radius:0 10px 10px 0;margin-bottom:6px">${esc(r)}</div>`).join('')}</td></tr>` : ''}
</table>`
}

// Helper to draw rounded rectangle
function drawRoundedRect(page: any, x: number, y: number, w: number, h: number, r: number, color: any, borderColor?: any) {
  // Draw filled rectangle with rounded corners approximation
  // pdf-lib doesn't natively support rounded rectangles, so we use overlapping rects + circles
  const cr = Math.min(r, w / 2, h / 2)
  
  // Main body (without corners)
  page.drawRectangle({ x: x + cr, y, width: w - 2 * cr, height: h, color })
  page.drawRectangle({ x, y: y + cr, width: w, height: h - 2 * cr, color })
  
  // Corner circles
  page.drawCircle({ x: x + cr, y: y + cr, size: cr, color })
  page.drawCircle({ x: x + w - cr, y: y + cr, size: cr, color })
  page.drawCircle({ x: x + cr, y: y + h - cr, size: cr, color })
  page.drawCircle({ x: x + w - cr, y: y + h - cr, size: cr, color })
  
  if (borderColor) {
    // Draw border lines
    page.drawLine({ start: { x: x + cr, y }, end: { x: x + w - cr, y }, thickness: 1, color: borderColor })
    page.drawLine({ start: { x: x + cr, y: y + h }, end: { x: x + w - cr, y: y + h }, thickness: 1, color: borderColor })
    page.drawLine({ start: { x, y: y + cr }, end: { x, y: y + h - cr }, thickness: 1, color: borderColor })
    page.drawLine({ start: { x: x + w, y: y + cr }, end: { x: x + w, y: y + h - cr }, thickness: 1, color: borderColor })
  }
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

  // Colors
  const headerBlue = rgb(0.09, 0.12, 0.38)
  const accentBlue = rgb(0.24, 0.35, 0.85)
  const white = rgb(1, 1, 1)
  const lightGray = rgb(0.96, 0.97, 0.98)
  const borderGray = rgb(0.88, 0.90, 0.93)
  const darkText = rgb(0.12, 0.14, 0.18)
  const medText = rgb(0.30, 0.34, 0.40)
  const lightText = rgb(0.55, 0.60, 0.68)

  // === HEADER with rounded top ===
  drawRoundedRect(page, 30, height - 140, width - 60, 110, 12, headerBlue)

  // Header content - centered
  const titleText = 'ewvon'
  const titleWidth = helveticaBold.widthOfTextAtSize(titleText, 30)
  page.drawText(titleText, { x: (width - titleWidth) / 2, y: height - 60, size: 30, font: helveticaBold, color: white })

  const companyText = company
  const companyWidth = helvetica.widthOfTextAtSize(companyText, 12)
  page.drawText(companyText, { x: (width - companyWidth) / 2, y: height - 78, size: 12, font: helvetica, color: rgb(0.7, 0.75, 0.9) })

  const reportTitle = `Relatorio Mensal - ${month}`
  const reportWidth = helveticaBold.widthOfTextAtSize(reportTitle, 14)
  page.drawText(reportTitle, { x: (width - reportWidth) / 2, y: height - 105, size: 14, font: helveticaBold, color: rgb(0.85, 0.88, 1) })

  const dateText = `Gerado em: ${dateStr}`
  const dateWidth = helvetica.widthOfTextAtSize(dateText, 9)
  page.drawText(dateText, { x: (width - dateWidth) / 2, y: height - 122, size: 9, font: helvetica, color: rgb(0.65, 0.7, 0.85) })

  let y = height - 175

  // === COLLABORATOR NAME ===
  const collabText = `Colaborador: ${name}`
  const collabWidth = helveticaBold.widthOfTextAtSize(collabText, 14)
  page.drawText(collabText, { x: (width - collabWidth) / 2, y, size: 14, font: helveticaBold, color: darkText })
  y -= 10

  // Decorative line under name
  const lineW = 120
  page.drawRectangle({ x: (width - lineW) / 2, y, width: lineW, height: 2, color: accentBlue })
  y -= 30

  // === STAT CARDS - 4 cards in a row ===
  const cardW = 115
  const cardH = 65
  const cardGap = 12
  const totalCardsWidth = 4 * cardW + 3 * cardGap
  const startX = (width - totalCardsWidth) / 2

  const statCards = [
    { value: String(stats.totalMessages), label: 'Mensagens', bg: rgb(0.94, 0.99, 0.96), accent: rgb(0.08, 0.55, 0.24), border: rgb(0.73, 0.97, 0.83) },
    { value: `${stats.completedTasks}/${stats.totalTasks}`, label: 'Concluidas', bg: rgb(0.94, 0.96, 1), accent: rgb(0.15, 0.39, 0.92), border: rgb(0.75, 0.86, 0.99) },
    { value: String(stats.lateTasks), label: 'Com Atraso', bg: rgb(1, 0.97, 0.93), accent: rgb(0.85, 0.46, 0.02), border: rgb(0.99, 0.84, 0.67) },
    { value: String(stats.overdueTasks), label: 'Pendentes', bg: rgb(1, 0.95, 0.95), accent: rgb(0.86, 0.15, 0.15), border: rgb(0.99, 0.79, 0.79) },
  ]

  statCards.forEach((card, i) => {
    const cx = startX + i * (cardW + cardGap)
    drawRoundedRect(page, cx, y - cardH, cardW, cardH, 8, card.bg, card.border)
    
    const valWidth = helveticaBold.widthOfTextAtSize(card.value, 24)
    page.drawText(card.value, { x: cx + (cardW - valWidth) / 2, y: y - 28, size: 24, font: helveticaBold, color: card.accent })
    
    const lblWidth = helvetica.widthOfTextAtSize(card.label, 9)
    page.drawText(card.label, { x: cx + (cardW - lblWidth) / 2, y: y - cardH + 12, size: 9, font: helvetica, color: medText })
  })

  y -= cardH + 30

  // === PROGRESS BAR ===
  const progressTitle = 'Taxa de Conclusao'
  const ptWidth = helveticaBold.widthOfTextAtSize(progressTitle, 13)
  page.drawText(progressTitle, { x: (width - ptWidth) / 2, y, size: 13, font: helveticaBold, color: darkText })
  y -= 22

  const barX = 50
  const barW = width - 100
  const barH = 18
  // Bar background
  drawRoundedRect(page, barX, y, barW, barH, 9, rgb(0.90, 0.92, 0.95))
  // Bar fill
  const fillW = (barW * Math.min(rate, 100)) / 100
  if (fillW > 0) {
    drawRoundedRect(page, barX, y, Math.max(fillW, 18), barH, 9, rgb(0.15, 0.68, 0.38))
  }
  // Percentage text centered
  const pctText = `${rate}%`
  const pctWidth = helveticaBold.widthOfTextAtSize(pctText, 10)
  page.drawText(pctText, { x: barX + (barW - pctWidth) / 2, y: y + 4, size: 10, font: helveticaBold, color: fillW > barW / 2 ? white : darkText })

  y -= 40

  // === ACTIVITY SUMMARY ===
  const summTitle = 'Resumo de Atividades'
  const stWidth = helveticaBold.widthOfTextAtSize(summTitle, 13)
  page.drawText(summTitle, { x: (width - stWidth) / 2, y, size: 13, font: helveticaBold, color: darkText })
  y -= 10

  const summaryLines = [
    `Mensagens enviadas no mes: ${stats.totalMessages}`,
    `Tarefas concluidas: ${stats.completedTasks} de ${stats.totalTasks} (${rate}%)`,
    `Entregas realizadas com atraso: ${stats.lateTasks}`,
    `Tarefas pendentes e atrasadas: ${stats.overdueTasks}`,
  ]
  
  const boxH = summaryLines.length * 20 + 20
  drawRoundedRect(page, 40, y - boxH, width - 80, boxH, 10, lightGray, borderGray)
  y -= 18
  for (const line of summaryLines) {
    const lw = helvetica.widthOfTextAtSize(line, 11)
    page.drawText(line, { x: (width - lw) / 2, y, size: 11, font: helvetica, color: medText })
    y -= 20
  }

  y -= 25

  // === RECOMMENDATIONS ===
  if (recommendations.length > 0) {
    const recTitle = 'Recomendacoes Personalizadas'
    const rtWidth = helveticaBold.widthOfTextAtSize(recTitle, 13)
    page.drawText(recTitle, { x: (width - rtWidth) / 2, y, size: 13, font: helveticaBold, color: darkText })
    y -= 22

    for (const rec of recommendations) {
      const cleanRec = sanitize(rec)
      const maxChars = 80
      const lines: string[] = []
      for (let i = 0; i < cleanRec.length; i += maxChars) {
        lines.push(cleanRec.substring(i, i + maxChars))
      }
      
      // Draw a small accent dot
      for (let li = 0; li < lines.length; li++) {
        if (y < 60) break
        const prefix = li === 0 ? '  >  ' : '     '
        const lineText = prefix + lines[li]
        const lineW2 = helvetica.widthOfTextAtSize(lineText, 10)
        page.drawText(lineText, { x: (width - lineW2) / 2, y, size: 10, font: helvetica, color: medText })
        y -= 16
      }
      y -= 6
    }
  }

  // === FOOTER ===
  const footerText = `Relatorio gerado automaticamente pelo ewvon em ${dateStr}`
  const fWidth = helvetica.widthOfTextAtSize(footerText, 8)
  page.drawText(footerText, { x: (width - fWidth) / 2, y: 40, size: 8, font: helvetica, color: lightText })

  const copyrightText = `2026 ${company} - Todos os direitos reservados`
  const cWidth = helvetica.widthOfTextAtSize(copyrightText, 8)
  page.drawText(copyrightText, { x: (width - cWidth) / 2, y: 28, size: 8, font: helvetica, color: lightText })

  return await pdfDoc.save()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const canEmail = mailerConfigured()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Body is parsed first so the scheduled cron run can authenticate with the
    // service role key instead of a user JWT.
    let body: any = {}
    try { body = await req.json() } catch { body = {} }
    const authHeader = req.headers.get('Authorization') || ''
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : ''
    // The scheduled run authenticates with the project key sent by the cron job.
    // It is additionally restricted to the 1st day of the month (Sao Paulo time)
    // and is idempotent (recipients already notified for the reference month are
    // skipped), so it cannot be abused to spam feedback messages.
    const cronDay = getBrazilNow().getDate()
    const isCron = body?.cron === true && bearer.length > 0 && cronDay === 1

    let userId: string | null = null
    if (!isCron) {
      if (!bearer) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const { data: { user }, error: userError } = await supabase.auth.getUser(bearer)
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      userId = user.id
      const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').single()
      if (!roleData) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    const type = body?.type ?? (isCron ? 'all' : undefined)
    const targetUserId = body?.targetUserId
    console.log(`Feedback request: type=${type}, targetUserId=${targetUserId}, cron=${isCron}`)

    const defaultSenderProfileId = userId ? await getAdminProfileId(supabase, userId) : null
    // A company admin only reaches people of their own company; the monthly cron covers everyone.
    let adminCompanyId: string | null = null
    if (!isCron && defaultSenderProfileId) {
      const { data: me } = await supabase.from('profiles').select('company_id').eq('id', defaultSenderProfileId).single()
      adminCompanyId = me?.company_id ?? null
      if (!adminCompanyId) return new Response(JSON.stringify({ error: 'Empresa do administrador não encontrada' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let targetProfiles: any[] = []
    if (type === 'individual' && targetUserId) {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id, name, display_name, email, company_id')
        .eq('id', targetUserId)
        .single()
      if (profileError || (adminCompanyId && data?.company_id !== adminCompanyId)) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (data) targetProfiles = [data]
    } else if (type === 'all') {
      let q = supabase
        .from('profiles')
        .select('id, user_id, name, display_name, email, company_id')
        .eq('is_active', true)
        .not('profile_type', 'in', '(bot,system)')
      if (adminCompanyId) q = q.eq('company_id', adminCompanyId)
      const { data } = await q
      targetProfiles = data || []
    } else {
      return new Response(JSON.stringify({ error: 'Invalid type' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (targetProfiles.length === 0) {
      return new Response(JSON.stringify({ error: 'No recipients found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const companyName = 'ewvon'
    const brNow = getBrazilNow()
    const dateStr = formatBrDate(brNow)
    const now = new Date()
    // Metrics are always computed for the previous full calendar month (America/Sao_Paulo),
    // e.g. running on any day of August reports on July 1st 00:00 -> July 31st 23:59:59.
    const { startIso: startOfMonth, endIso: endOfMonth, monthLabel: currentMonth } = getPreviousMonthRangeSaoPaulo(brNow)
    const referenceMonthEnd = new Date(endOfMonth)

    // The monthly feedback DM is sent by "Comunicados" (one system sender for every company,
    // migration 20261109030000_system_sender), never by the company's admin.
    const resolveSender = async (_companyId: string | null): Promise<string | null> => SYSTEM_SENDER_ID

    // Idempotency: on cron runs, skip anyone that already received the feedback
    // message for the reference month.
    const alreadySent = new Set<string>()
    if (isCron) {
      const { data: sentRows } = await supabase
        .from('direct_messages')
        .select('receiver_id, content')
        .gte('created_at', new Date(Date.now() - 20 * 864e5).toISOString())
      for (const row of (sentRows || []) as any[]) {
        if (typeof row.content === 'string' && row.content.includes(currentMonth)) alreadySent.add(row.receiver_id)
      }
    }

    let sentEmailCount = 0
    let sentDmCount = 0
    let sentPdfCount = 0
    const errors: string[] = []

    for (const profile of targetProfiles) {
      try {
        if (alreadySent.has(profile.id)) { console.log(`Skipping ${profile.name}: feedback already sent for ${currentMonth}`); continue }
        const senderProfileId = await resolveSender(profile.company_id ?? null)
        if (!senderProfileId) { errors.push(`Sem remetente para ${profile.name}`); continue }
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
          .gte('created_at', startOfMonth)
          .lte('created_at', endOfMonth)

        const totalTasks = tasksData?.length || 0
        const completedTasks = tasksData?.filter((t: any) => t.completed_at)?.length || 0
        const lateTasks = tasksData?.filter((t: any) => t.completed_late === true)?.length || 0
        const overdueTasks = tasksData?.filter((t: any) => {
          if (t.completed_at) return false
          if (!t.due_date) return false
          return new Date(t.due_date) < referenceMonthEnd
        })?.length || 0

        const totalMessages = (sectorMsgCount || 0) + (dmCount || 0)
        const displayName = sanitize(profile.display_name || profile.name)

        const stats = { totalMessages, completedTasks, totalTasks, lateTasks, overdueTasks }
        const recommendations = generateRecommendations(stats)

        // Generate real PDF using pdf-lib
        let pdfUrl: string | undefined
        let pdfBytes: Uint8Array | null = null
        try {
          pdfBytes = await generatePdf(displayName, stats, recommendations, currentMonth, companyName, dateStr)
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
            const { data: signed } = await supabase.storage.from('attachments').createSignedUrl(fileName, 60 * 60 * 24 * 7)
            pdfUrl = signed?.signedUrl
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
            // The conversation belongs to the recipient's company (the sender is global).
            ...(profile.company_id ? { company_id: profile.company_id } : {}),
          })
          if (dmError) {
            console.error(`DM error for ${profile.name}:`, dmError)
            errors.push(`DM para ${profile.name}: ${dmError.message}`)
          } else {
            sentDmCount++
          }
        } catch (e) {
          console.error(`DM exception for ${profile.name}:`, e)
        }

        // Send email
        if (canEmail && profile.email) {
          try {
            const emailHtml = buildEmailHtml(displayName, stats, recommendations, currentMonth, companyName)
            await sendMail({
              to: profile.email,
              subject: `Feedback mensal · ${currentMonth}`,
              html: emailHtml,
              attachments: pdfBytes ? [{ filename: `feedback-${currentMonth.replace(/\s+/g, '-').toLowerCase()}.pdf`, content: pdfBytes, contentType: 'application/pdf' }] : [],
            })
            sentEmailCount++
          } catch (e) {
            console.error(`Email exception for ${profile.name}:`, e)
            errors.push(`E-mail para ${profile.name}: ${e instanceof Error ? e.message : 'falha no envio'}`)
          }
        } else if (!canEmail && profile.email) {
          if (!errors.includes('E-mail desativado: configure GMAIL_APP_PASSWORD')) errors.push('E-mail desativado: configure GMAIL_APP_PASSWORD')
        }
      } catch (profileError) {
        console.error(`Error processing ${profile.name}:`, profileError)
        errors.push(`${profile.name}: ${profileError instanceof Error ? profileError.message : 'Unknown error'}`)
      }
    }

    const response = {
      success: true,
      message: `Feedback enviado! Chat: ${sentDmCount}, E-mails: ${sentEmailCount}, PDFs: ${sentPdfCount}`,
      details: { sentDmCount, sentEmailCount, sentPdfCount, totalRecipients: targetProfiles.length },
      errors: errors.length > 0 ? errors : undefined,
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Fatal error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
