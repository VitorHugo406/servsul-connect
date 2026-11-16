import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildReportPdf, type ReportData } from './report-pdf.ts'

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

const SITE_URL = (Deno.env.get('SITE_URL') || 'https://ewvon.vercel.app').replace(/\/+$/, '')
const PLEX = 'https://cdn.jsdelivr.net/gh/IBM/plex@master/packages/plex-sans/fonts/complete/ttf/IBMPlexSans-'
const monthNameLower = (i: number) => MONTH_NAMES_DISPLAY[i].toLowerCase()
const ROLE_LABEL: Record<string, string> = { admin: 'Administrador', gestor: 'Gestor', gerente: 'Gerente', supervisor: 'Supervisor', diretoria: 'Diretoria', colaborador: 'Colaborador' }
const pad2 = (n: number) => String(n).padStart(2, '0')

/** Range (UTC ISO) of the calendar month `back` months before the current one, in Sao Paulo time. */
function monthRangeBack(brNow: Date, back: number) {
  const idx = brNow.getMonth() - back
  const y = brNow.getFullYear() + Math.floor(idx / 12), m = ((idx % 12) + 12) % 12
  const start = new Date(Date.UTC(y, m, 1, SAO_PAULO_OFFSET_HOURS, 0, 0))
  const end = new Date(Date.UTC(y, m + 1, 1, SAO_PAULO_OFFSET_HOURS - 1, 59, 59, 999))
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  return { y, m, startIso: start.toISOString(), endIso: end.toISOString(), lastDay }
}

