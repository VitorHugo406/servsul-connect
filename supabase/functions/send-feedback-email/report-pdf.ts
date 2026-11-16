// Monthly performance report (PDF), laid out exactly like the owner's design "Relatório mensal" (Tela_de_Avisos_4):
// ewvon logo (icon + name), profile photo, KPI strip with change vs the previous month, completion bar with goal,
// weekly evolution chart, activity summary and personalised recommendations. A4, IBM Plex Sans.
import { PDFDocument, rgb, PDFFont, PDFPage, pushGraphicsState, popGraphicsState, moveTo, appendBezierCurve, closePath, clip, endPath } from 'npm:pdf-lib@1.17.1'
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1'

export interface ReportData {
  name: string
  roleLabel: string
  sectorName: string
  initials: string
  avatar?: Uint8Array | null
  monthLabel: string          // "Outubro de 2026"
  prevMonthName: string       // "setembro"
  periodText: string          // "01/10/2026 a 31/10/2026"
  generatedAt: string         // "15/11/2026 às 23:59"
  messages: number
  prevMessages: number
  tasksTotal: number
  tasksDone: number
  prevDone: number
  late: number
  prevLate: number
  pending: number
  overdue: number
  weeks: { label: string; assigned: number; done: number }[]
  meetings: number
  warRooms: number
  recommendations: { tone: 'warn' | 'good'; text: string }[]
  goal: number
}
export interface ReportAssets { regular: Uint8Array | null; medium: Uint8Array | null; semibold: Uint8Array | null; logo: Uint8Array | null }

const hex = (h: string) => { const n = parseInt(h.slice(1), 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255) }
const C = { navy: hex('#1B2340'), ink: hex('#1C2430'), gray: hex('#4A5563'), line: hex('#D3D8E0'), soft: hex('#E3E6EB'), row: hex('#E9ECF0'), track: hex('#E4E7EC'), bar: hex('#D3D8E0'), ok: hex('#0A6B3D'), bad: hex('#B3261E'), amber: hex('#C77700'), amberText: hex('#8A4B00'), text2: hex('#2B3544'), text3: hex('#3C4756'), foot: hex('#5A6472'), grid: hex('#EDEFF2'), white: hex('#FFFFFF') }

