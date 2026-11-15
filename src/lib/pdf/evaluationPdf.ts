// Standard evaluation forms (A4, 2 pages): contract of experience (45/90 days) and performance & development.
// Same layout for every company: company logo as a watermark, company color on the bars, mostly black and white
// so it prints well. Employee data, scores and comments are filled in from the system.
import type { jsPDF } from 'jspdf';
import { BLACK, GRAY, Img, LGRAY, PAGE_H as H, PAGE_W as W, Pdf, RGB, Theme, WHITE, makeTheme, newDoc, qrData } from './pdfKit';
import { EvalKind, FORM_TYPES, FormType, PRESETS, classify } from '../evalPresets';

export interface EvalPdfItem { name: string; description?: string; group?: string; score: number | null; prev?: number | null }
export interface EvalPdfEmployee {
  name?: string; registration?: string; admission?: string; job?: string; department?: string; manager?: string;
  contractStart?: string; end1?: string; end2?: string; periodFrom?: string; periodTo?: string; lastEval?: string;
}
export interface EvalPdfOptions {
  kind: EvalKind;
  formType: FormType;
  companyName: string;
  cnpj?: string | null;
  primaryColor?: string | null;
  logo?: Img | null;
  ewvonLogo?: Img | null;
  doc: { number: number; key: string; issuedAt: Date; version: number; url: string };
  employee: EvalPdfEmployee;
  evaluationDate?: string;
  items: EvalPdfItem[];
  average?: number | null;
  prevAverage?: number | null;   // 45-day average, for the 90-day evolution
  strengths?: string | null;
  improvements?: string | null;
  feedback?: string | null;
  employeeComment?: string | null;
  decision?: 'effective' | 'extend' | 'terminate' | null;
  contractEnd?: string;          // dd/mm/yyyy, "Término do contrato"
  evaluatorName?: string;
}

const M = 34, CW = W - 2 * M;
const fmt1 = (v: number | null | undefined) => (v == null ? '' : v.toFixed(1).replace('.', ','));
const dmy = (d: Date) => d.toLocaleDateString('pt-BR');

interface Ctx { p: Pdf; o: EvalPdfOptions; t: Theme; total: number; qr?: string }

function field(c: Ctx, x: number, y: number, w: number, h: number, label: string, value?: string) {
  c.p.rr(x, y - h, w, h, 7, { fill: WHITE, stroke: [89, 89, 89], lw: 0.7 });
  c.p.text(x + 8, y - 10, label.toUpperCase(), { w: 'Medium', size: 6.2, color: GRAY });
  if (value) c.p.text(x + 8, y - h + 8.5, c.p.ellipsize(value, 'Medium', 8.6, w - 16), { w: 'Medium', size: 8.6 });
}
function section(c: Ctx, y: number, title: string) {
  c.p.rr(M, y - 17, CW, 17, 8.5, { fill: c.t.bar });
  c.p.text(M + 13, y - 12, title.toUpperCase(), { w: 'Bold', size: 8.3, color: c.t.barText });
  return y - 17 - 6;
}
function checkbox(c: Ctx, x: number, y: number, label: string, checked: boolean, fs = 8.6) {
  const size = 9.5;
  c.p.rr(x, y, size, size, 2.5, { fill: checked ? c.t.bar : WHITE, stroke: BLACK, lw: 1 });
  if (checked) { c.p.line(x + 2.2, y + 4.8, x + 4.2, y + 2.4, c.t.barText, 1.4); c.p.line(x + 4.2, y + 2.4, x + 7.6, y + 7.2, c.t.barText, 1.4); }
  c.p.text(x + size + 6, y + 1.6, label, { w: 'Medium', size: fs });
  return x + size + 6 + c.p.width(label, 'Medium', fs);
}
function linedBox(c: Ctx, x: number, y: number, w: number, h: number, label: string, lines: number, value?: string | null, size = 7.6) {
  c.p.rr(x, y - h, w, h, 9, { fill: WHITE, stroke: [89, 89, 89], lw: 0.7 });
  c.p.text(x + 10, y - 11, label.toUpperCase(), { w: 'Medium', size: 6.3, color: GRAY });
  const step = (h - 22) / lines;
  for (let i = 0; i < lines; i++) { const ly = y - 22 - step * (i + 1) + 4; c.p.line(x + 10, ly, x + w - 10, ly, LGRAY, 0.5, [1.5, 2.5]); }
  const text = (value || '').replace(/\s+/g, ' ').trim();
  if (text) {
    let all = c.p.split(text, 'Regular', size, w - 20);
    if (all.length > lines) { all = all.slice(0, lines); all[lines - 1] = c.p.ellipsize(all[lines - 1] + ' …', 'Regular', size, w - 20); }
    all.forEach((ln, i) => { const ly = y - 22 - step * (i + 1) + 4 + 2.6; c.p.text(x + 10, ly, ln, { size, color: BLACK }); });
  }
}