async function grab(url: string, ms = 5000): Promise<Uint8Array | null> {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms)
    const r = await fetch(url, { signal: ctl.signal }); clearTimeout(t)
    return r.ok ? new Uint8Array(await r.arrayBuffer()) : null
  } catch { return null }
}
let assetsCache: { regular: Uint8Array | null; medium: Uint8Array | null; semibold: Uint8Array | null; logo: Uint8Array | null } | null = null
async function loadAssets() {
  if (assetsCache) return assetsCache
  const [regular, medium, semibold, logo] = await Promise.all([grab(PLEX + 'Regular.ttf'), grab(PLEX + 'Medium.ttf'), grab(PLEX + 'SemiBold.ttf'), grab(`${SITE_URL}/ewwon/img/receipt-logo.png`)])
  return (assetsCache = { regular, medium, semibold, logo })
}
/** Profile photo as PNG/JPEG bytes (WebP is not supported by the PDF library: the initials are drawn instead). */
async function loadAvatar(url: string | null): Promise<Uint8Array | null> {
  if (!url || !/^https:\/\//.test(url)) return null
  const b = await grab(url, 4000)
  if (!b || b.length < 8) return null
  const png = b[0] === 0x89 && b[1] === 0x50, jpg = b[0] === 0xff && b[1] === 0xd8
  return png || jpg ? b : null
}
const initialsOf = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?'

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
  if (pdfUrl) msg += `\n[Baixar relatorio (PDF)](${pdfUrl})`
  msg += `\n\n_Mensagem automatica do ewvon_`
  return msg
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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
    // SECURITY (2026-11-09): the scheduled run must present the service role key itself (before, any
    // bearer string was accepted on the 1st of the month).
    const isCron = body?.cron === true && bearer.length > 0 && bearer === supabaseKey && cronDay === 1

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
        .select('id, user_id, name, display_name, email, company_id, avatar_url, autonomy_level, sector_id')
        .eq('id', targetUserId)
        .single()
      if (profileError || (adminCompanyId && data?.company_id !== adminCompanyId)) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (data) targetProfiles = [data]
    } else if (type === 'all') {
      let q = supabase
        .from('profiles')
        .select('id, user_id, name, display_name, email, company_id, avatar_url, autonomy_level, sector_id')
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

    let sentDmCount = 0
    let sentPdfCount = 0
    const errors: string[] = []

    for (const profile of targetProfiles) {
      try {
        if (alreadySent.has(profile.id)) { console.log(`Skipping ${profile.name}: feedback already sent for ${currentMonth}`); continue }
        const senderProfileId = await resolveSender(profile.company_id ?? null)
        if (!senderProfileId) { errors.push(`Sem remetente para ${profile.name}`); continue }
        const countMsgs = async (from: string, to: string) => {
          const { count: c1 } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('author_id', profile.id).gte('created_at', from).lte('created_at', to)
          const { count: c2 } = await supabase.from('direct_messages').select('*', { count: 'exact', head: true }).eq('sender_id', profile.id).gte('created_at', from).lte('created_at', to)
          return (c1 || 0) + (c2 || 0)
        }
        const prev = monthRangeBack(brNow, 2)   // the month before the reference month (comparison)
        const ref = monthRangeBack(brNow, 1)
        const prevMessages = await countMsgs(prev.startIso, prev.endIso)

        const taskCols = 'id, completed_at, completed_late, due_date, created_at'
        const { data: tasksData } = await supabase.from('tasks').select(taskCols).eq('assigned_to', profile.id).gte('created_at', startOfMonth).lte('created_at', endOfMonth)
        const { data: prevTasks } = await supabase.from('tasks').select(taskCols).eq('assigned_to', profile.id).gte('created_at', prev.startIso).lte('created_at', prev.endIso)
        const T = (tasksData || []) as any[]
        const totalTasks = T.length
        const completedTasks = T.filter(t => t.completed_at).length
        const lateTasks = T.filter(t => t.completed_late === true).length
        const overdueTasks = T.filter(t => !t.completed_at && t.due_date && new Date(t.due_date) < referenceMonthEnd).length
        const pendingTasks = totalTasks - completedTasks
        const prevDone = ((prevTasks || []) as any[]).filter(t => t.completed_at).length
        const prevLate = ((prevTasks || []) as any[]).filter(t => t.completed_late === true).length

        // weekly evolution: tasks assigned in each week and how many of them were completed
        const ranges: [number, number][] = [[1, 7], [8, 14], [15, 21], [22, 28]]
        if (ref.lastDay > 28) ranges.push([29, ref.lastDay])
        const dayOf = (iso: string) => new Date(new Date(iso).getTime() - SAO_PAULO_OFFSET_HOURS * 3600e3).getUTCDate()
        const weeks = ranges.map(([from, to]) => {
          const inWeek = T.filter(t => { const dd = dayOf(t.created_at); return dd >= from && dd <= to })
          return { label: `${pad2(from)}–${pad2(to)}`, assigned: inWeek.length, done: inWeek.filter(t => t.completed_at).length }
        })

        // meetings attended and war rooms answered in the month
        let meetings = 0
        const { data: parts } = await supabase.from('meeting_booking_participants').select('booking_id').eq('profile_id', profile.id)
        const bookingIds = ((parts || []) as any[]).map(p => p.booking_id)
        if (bookingIds.length) {
          const { count: mc } = await supabase.from('meeting_bookings').select('id', { count: 'exact', head: true }).in('id', bookingIds).gte('starts_at', startOfMonth).lte('starts_at', endOfMonth)
          meetings = mc || 0
        }
        const { count: warRooms } = await supabase.from('war_room_members').select('id', { count: 'exact', head: true }).eq('profile_id', profile.id).eq('has_acknowledged', true).gte('joined_at', startOfMonth).lte('joined_at', endOfMonth)

        const totalMessages = await countMsgs(startOfMonth, endOfMonth)
        const displayName = sanitize(profile.display_name || profile.name)
        const stats = { totalMessages, completedTasks, totalTasks, lateTasks, overdueTasks }
        const recommendations = generateRecommendations(stats)

        const rate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
        const recs: { tone: 'warn' | 'good'; text: string }[] = []
        if (overdueTasks > 0) recs.push({ tone: 'warn', text: `${overdueTasks === 1 ? 'Uma tarefa está atrasada' : overdueTasks + ' tarefas estão atrasadas'}. Reorganize os prazos com seu supervisor.` })
        const weekRates = weeks.filter(w => w.assigned > 0).map(w => ({ w, r: Math.round((w.done / w.assigned) * 100), n: weeks.indexOf(w) + 1 }))
        if (weekRates.length > 1) { const worst = weekRates.reduce((x, y) => (y.r < x.r ? y : x)); if (worst.r < 70 && worst.r < rate) recs.push({ tone: 'warn', text: `A conclusão caiu na ${worst.n}ª semana (${worst.r}%). Avalie a carga de trabalho do período.` }) }
        if (totalTasks === 0) recs.push({ tone: 'warn', text: 'Nenhuma tarefa atribuída neste mês. Verifique com seu supervisor.' })
        else if (rate < 60) recs.push({ tone: 'warn', text: 'Sua taxa de conclusão está abaixo do ideal. Revise suas prioridades.' })
        else if (rate >= 90) recs.push({ tone: 'good', text: 'Parabéns! Sua taxa de conclusão de tarefas está excelente.' })
        if (lateTasks > 0 && overdueTasks === 0) recs.push({ tone: 'warn', text: `Você teve ${lateTasks} entrega(s) com atraso. Planeje melhor os prazos.` })
        if (totalMessages < 5) recs.push({ tone: 'warn', text: 'Sua participação nas conversas foi baixa. Tente interagir mais com a equipe.' })
        else if (prevMessages > 0 && totalMessages >= prevMessages * 1.05) recs.push({ tone: 'good', text: `Sua participação nas conversas cresceu ${Math.round(((totalMessages - prevMessages) / prevMessages) * 100)}%. Continue interagindo com a equipe.` })
        else if (totalMessages > 50) recs.push({ tone: 'good', text: 'Excelente nível de comunicação! Continue mantendo esse engajamento.' })
        if (lateTasks === 0 && overdueTasks === 0 && totalTasks > 0) recs.push({ tone: 'good', text: 'Nenhuma tarefa atrasada. Ótima gestão de tempo!' })

        let sectorName = 'Sem setor'
        if (profile.sector_id) { const { data: sec } = await supabase.from('sectors').select('name').eq('id', profile.sector_id).maybeSingle(); if (sec?.name) sectorName = sec.name }
        const assets = await loadAssets()
        const avatar = await loadAvatar(profile.avatar_url ?? null)
        const report: ReportData = {
          name: displayName, roleLabel: ROLE_LABEL[profile.autonomy_level || ''] || 'Colaborador', sectorName, initials: initialsOf(displayName), avatar,
          monthLabel: currentMonth, prevMonthName: monthNameLower(prev.m),
          periodText: `01/${pad2(ref.m + 1)}/${ref.y} a ${pad2(ref.lastDay)}/${pad2(ref.m + 1)}/${ref.y}`,
          generatedAt: dateStr.replace(' ', ' às '),
          messages: totalMessages, prevMessages, tasksTotal: totalTasks, tasksDone: completedTasks, prevDone, late: lateTasks, prevLate,
          pending: pendingTasks, overdue: overdueTasks, weeks, meetings, warRooms: warRooms || 0, recommendations: recs.slice(0, 4), goal: 80,
        }

        // Generate real PDF using pdf-lib
        let pdfUrl: string | undefined
        let pdfBytes: Uint8Array | null = null
        try {
          pdfBytes = await buildReportPdf(report, assets)
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
            // No public signed link (it exposed the storage address and worked for anyone for 7 days):
            // the chat carries an in-app reference and only the owner can download it (storage policy
            // "Owner downloads own feedback report").
            pdfUrl = `ewvon:file/attachments/${fileName}`
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

      } catch (profileError) {
        console.error(`Error processing ${profile.name}:`, profileError)
        errors.push(`${profile.name}: ${profileError instanceof Error ? profileError.message : 'Unknown error'}`)
      }
    }

    const response = {
      success: true,
      message: `Feedback enviado pelo chat de Comunicados! Mensagens: ${sentDmCount}, PDFs: ${sentPdfCount}`,
      details: { sentDmCount, sentPdfCount, totalRecipients: targetProfiles.length },
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