export async function buildReportPdf(d: ReportData, a: ReportAssets): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const W = 595.28, H = 841.89, S = W / 794
  const page = doc.addPage([W, H])
  let fR: PDFFont, fM: PDFFont, fS: PDFFont
  try {
    if (!a.regular || !a.medium || !a.semibold) throw new Error('fonts')
    fR = await doc.embedFont(a.regular, { subset: true }); fM = await doc.embedFont(a.medium, { subset: true }); fS = await doc.embedFont(a.semibold, { subset: true })
  } catch {
    const { StandardFonts } = await import('npm:pdf-lib@1.17.1')
    fR = await doc.embedFont(StandardFonts.Helvetica); fM = fR; fS = await doc.embedFont(StandardFonts.HelveticaBold)
  }
  // design px (origin top-left) -> pdf points
  const X = (x: number) => x * S, Y = (y: number) => H - y * S
  const rect = (x: number, y: number, w: number, h: number, color: any) => page.drawRectangle({ x: X(x), y: Y(y + h), width: w * S, height: h * S, color })
  const line = (x1: number, y1: number, x2: number, y2: number, th: number, color: any) => page.drawLine({ start: { x: X(x1), y: Y(y1) }, end: { x: X(x2), y: Y(y2) }, thickness: th * S, color })
  const wid = (t: string, f: PDFFont, size: number, sp = 0) => f.widthOfTextAtSize(t, size * S) / S + sp * Math.max(0, t.length - 1)
  const text = (t: string, x: number, y: number, size: number, f: PDFFont, color: any, o: { align?: 'left' | 'right' | 'center'; sp?: number } = {}) => {
    const sp = o.sp || 0, w = wid(t, f, size, sp)
    let x0 = x; if (o.align === 'right') x0 = x - w; else if (o.align === 'center') x0 = x - w / 2
    if (!sp) { page.drawText(t, { x: X(x0), y: Y(y), size: size * S, font: f, color }); return }
    let cx = x0
    for (const ch of t) { page.drawText(ch, { x: X(cx), y: Y(y), size: size * S, font: f, color }); cx += f.widthOfTextAtSize(ch, size * S) / S + sp }
  }
  const circle = (cx: number, cy: number, r: number, color: any) => page.drawCircle({ x: X(cx), y: Y(cy), size: r * S, color })
  const rrect = (x: number, y: number, w: number, h: number, r: number, color: any) => {
    rect(x + r, y, w - 2 * r, h, color); rect(x, y + r, w, h - 2 * r, color)
    circle(x + r, y + r, r, color); circle(x + w - r, y + r, r, color); circle(x + r, y + h - r, r, color); circle(x + w - r, y + h - r, r, color)
  }
  const tri = (x: number, y: number, up: boolean, color: any) => {   // 8px triangle, (x,y) = left-bottom of its box
    const p = up ? `M0,8 L4,0 L8,8 Z` : `M0,0 L8,0 L4,8 Z`
    page.drawSvgPath(p, { x: X(x), y: Y(y - 8), scale: S, color })
  }
  const wrap = (t: string, f: PDFFont, size: number, maxW: number) => {
    const out: string[] = []; let cur = ''
    for (const w of t.split(/\s+/)) { const n = cur ? cur + ' ' + w : w; if (wid(n, f, size) > maxW && cur) { out.push(cur); cur = w } else cur = n }
    if (cur) out.push(cur); return out
  }

  /* ---------- cabeçalho: logo completa (ícone + nome) ---------- */
  if (a.logo) {
    try { const img = await doc.embedPng(a.logo); const h = 26, w = h * img.width / img.height; page.drawImage(img, { x: X(44), y: Y(46 + h), width: w * S, height: h * S }) } catch { text('ewvon', 44, 70, 28, fS, C.navy) }
  } else text('ewvon', 44, 70, 28, fS, C.navy)
  text('DESEMPENHO DO COLABORADOR', 44, 90, 11, fM, C.gray, { sp: 0.9 })
  text('RELATÓRIO MENSAL', 750, 57, 11, fS, C.gray, { align: 'right', sp: 0.9 })
  text(d.monthLabel, 750, 86, 22, fS, C.navy, { align: 'right' })
  rect(44, 106, 706, 2, C.navy)

  /* ---------- colaborador: foto de perfil ---------- */
  let photo = false
  if (d.avatar) {
    try {
      let img: any
      try { img = await doc.embedJpg(d.avatar) } catch { img = await doc.embedPng(d.avatar) }
      const cx = X(68), cy = Y(155), r = 24 * S, k = 0.5523 * r
      page.pushOperators(pushGraphicsState(), moveTo(cx + r, cy), appendBezierCurve(cx + r, cy + k, cx + k, cy + r, cx, cy + r), appendBezierCurve(cx - k, cy + r, cx - r, cy + k, cx - r, cy),
        appendBezierCurve(cx - r, cy - k, cx - k, cy - r, cx, cy - r), appendBezierCurve(cx + k, cy - r, cx + r, cy - k, cx + r, cy), closePath(), clip(), endPath())
      const sc = Math.max((2 * r) / img.width, (2 * r) / img.height)
      page.drawImage(img, { x: cx - (img.width * sc) / 2, y: cy - (img.height * sc) / 2, width: img.width * sc, height: img.height * sc })
      page.pushOperators(popGraphicsState())
      photo = true
    } catch { photo = false }
  }
  if (!photo) { circle(68, 155, 24, C.navy); text(d.initials, 68, 161, 16, fS, C.white, { align: 'center' }) }
  text(d.name, 106, 152, 17, fS, C.ink)
  text(`${d.roleLabel} · ${d.sectorName}`, 106, 172, 12.5, fR, C.gray)
  const rl = (label: string, val: string, y: number) => { const wv = wid(val, fM, 12); text(val, 750, y, 12, fM, C.ink, { align: 'right' }); text(label, 750 - wv - 4, y, 12, fR, C.gray, { align: 'right' }) }
  rl('Período:', d.periodText, 150); rl('Gerado em:', d.generatedAt, 169)

  /* ---------- KPIs ---------- */
  line(44, 201, 750, 201, 1, C.line); line(44, 302, 750, 302, 1, C.line)
  for (let i = 1; i < 4; i++) line(44 + i * 176.5, 201, 44 + i * 176.5, 302, 1, C.soft)
  const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null)
  type Delta = { up: boolean | null; text: string; tone: 'ok' | 'bad' | 'nt' }
  const dMsg: Delta = (() => { const p = pct(d.messages, d.prevMessages); if (p === null) return d.messages > 0 ? { up: true, text: `novo vs ${d.prevMonthName}`, tone: 'ok' } : { up: null, text: `sem dados em ${d.prevMonthName}`, tone: 'nt' }; if (p === 0) return { up: null, text: `igual a ${d.prevMonthName}`, tone: 'nt' }; return { up: p > 0, text: `${Math.abs(p)}% vs ${d.prevMonthName}`, tone: p > 0 ? 'ok' : 'bad' } })()
  const cnt = (cur: number, prev: number, goodUp: boolean): Delta => { const diff = cur - prev; if (diff === 0) return { up: null, text: prev === 0 && cur === 0 ? `sem dados em ${d.prevMonthName}` : `igual a ${d.prevMonthName}`, tone: 'nt' }; return { up: diff > 0, text: `${Math.abs(diff)} vs ${d.prevMonthName}`, tone: (diff > 0) === goodUp ? 'ok' : 'bad' } }
  const dDone = cnt(d.tasksDone, d.prevDone, true), dLate = cnt(d.late, d.prevLate, false)
  const dPend: Delta = d.overdue > 0 ? { up: null, text: `${d.overdue} já atrasada${d.overdue > 1 ? 's' : ''}`, tone: 'bad' } : { up: null, text: d.pending > 0 ? 'nenhuma atrasada' : 'sem pendências', tone: d.pending > 0 ? 'ok' : 'nt' }
  const kp: { l: string; v: string; sub?: string; d: Delta }[] = [
    { l: 'MENSAGENS', v: String(d.messages), d: dMsg },
    { l: 'TAREFAS CONCLUÍDAS', v: String(d.tasksDone), sub: `/${d.tasksTotal}`, d: dDone },
    { l: 'COM ATRASO', v: String(d.late), d: dLate },
    { l: 'PENDENTES', v: String(d.pending), d: dPend },
  ]
  kp.forEach((k, i) => {
    const x = i === 0 ? 44 : 44 + i * 176.5 + 16
    text(k.l, x, 226, 11, fS, C.gray, { sp: 0.55 })
    text(k.v, x, 263, 30, fS, C.navy)
    if (k.sub) text(k.sub, x + wid(k.v, fS, 30) + 1, 263, 16, fM, C.gray)
    const col = k.d.tone === 'ok' ? C.ok : k.d.tone === 'bad' ? C.bad : C.gray
    let tx = x
    if (k.d.up !== null) { tri(x, 283, k.d.up, col); tx = x + 12 }
    text(k.d.text, tx, 285, 11.5, fM, col)
  })

  /* ---------- taxa de conclusão ---------- */
  const rate = d.tasksTotal > 0 ? Math.round((d.tasksDone / d.tasksTotal) * 100) : 0
  text('TAXA DE CONCLUSÃO', 44, 338, 13, fS, C.navy, { sp: 0.78 })
  const rs = `${rate}%`; text(rs, 44, 384, 34, fS, C.navy)
  text(`${d.tasksDone} de ${d.tasksTotal} tarefas concluídas`, 44 + wid(rs, fS, 34) + 14, 383, 12.5, fR, C.gray)
  rrect(44, 398, 706, 10, 5, C.track)
  if (rate > 0) rrect(44, 398, Math.max(10, 706 * Math.min(rate, 100) / 100), 10, 5, C.navy)
  rect(44 + 706 * d.goal / 100 - 1, 393, 2, 20, C.amber)
  text('0%', 44, 425, 11, fR, C.gray); text('100%', 750, 425, 11, fR, C.gray, { align: 'right' })
  const needed = Math.ceil(d.tasksTotal * d.goal / 100), missing = Math.max(0, needed - d.tasksDone)
  const goalTxt = d.tasksTotal === 0 ? `Meta ${d.goal}%` : rate >= d.goal ? `Meta ${d.goal}% atingida` : `Meta ${d.goal}% · faltaram ${missing} tarefa${missing > 1 ? 's' : ''}`
  text(goalTxt, 397, 425, 11, fS, rate >= d.goal && d.tasksTotal > 0 ? C.ok : C.amberText, { align: 'center' })

  /* ---------- evolução semanal ---------- */
  text('EVOLUÇÃO SEMANAL', 44, 463, 13, fS, C.navy, { sp: 0.78 })
  rect(44, 479, 10, 10, C.bar); text('Atribuídas', 60, 488, 11, fR, C.gray)
  rect(128, 479, 10, 10, C.navy); text('Concluídas', 144, 488, 11, fR, C.gray)
  const top = 497, ax = 44, n = Math.max(1, d.weeks.length)
  const maxA = Math.max(0, ...d.weeks.map(w => w.assigned)), axisMax = Math.max(3, Math.ceil(maxA / 3) * 3), unit = 100 / axisMax
  line(ax + 30, top + 120, ax + 706, top + 120, 1, hex('#C5CBD5'))
  for (const g of [axisMax / 2, axisMax]) line(ax + 30, top + 120 - g * unit, ax + 706, top + 120 - g * unit, 1, C.grid)
  for (const g of [0, axisMax / 2, axisMax]) text(String(Number.isInteger(g) ? g : g.toFixed(1)), ax + 22, top + 124 - g * unit, 10, fR, C.gray, { align: 'right' })
  d.weeks.forEach((w, i) => {
    const cx = ax + 30 + (676 / n) * (i + 0.5)
    const ha = w.assigned * unit, hd = w.done * unit
    if (ha > 0) rrect(cx - 30, top + 120 - ha, 28, ha, 3, C.bar)
    if (hd > 0) rrect(cx + 2, top + 120 - hd, 28, hd, 3, C.navy)
    text(`${w.done}/${w.assigned}`, cx + 16, top + 120 - Math.max(hd, 0) - 6, 11, fS, C.ink, { align: 'center' })
    text(w.label, cx, top + 138, 10.5, fR, C.gray, { align: 'center' })
  })

  /* ---------- resumo + recomendações ---------- */
  text('RESUMO DE ATIVIDADES', 44, 691, 13, fS, C.navy, { sp: 0.78 })
  const rows: [string, string][] = [
    ['Mensagens enviadas no mês', String(d.messages)],
    ['Tarefas concluídas', `${d.tasksDone} de ${d.tasksTotal} (${rate}%)`],
    ['Entregas realizadas com atraso', String(d.late)],
    ['Tarefas pendentes e atrasadas', d.pending > 0 ? `${d.pending} (${d.overdue} atrasada${d.overdue === 1 ? '' : 's'})` : '0'],
    ['Reuniões participadas', String(d.meetings)],
    ['War Rooms atendidas', String(d.warRooms)],
  ]
  rows.forEach((r, i) => { text(r[0], 44, 725 + 33 * i, 12.5, fR, C.text3); text(r[1], 389.4, 725 + 33 * i, 12.5, fS, C.ink, { align: 'right' }); if (i < rows.length - 1) line(44, 738 + 33 * i, 389.4, 738 + 33 * i, 1, C.row) })

  text('RECOMENDAÇÕES PERSONALIZADAS', 421.4, 691, 13, fS, C.navy, { sp: 0.78 })
  let ry = 717
  for (const rc of d.recommendations.slice(0, 4)) {
    const col = rc.tone === 'warn' ? C.amber : C.ok, lab = rc.tone === 'warn' ? C.amberText : C.ok
    circle(425.9, ry - 4, 4.5, col)
    text(rc.tone === 'warn' ? 'ATENÇÃO' : 'POSITIVO', 440.4, ry, 11, fS, lab, { sp: 0.55 })
    const lines = wrap(rc.text, fR, 12.5, 309)
    lines.forEach((ln, i) => text(ln, 440.4, ry + 20 + 18.75 * i, 12.5, fR, C.text2))
    ry = ry + 20 + 18.75 * (lines.length - 1) + 29
    if (ry > 1030) break
  }

  /* ---------- rodapé ---------- */
  line(44, 1060, 750, 1060, 1, C.line)
  text(`Relatório gerado automaticamente pelo ewvon em ${d.generatedAt}`, 44, 1084, 10.5, fR, C.foot)
  text('© 2026 ewvon · Todos os direitos reservados · Página 1 de 1', 750, 1084, 10.5, fR, C.foot, { align: 'right' })

  return await doc.save()
}