function frame(c: Ctx, page: number) {
  const { p, o, t } = c;
  if (o.logo) p.opacity(0.07, () => p.fit(o.logo!, (W - 400) / 2, H / 2 - 200 - 20, 400, 400));
  const top = H - 30, fm = 46;
  if (o.logo) {
    p.rr(M, top - fm, fm, fm, 11, { fill: WHITE, stroke: LGRAY, lw: 0.6 });
    p.clipRR(M, top - fm, fm, fm, 11, () => p.fit(o.logo!, M + 3, top - fm + 3, fm - 6, fm - 6));
  } else {
    p.rr(M, top - fm, fm, fm, 11, { fill: t.accent });
    p.text(M + fm / 2, top - fm / 2 - 6, o.companyName.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase(), { w: 'Bold', size: 17, color: t.onAccent, align: 'c' });
  }
  p.text(M + fm + 14, top - 18, p.ellipsize(o.companyName.toUpperCase(), 'Bold', 15, 290), { w: 'Bold', size: 15 });
  if (o.cnpj) p.text(M + fm + 14, top - 32, `CNPJ: ${o.cnpj}`, { w: 'Medium', size: 8.8, color: GRAY });
  p.text(M + fm + 14, top - 43, 'Departamento de Recursos Humanos', { size: 7.8, color: GRAY });
  const bw = 168, bh = 46, bx = W - M - bw;
  p.rr(bx, top - bh, bw, bh, 12, { fill: WHITE, stroke: BLACK, lw: 1.2 });
  const code = o.kind === 'experience' ? 'RH-EXP' : 'RH-DES';
  p.text(bx + 12, top - 15, 'CÓDIGO', { w: 'Medium', size: 6, color: GRAY });
  p.text(bx + 12, top - 27, code, { w: 'Bold', size: 10 });
  p.text(bx + 12, top - 39, `Versão ${o.doc.version}.0`, { w: 'Medium', size: 7.6, color: GRAY });
  const rev = new Date(o.doc.issuedAt); rev.setFullYear(rev.getFullYear() + 1);
  p.text(bx + bw - 12, top - 15, 'EMISSÃO', { w: 'Medium', size: 6, color: GRAY, align: 'r' });
  p.text(bx + bw - 12, top - 27, dmy(o.doc.issuedAt), { w: 'Bold', size: 10, align: 'r' });
  p.text(bx + bw - 12, top - 39, `Revisão: ${dmy(rev)}`, { w: 'Medium', size: 7.6, color: GRAY, align: 'r' });
  p.rr(M, top - fm - 11, CW, 3.5, 1.7, { fill: t.accent });

  // footer: document code + validation QR + page number
  p.line(M, 78, W - M, 78, LGRAY, 0.6);
  const bx2 = M, by = 16, bs = 56, q = 46;
  p.rr(bx2, by, bs, bs, 10, { fill: WHITE, stroke: BLACK, lw: 1 });
  p.image(c.qr!, bx2 + (bs - q) / 2, by + (bs - q) / 2, q, q);
  const tx = bx2 + bs + 12, num = String(o.doc.number).padStart(5, '0');
  p.text(tx, by + 46, 'VALIDAÇÃO DO DOCUMENTO', { w: 'Medium', size: 6.2, color: GRAY });
  p.text(tx, by + 31, `AVALIAÇÃO  ·  CÓD. ${num}`, { w: 'Bold', size: 12 });
  p.text(tx, by + 20, 'Escaneie o QR Code para conferir a autenticidade deste documento no sistema.', { size: 6.5, color: GRAY });
  p.text(tx, by + 9, `Chave: ${o.doc.key}  |  ${code}  |  Versão ${o.doc.version}.0  |  Emitido em ${dmy(o.doc.issuedAt)}`, { size: 6.3, color: GRAY });
  p.text(W - M, by + 44, `Página ${page} de ${c.total}`, { w: 'Bold', size: 8, align: 'r' });
  p.text(W - M, by + 33, `Cód. ${num}`, { w: 'Medium', size: 6.8, color: GRAY, align: 'r' });
  const eh = 9, ewid = o.ewvonLogo ? (eh * o.ewvonLogo.w) / o.ewvonLogo.h : 34, capw = ewid + 18;
  p.text(W - M - capw - 5, by + 7, 'Gerado por', { size: 6.5, color: GRAY, align: 'r' });
  p.rr(W - M - capw, by + 2, capw, 15, 7.5, { fill: [0, 0, 0] });
  if (o.ewvonLogo) p.image(o.ewvonLogo.data, W - M - capw + 9, by + 5, ewid, eh); else p.text(W - M - capw / 2, by + 6, 'ewvon', { w: 'Bold', size: 7, color: WHITE, align: 'c' });
  return top - fm - 11 - 14;
}

function groupItems(o: EvalPdfOptions): { group: string; items: EvalPdfItem[] }[] {
  const preset = PRESETS[o.kind];
  const byName = new Map(preset.flatMap((g) => g.items.map((i) => [i.name, { group: g.group, description: i.description }] as const)));
  const groups: { group: string; items: EvalPdfItem[] }[] = [];
  for (const it of o.items) {
    const meta = byName.get(it.name);
    const g = it.group || meta?.group || 'CRITÉRIOS';
    const item = { ...it, description: it.description ?? meta?.description };
    const found = groups.find((x) => x.group === g);
    if (found) found.items.push(item); else groups.push({ group: g, items: [item] });
  }
  // keep the printed order of the model
  const order = preset.map((g) => g.group);
  groups.sort((a, b) => (order.indexOf(a.group) + 99) % 99 - (order.indexOf(b.group) + 99) % 99);
  return groups;
}

function page1(c: Ctx) {
  const { p, o, t } = c;
  const exp = o.kind === 'experience', e = o.employee;
  let y = frame(c, 1);
  p.text(W / 2, y - 8, exp ? 'AVALIAÇÃO DO CONTRATO DE EXPERIÊNCIA' : 'AVALIAÇÃO DE DESEMPENHO E DESENVOLVIMENTO', { w: 'Bold', size: exp ? 15.5 : 14.5, align: 'c' });
  p.text(W / 2, y - 21, exp ? 'Formulário de acompanhamento do período de experiência do colaborador' : 'Formulário de acompanhamento do desempenho e do plano de desenvolvimento do colaborador', { size: 8, color: GRAY, align: 'c' });
  y -= 32;
  y = section(c, y, '1. Identificação do colaborador');
  const rh = 29, g = 6, w1 = CW * 0.56, w2 = CW * 0.22, w3 = CW - w1 - w2 - 2 * g;
  field(c, M, y, w1, rh, 'Nome completo', e.name);
  field(c, M + w1 + g, y, w2, rh, 'Matrícula', e.registration);
  field(c, M + w1 + w2 + 2 * g, y, w3, rh, 'Data de admissão', e.admission);
  y -= rh + g;
  const wa = (CW - 2 * g) / 3;
  field(c, M, y, wa, rh, 'Cargo / função', e.job);
  field(c, M + wa + g, y, wa, rh, 'Departamento', e.department);
  field(c, M + 2 * (wa + g), y, wa, rh, 'Gestor avaliador', e.manager);
  y -= rh + g;
  if (exp) {
    field(c, M, y, wa, rh, 'Início do contrato de experiência', e.contractStart);
    field(c, M + wa + g, y, wa, rh, 'Término do 1º período', e.end1);
    field(c, M + 2 * (wa + g), y, wa, rh, 'Término após prorrogação (se houver)', e.end2);
  } else {
    field(c, M, y, wa, rh, 'Período avaliado (de)', e.periodFrom);
    field(c, M + wa + g, y, wa, rh, 'Período avaliado (até)', e.periodTo);
    field(c, M + 2 * (wa + g), y, wa, rh, 'Data da última avaliação', e.lastEval);
  }
  y -= rh + 12;

  y = section(c, y, '2. Tipo de avaliação');
  const by = y - 20; let x = M + 6;
  const types = FORM_TYPES.filter((f) => f.kind === o.kind);
  for (const ty of types) x = checkbox(c, x, by, ty.label, ty.id === o.formType, 8.2) + 14;
  p.text(W - M - 6, by + 1.6, `Data da avaliação: ${o.evaluationDate || '___/___/_____'}`, { w: 'Medium', size: 8, align: 'r' });
  y -= 34;

  y = section(c, y, '3. Critérios de avaliação e notas');
  p.text(M + 2, y - 8, 'Marque com X a nota de cada critério e transcreva-a na coluna Nota.  1 = Insuficiente · 2 = Abaixo do esperado · 3 = Atende · 4 = Supera · 5 = Excepcional', { size: 6.9, color: GRAY });
  y -= 14;

  const groups = groupItems(o);
  const evo = o.formType === 'exp90' && o.items.some((i) => i.prev != null);
  const noW = 24, ciW = 33, notaW = 56, evoW = evo ? 66 : 0;
  const critW = CW - noW - 5 * ciW - notaW - evoW;
  const xCrit = M + noW, xEvo = xCrit + critW, xC0 = xEvo + evoW, xNota = xC0 + 5 * ciW;
  const hh = 26, gh = 17, rh2 = exp ? 28 : 26, mh = 36;
  const nItems = groups.reduce((s, gr) => s + gr.items.length, 0);
  const th = hh + groups.length * gh + nItems * rh2 + mh, ty0 = y, tb = ty0 - th;

  p.clipRR(M, tb, CW, th, 10, () => {
    p.rect(M, tb, CW, th, { fill: WHITE });
    p.rect(M, ty0 - hh, CW, hh, { fill: [237, 237, 237] });
    let yy = ty0 - hh, idx = 0;
    for (const gr of groups) {
      p.rect(M, yy - gh, CW, gh, { fill: t.soft }); yy -= gh;
      for (let k = 0; k < gr.items.length; k++) { if (idx % 2 === 1) p.rect(M, yy - rh2, CW, rh2, { fill: [248, 248, 248] }); yy -= rh2; idx++; }
    }
    p.rect(M, tb, CW, mh, { fill: [237, 237, 237] });
  });
  p.text(M + noW / 2, ty0 - 16, 'Nº', { w: 'Bold', size: 7.4, align: 'c' });
  p.text(xCrit + 8, ty0 - 16, 'CRITÉRIO', { w: 'Bold', size: 7.4 });
  if (evo) { p.text(xEvo + evoW / 2, ty0 - 12, 'EVOLUÇÃO', { w: 'Bold', size: 6.6, align: 'c' }); p.text(xEvo + evoW / 2, ty0 - 21, '45 dias → 90 dias', { size: 5.6, color: GRAY, align: 'c' }); }
  ['Insuf.', 'Abaixo', 'Atende', 'Supera', 'Excep.'].forEach((lab, i) => {
    const cx = xC0 + i * ciW + ciW / 2;
    p.text(cx, ty0 - 12, String(i + 1), { w: 'Bold', size: 8.4, align: 'c' });
    p.text(cx, ty0 - 21, lab, { size: 5.6, color: GRAY, align: 'c' });
  });
  p.text(xNota + notaW / 2, ty0 - 16, 'NOTA', { w: 'Bold', size: 7.4, align: 'c' });

  let yy = ty0 - hh, num = 1, sum = 0, cnt = 0;
  for (const gr of groups) {
    p.text(M + 9, yy - 11.6, gr.group, { w: 'Bold', size: 7.2 });
    yy -= gh;
    for (const it of gr.items) {
      p.text(M + noW / 2, yy - 17, String(num), { w: 'Bold', size: 8.6, align: 'c' });
      p.text(xCrit + 8, yy - 12.5, p.ellipsize(it.name, 'Bold', 8.4, critW - 12), { w: 'Bold', size: 8.4 });
      if (it.description) p.text(xCrit + 8, yy - 22, p.ellipsize(it.description, 'Regular', 6.5, critW - 12), { size: 6.5, color: GRAY });
      if (evo && it.prev != null) miniEvolution(c, xEvo, yy, evoW, rh2, it.prev, it.score);
      for (let i = 0; i < 5; i++) {
        const cx = xC0 + i * ciW + ciW / 2, on = it.score != null && Math.round(it.score) === i + 1;
        p.circle(cx, yy - rh2 / 2, 8, on ? { fill: t.bar, stroke: BLACK, lw: 0.8 } : { stroke: [140, 140, 140], lw: 0.8 });
        p.text(cx, yy - rh2 / 2 - 2.3, String(i + 1), { size: 6.6, color: on ? t.barText : LGRAY, align: 'c' });
      }
      p.rr(xNota + 11, yy - rh2 / 2 - 9, notaW - 22, 18, 6, { fill: WHITE, stroke: BLACK, lw: 1 });
      if (it.score != null) { p.text(xNota + notaW / 2, yy - rh2 / 2 - 3, String(Math.round(it.score)), { w: 'Bold', size: 9.5, align: 'c' }); sum += Math.round(it.score); cnt++; }
      for (const vx of [xCrit, xEvo, xC0, xNota]) if (vx !== xEvo || evo) p.line(vx, yy, vx, yy - rh2, [191, 191, 191], 0.5);
      yy -= rh2; num++;
    }
  }
  // average row
  const mid = tb + mh / 2;
  p.text(M + 9, mid + 3, 'CÁLCULO DA MÉDIA', { w: 'Bold', size: 7.2 });
  if (evo && o.prevAverage != null && o.average != null) {
    const d = o.average - o.prevAverage;
    p.text(M + 9, mid - 6, `Evolução: ${fmt1(o.prevAverage)} (45 dias) → ${fmt1(o.average)} (90 dias)  ${d > 0.04 ? '▲' : d < -0.04 ? '▼' : '='} ${d >= 0 ? '+' : ''}${fmt1(d)}`.replace('▲', '+').replace('▼', '−'), { w: 'Medium', size: 6.5, color: GRAY });
  } else p.text(M + 9, mid - 6, 'Média = soma das notas ÷ nº de critérios avaliados', { size: 6.5, color: GRAY });
  const bxm = xC0 - 10;
  p.text(bxm, mid - 3, 'Soma:', { w: 'Medium', size: 7.8, align: 'r' });
  p.rr(bxm + 4, mid - 9, 38, 18, 6, { fill: WHITE, stroke: BLACK, lw: 1 });
  if (cnt) p.text(bxm + 23, mid - 3, String(sum), { w: 'Bold', size: 9, align: 'c' });
  p.text(bxm + 58, mid - 3, '÷', { w: 'Bold', size: 9, align: 'c' });
  p.text(bxm + 62, mid - 3, 'Nº:', { w: 'Medium', size: 7.8 });
  p.rr(bxm + 80, mid - 9, 30, 18, 6, { fill: WHITE, stroke: BLACK, lw: 1 });
  if (cnt) p.text(bxm + 95, mid - 3, String(cnt), { w: 'Bold', size: 9, align: 'c' });
  p.text(bxm + 124, mid - 3, '=', { w: 'Bold', size: 9, align: 'c' });
  p.text(bxm + 134, mid - 3, 'MÉDIA:', { w: 'Bold', size: 8.2 });
  p.rr(xNota + 3, mid - 12, notaW - 6, 24, 8, { fill: t.accent, stroke: BLACK, lw: 1.4 });
  if (o.average != null) p.text(xNota + notaW / 2, mid - 4, fmt1(o.average), { w: 'Bold', size: 11, color: t.onAccent, align: 'c' });
  for (const vx of [xCrit, xC0, xNota]) p.line(vx, ty0, vx, ty0 - hh, [191, 191, 191], 0.5);
  p.rr(M, tb, CW, th, 10, { stroke: BLACK, lw: 1.3 });
  p.text(M + 2, tb - 11, exp ? 'Avalie apenas com base em critérios objetivos, relacionados à função e observados durante o período de experiência.' : 'Avalie com base em fatos e entregas observados no período, com critérios objetivos ligados à função.', { size: 6.6, color: GRAY });
}

/** Two small bars (45 days gray, 90 days dark) plus the change. */
function miniEvolution(c: Ctx, x: number, yTop: number, w: number, h: number, prev: number, cur: number | null) {
  const { p, t } = c;
  const maxLen = w - 30, x0 = x + 6, yMid = yTop - h / 2;
  p.rr(x0, yMid + 1.5, Math.max(2, (prev / 5) * maxLen), 5, 1.5, { fill: [166, 166, 166] });
  p.text(x0 + (prev / 5) * maxLen + 2.5, yMid + 2, String(Math.round(prev)), { size: 5.4, color: GRAY });
  if (cur != null) {
    p.rr(x0, yMid - 6.5, Math.max(2, (cur / 5) * maxLen), 5, 1.5, { fill: t.bar, stroke: BLACK, lw: 0.3 });
    p.text(x0 + (cur / 5) * maxLen + 2.5, yMid - 6, String(Math.round(cur)), { w: 'Bold', size: 5.6 });
    const d = Math.round(cur) - Math.round(prev), ax = x + w - 12, ay = yMid - 1;
    if (d > 0) p.poly([[ax - 4, ay - 3], [ax + 4, ay - 3], [ax, ay + 4]], { fill: BLACK });
    else if (d < 0) p.poly([[ax - 4, ay + 3], [ax + 4, ay + 3], [ax, ay - 4]], { stroke: BLACK, lw: 1 });
    else p.line(ax - 3.5, ay, ax + 3.5, ay, BLACK, 1.2);
    p.text(ax, ay - 9, d === 0 ? '=' : `${d > 0 ? '+' : '−'}${Math.abs(d)}`, { w: 'Bold', size: 5.8, align: 'c' });
  }
}

const REF: [string, string][] = [['4,5 a 5,0', 'Excepcional'], ['3,5 a 4,4', 'Supera as expectativas'], ['2,5 a 3,4', 'Atende às expectativas'], ['1,5 a 2,4', 'Abaixo do esperado'], ['1,0 a 1,4', 'Insuficiente']];

function resultBlock(c: Ctx, y: number) {
  const { p, o, t } = c;
  const exp = o.kind === 'experience';
  y = section(c, y, '4. Resultado da avaliação');
  const rh = 15, tw = 262, th = 14 + rh * REF.length;
  p.rr(M, y - th, tw, th, 9, { fill: WHITE, stroke: BLACK, lw: 1 });
  p.text(M + 10, y - 10, 'REFERÊNCIA DA MÉDIA (ORIENTATIVA)', { w: 'Bold', size: 6.6 });
  REF.forEach(([faixa, rot], i) => { const ly = y - 14 - rh * (i + 1) + 4.5; p.text(M + 12, ly, faixa, { w: 'Bold', size: 7.8 }); p.text(M + 78, ly, rot, { size: 7.8 }); });
  const rx = M + tw + 10, rw = CW - tw - 10;
  p.rr(rx, y - th, rw, th, 9, { fill: WHITE, stroke: BLACK, lw: 1 });
  p.text(rx + 12, y - 12, 'MÉDIA FINAL (transcrever da página 1)', { w: 'Bold', size: 6.8 });
  p.rr(rx + 12, y - 50, 74, 32, 10, { fill: t.accent, stroke: BLACK, lw: 1.4 });
  if (o.average != null) p.text(rx + 49, y - 38, fmt1(o.average), { w: 'Bold', size: 15, color: t.onAccent, align: 'c' });
  p.text(rx + 98, y - 26, 'Classificação:', { w: 'Medium', size: 7.6 });
  p.line(rx + 98, y - 46, rx + rw - 12, y - 46, GRAY, 0.6);
  if (o.average != null) p.text(rx + 98, y - 43, classify(o.average), { w: 'Bold', size: 8.4 });
  p.text(rx + 12, y - 62, exp ? 'A média é referência de apoio. A decisão final é do gestor e do RH,' : 'A média é referência de apoio ao diálogo de desenvolvimento.', { size: 6.4, color: GRAY });
  p.text(rx + 12, y - 70, exp ? 'considerando o conjunto do desempenho e as observações abaixo.' : 'Considere o conjunto das entregas e as observações abaixo.', { size: 6.4, color: GRAY });
  return y - th - 12;
}

function signatures(c: Ctx, y: number, lineY: number) {
  const { p } = c;
  y = section(c, y, '8. Ciência e assinaturas');
  const gap = 14, sw = (CW - 2 * gap) / 3, ly = y - lineY;
  [['Gestor avaliador', 'Nome / assinatura'], ['Colaborador avaliado', 'Ciência da avaliação'], ['Recursos Humanos', 'Nome / assinatura']].forEach(([t1, t2], i) => {
    const sx = M + i * (sw + gap);
    p.line(sx, ly, sx + sw, ly, BLACK, 0.8);
    p.text(sx + sw / 2, ly - 9, t1, { w: 'Bold', size: 7.6, align: 'c' });
    p.text(sx + sw / 2, ly - 18, t2, { size: 6.6, color: GRAY, align: 'c' });
    p.text(sx + sw / 2, ly - 30, 'Data: ____ / ____ / ________', { size: 7, align: 'c' });
  });
  return ly - 40;
}
function notes(c: Ctx, y: number, texts: string[]) {
  const { p } = c;
  let lines: string[] = [];
  for (const n of texts) lines = lines.concat(p.split(n, 'Regular', 6.3, CW - 20), ['']);
  lines = lines.slice(0, -1);
  const hbox = 12 + 8.2 * lines.length;
  p.rr(M, y - hbox, CW, hbox, 8, { fill: [247, 247, 247], stroke: LGRAY, lw: 0.6 });
  let ty = y - 11;
  for (const ln of lines) { if (ln) p.text(M + 10, ty, ln, { size: 6.3, color: GRAY }); ty -= ln ? 8.2 : 4; }
}

function page2Experience(c: Ctx) {
  const { p, o } = c;
  let y = frame(c, 2);
  y = resultBlock(c, y);
  y = section(c, y, '5. Parecer e decisão');
  let by = y - 17; const x = M + 6;
  checkbox(c, x, by, 'Efetivar o colaborador no quadro de funcionários', o.decision === 'effective');
  by -= 17; checkbox(c, x, by, 'Prorrogar o contrato de experiência (uma única vez; total de até 90 dias)', o.decision === 'extend');
  by -= 17; checkbox(c, x, by, 'Não efetivar: encerrar o contrato ao término do período de experiência', o.decision === 'terminate');
  p.text(W - M - 6, y - 17 + 1.6, `Término do contrato: ${o.contractEnd || '____ / ____ / ________'}`, { w: 'Medium', size: 8, align: 'r' });
  y -= 17 * 3 + 8;
  y = section(c, y, '6. Observações do avaliador');
  const bh = 56;
  linedBox(c, M, y, CW, bh, 'Pontos fortes observados', 3, o.strengths); y -= bh + 6;
  linedBox(c, M, y, CW, bh, 'Pontos a desenvolver e orientações dadas ao colaborador', 3, o.improvements); y -= bh + 6;
  linedBox(c, M, y, CW, bh, 'Observações gerais', 3, o.feedback); y -= bh + 12;
  y = section(c, y, '7. Manifestação do colaborador (opcional)');
  linedBox(c, M, y, CW, 50, 'Comentários do colaborador sobre a avaliação', 2, o.employeeComment); y -= 50 + 12;
  y = signatures(c, y, 36);
  notes(c, y, [
    'Base legal de referência: contrato de experiência (CLT, art. 443, §2º, alínea “c”); prazo máximo de 90 dias (art. 445, parágrafo único); uma única prorrogação, desde que o total não exceda 90 dias (art. 451). Avaliação por critérios objetivos e não discriminatórios (Constituição Federal, art. 7º, XXX; Lei nº 9.029/1995).',
    'A assinatura do colaborador indica apenas ciência do conteúdo, não concordância. Este documento contém dados pessoais, tratados conforme a Lei nº 13.709/2018 (LGPD), com acesso restrito ao RH e à gestão e guarda conforme a política interna da empresa.',
  ]);
}

function page2Development(c: Ctx) {
  const { p, o, t } = c;
  let y = frame(c, 2);
  y = resultBlock(c, y);
  y = section(c, y, '5. Pontos fortes, oportunidades de melhoria e feedback geral');
  const hw = (CW - 10) / 2, bh = 58;
  linedBox(c, M, y, hw, bh, 'Pontos fortes observados', 3, o.strengths, 7.2);
  linedBox(c, M + hw + 10, y, hw, bh, 'Oportunidades de melhoria', 3, o.improvements, 7.2);
  y -= bh + 6;
  linedBox(c, M, y, CW, 44, 'Feedback geral do avaliador', 2, o.feedback); y -= 44 + 12;

  y = section(c, y, '6. Plano de Desenvolvimento Individual (PDI)');
  const cols: [string, number][] = [['COMPETÊNCIA / OBJETIVO', 150], ['AÇÃO DE DESENVOLVIMENTO', 195], ['PRAZO', 72], ['RESPONSÁVEL', CW - 150 - 195 - 72]];
  const hh = 17, rowh = 21, nrows = 4, th = hh + rowh * nrows;
  p.clipRR(M, y - th, CW, th, 9, () => { p.rect(M, y - th, CW, th, { fill: WHITE }); p.rect(M, y - hh, CW, hh, { fill: [237, 237, 237] }); });
  let x = M;
  cols.forEach(([lab, w], i) => { p.text(x + 8, y - 11.5, lab, { w: 'Bold', size: 6.6 }); if (i) p.line(x, y, x, y - th, [191, 191, 191], 0.5); x += w; });
  for (let r = 1; r <= nrows; r++) { const yy = y - hh - rowh * (r - 1); p.line(M, yy, M + CW, yy, [191, 191, 191], 0.5); p.text(M + 8, yy - rowh + 8, `${r}.`, { w: 'Medium', size: 7, color: LGRAY }); }
  p.rr(M, y - th, CW, th, 9, { stroke: BLACK, lw: 1 });
  y -= th + 12;

  y = section(c, y, '7. Metas do próximo ciclo e manifestação do colaborador');
  linedBox(c, M, y, hw, bh, 'Metas combinadas para o próximo ciclo', 3, null, 7.2);
  linedBox(c, M + hw + 10, y, hw, bh, 'Comentários e interesses de carreira do colaborador', 3, o.employeeComment, 7.2);
  y -= bh + 8;
  p.text(M + 6, y - 6, 'Data da próxima avaliação:  ____ / ____ / ________', { w: 'Medium', size: 8.2 });
  y -= 18;
  y = signatures(c, y, 30);
  void t;
  notes(c, y, [
    'Avaliação realizada no âmbito do poder diretivo do empregador (CLT, art. 2º), com critérios objetivos, ligados à função e não discriminatórios (Constituição Federal, art. 7º, XXX; Lei nº 9.029/1995). O PDI é um compromisso de desenvolvimento construído em conjunto pelo gestor e pelo colaborador.',
    'A assinatura do colaborador indica ciência do conteúdo, não concordância. Este documento contém dados pessoais, tratados conforme a Lei nº 13.709/2018 (LGPD), com acesso restrito ao RH e à gestão e guarda conforme a política interna da empresa.',
  ]);
}

export async function buildEvaluationPdf(o: EvalPdfOptions): Promise<jsPDF> {
  const doc = await newDoc();
  const c: Ctx & { qr?: string } = { p: new Pdf(doc), o, t: makeTheme(o.primaryColor), total: 2 };
  c.qr = await qrData(o.doc.url);
  page1(c);
  doc.addPage();
  (o.kind === 'experience' ? page2Experience : page2Development)(c);
  doc.setProperties({ title: `Avaliação ${o.kind === 'experience' ? 'de Contrato de Experiência' : 'de Desempenho e Desenvolvimento'} - ${o.companyName}`, author: o.companyName, subject: `Cód. ${String(o.doc.number).padStart(5, '0')} - Versão ${o.doc.version}.0` });
  return doc;
}
