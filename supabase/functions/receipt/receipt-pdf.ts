// Payment receipt (A4 PDF), laid out exactly like the owner's design "Recibo de pagamento" (Tela_de_Avisos_5):
// full ewvon logo (icon + name), quitação declaration, emitente/pagador, payment data, itemised table, authentication code.
// No CPF/CNPJ is printed on purpose (data protection; the company has no CNPJ yet): add the document rows back here when it exists.
// Pure drawing code: data in, bytes out. Fonts: IBM Plex Sans + Plex Serif (Helvetica/Times fallback).
import { PDFDocument, PDFFont, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';

export interface ReceiptFonts { sansR: Uint8Array | null; sansM: Uint8Array | null; sansS: Uint8Array | null; sansB: Uint8Array | null; serifR: Uint8Array | null; serifS: Uint8Array | null }
export interface ReceiptData {
  number: string;
  paidAt: Date;
  paymentId: string;
  items: { description: string; qty: number; unitCents: number }[];
  customer: { name: string; legalName: string; adminEmail: string };
  issuer: { brand: string; owner: string; place: string; email: string };
  logoPng?: Uint8Array | null;
  fonts?: ReceiptFonts | null;
}

const hex = (h: string) => { const n = parseInt(h.slice(1), 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };
const C = { navy: hex('#0E1A3A'), ink: hex('#1C2430'), gray: hex('#4A5563'), text3: hex('#3C4756'), line: hex('#C5CBD5'), soft: hex('#E3E6EB'), ok: hex('#0A6B3D'), foot: hex('#5A6472') };

export const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ');
const brDate = (d: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
const longDate = (d: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'long', year: 'numeric' }).format(d).replace(/ de /g, ' de ');

/** Amount in words (pt-BR), e.g. 100 -> "um real", 123456 -> "mil, duzentos e trinta e quatro reais e cinquenta e seis centavos". */
export function extenso(cents: number): string {
  const U = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const D = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const Cn = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  const below1000 = (n: number): string => {
    if (n === 0) return '';
    if (n === 100) return 'cem';
    const c = Math.floor(n / 100), r = n % 100, parts: string[] = [];
    if (c) parts.push(Cn[c]);
    if (r) parts.push(r < 20 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' e ' + U[r % 10] : ''));
    return parts.join(' e ');
  };
  const num = (n: number): string => {
    if (n === 0) return 'zero';
    const out: string[] = [];
    const bi = Math.floor(n / 1e9), mi = Math.floor((n % 1e9) / 1e6), mil = Math.floor((n % 1e6) / 1e3), rest = n % 1e3;
    if (bi) out.push(bi === 1 ? 'um bilhão' : below1000(bi) + ' bilhões');
    if (mi) out.push(mi === 1 ? 'um milhão' : below1000(mi) + ' milhões');
    if (mil) out.push(mil === 1 ? 'mil' : below1000(mil) + ' mil');
    if (rest) out.push(below1000(rest));
    // "e" before the last group when it is < 100 or a round hundred ("mil e cinquenta", "mil e quinhentos")
    if (out.length > 1 && (rest > 0 && (rest < 100 || rest % 100 === 0))) { const last = out.pop()!; return out.join(', ') + ' e ' + last; }
    return out.join(', ');
  };
  const reais = Math.floor(cents / 100), cent = cents % 100;
  const r = reais ? `${num(reais)} ${reais === 1 ? 'real' : 'reais'}` : '';
  const c = cent ? `${num(cent)} ${cent === 1 ? 'centavo' : 'centavos'}` : '';
  return r && c ? `${r} e ${c}` : r || c || 'zero real';
}

async function authCode(d: ReceiptData, total: number): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${d.number}|${d.paymentId}|${total}|${d.paidAt.toISOString()}`));
  const h = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}`;
}

export async function buildReceiptPdf(d: ReceiptData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Recibo ${d.number} - ewvon`); pdf.setAuthor('ewvon'); pdf.setCreator('ewvon');
  const W = 595.28, H = 841.89, S = W / 794;
  const page = pdf.addPage([W, H]);
  let sansR: PDFFont, sansM: PDFFont, sansS: PDFFont, sansB: PDFFont, serifR: PDFFont, serifS: PDFFont, std = false;
  try {
    const f = d.fonts; if (!f || !f.sansR || !f.sansM || !f.sansS || !f.sansB || !f.serifR || !f.serifS) throw new Error('fonts');
    sansR = await pdf.embedFont(f.sansR, { subset: true }); sansM = await pdf.embedFont(f.sansM, { subset: true }); sansS = await pdf.embedFont(f.sansS, { subset: true });
    sansB = await pdf.embedFont(f.sansB, { subset: true }); serifR = await pdf.embedFont(f.serifR, { subset: true }); serifS = await pdf.embedFont(f.serifS, { subset: true });
  } catch {
    std = true;
    sansR = await pdf.embedFont(StandardFonts.Helvetica); sansM = sansR; sansS = await pdf.embedFont(StandardFonts.HelveticaBold); sansB = sansS;
    serifR = await pdf.embedFont(StandardFonts.TimesRoman); serifS = await pdf.embedFont(StandardFonts.TimesRomanBold);
  }
  const clean = (s: string) => (std ? s.replace(/[^\u0009\u000a -~ -ÿ—–]/g, '') : s);

  // design px (top-left origin) -> pt
  const X = (x: number) => x * S, Y = (y: number) => H - y * S;
  const rect = (x: number, y: number, w: number, h: number, color: any) => page.drawRectangle({ x: X(x), y: Y(y + h), width: w * S, height: h * S, color });
  const box = (x: number, y: number, w: number, h: number, color: any, th = 1) => page.drawRectangle({ x: X(x + th / 2), y: Y(y + h - th / 2), width: (w - th) * S, height: (h - th) * S, borderColor: color, borderWidth: th * S });
  const wid = (t: string, f: PDFFont, size: number, sp = 0) => f.widthOfTextAtSize(clean(t), size * S) / S + sp * Math.max(0, t.length - 1);
  /** baseline centred in a box of height h starting at yTop */
  const T = (t: string, x: number, yTop: number, h: number, size: number, f: PDFFont, color: any, o: { align?: 'left' | 'right'; sp?: number } = {}) => {
    const s = clean(t), sp = o.sp || 0, w = wid(s, f, size, sp), x0 = o.align === 'right' ? x - w : x, by = yTop + h / 2 + size * 0.36;
    if (!sp) { page.drawText(s, { x: X(x0), y: Y(by), size: size * S, font: f, color }); return; }
    let cx = x0; for (const ch of s) { page.drawText(ch, { x: X(cx), y: Y(by), size: size * S, font: f, color }); cx += f.widthOfTextAtSize(ch, size * S) / S + sp; }
  };
  const fit = (t: string, max: number, f: PDFFont, size: number) => { let s = t; while (s.length > 1 && wid(s, f, size) > max) s = s.slice(0, -1); return s === t ? t : s.trimEnd() + '…'; };
  const upper = (t: string) => t.toLocaleUpperCase('pt-BR');

  let total = 0; for (const it of d.items) total += it.unitCents * it.qty;
  const issued = new Date();
  const clienteNome = d.customer.legalName || d.customer.name;
  const desc = d.items.map(i => i.description).join('; ');
  const code = await authCode(d, total);
  const DY = -17.8;          // header is one line shorter (no CPF/CNPJ line)
  const DY2 = DY - 24;       // and the Emitente/Pagador blocks lose their CPF/CNPJ row

  /* ---------- header ---------- */
  let hasLogo = false;
  if (d.logoPng) {
    try { const img = await pdf.embedPng(d.logoPng); const h = 28, w = h * img.width / img.height; page.drawImage(img, { x: X(56), y: Y(52 + h), width: w * S, height: h * S }); hasLogo = true; } catch { hasLogo = false; }
  }
  if (!hasLogo) T('ewvon', 56, 52, 26, 26, sansB, C.navy);
  T(d.issuer.owner, 56, 88, 17.8, 11.5, sansS, C.ink);
  T(`${d.issuer.place} · ${d.issuer.email}`, 56, 88 + 17.8, 17.8, 11.5, sansR, C.text3);
  T(upper('Recibo nº'), 738, 52, 16.8, 10.5, sansS, C.gray, { align: 'right', sp: 1.05 });
  T(d.number, 738, 70.8, 19, 15, sansS, C.navy, { align: 'right' });
  T(upper('Data de emissão'), 738, 100.8, 16.8, 10.5, sansS, C.gray, { align: 'right', sp: 1.05 });
  T(brDate(issued), 738, 118.6, 17, 13, sansS, C.navy, { align: 'right' });
  rect(56, 157.4 + DY, 682, 2, C.navy);

  /* ---------- title + amount ---------- */
  T(upper('Documento de quitação'), 56, 219.9 + DY, 11.5, 10.5, sansS, C.gray, { sp: 1.26 });
  T('Recibo de Pagamento', 56, 239.4 + DY, 33, 30, serifS, C.navy);
  box(490, 181.4 + DY, 248, 91, C.navy, 1);
  T(upper('Valor recebido'), 719, 192.4 + DY, 14, 10.5, sansS, C.gray, { align: 'right', sp: 1.05 });
  T(brl(total), 719, 208.4 + DY, 37, 28, serifS, C.navy, { align: 'right' });
  T(`(${extenso(total)})`, 719, 247.4 + DY, 14, 11, sansR, C.gray, { align: 'right' });

  /* ---------- declaration (justified, mixed weights) ---------- */
  type Tok = { t: string; b: boolean; glue?: boolean };
  const segs: Tok[] = [];
  const push = (t: string, b = false) => t.split(/(\s+)/).filter(x => x && !/^\s+$/.test(x)).forEach((w, i) => segs.push({ t: w, b, glue: i === 0 && segs.length > 0 && /^[,.;:]/.test(t) }));
  push('Declaramos, para os devidos fins, que recebemos de '); push(clienteNome, true); push(', titular da conta ewvon vinculada ao e-mail '); push(d.customer.adminEmail, true);
  push(', a importância de '); push(`${brl(total)} (${extenso(total)})`, true); push(', referente a '); push(desc, true);
  push(`, paga em ${brDate(d.paidAt)} por meio do Mercado Pago, dando-lhe plena e geral quitação do valor acima descrito.`);
  // glue punctuation-only joins: tokens already carry punctuation, a space separates every token
  const FS = 13.5, LH = 23.625, MAXW = 682, spaceW = wid(' ', serifR, FS);
  const lines: Tok[][] = []; let cur: Tok[] = [], curW = 0;
  for (const tk of segs) {
    const w = wid(tk.t, tk.b ? serifS : serifR, FS), sp = tk.glue ? 0 : spaceW;
    if (cur.length && !tk.glue && curW + sp + w > MAXW) { lines.push(cur); cur = [tk]; curW = w; } else { curW += (cur.length ? sp : 0) + w; cur.push(tk); }
  }
  if (cur.length) lines.push(cur);
  const dcTop = 294.4 + DY;
  lines.forEach((ln, li) => {
    const natural = ln.reduce((s, tk) => s + wid(tk.t, tk.b ? serifS : serifR, FS), 0);
    const gaps = ln.filter((tk, i) => i > 0 && !tk.glue).length;
    const gap = li < lines.length - 1 && gaps > 0 ? (MAXW - natural) / gaps : spaceW;
    let x = 56; ln.forEach((tk, i) => { const f = tk.b ? serifS : serifR; if (i > 0 && tk.glue) x -= 0; T(tk.t, x, dcTop + li * LH, LH, FS, f, C.ink); x += wid(tk.t, f, FS) + (i + 1 < ln.length && ln[i + 1].glue ? 0 : gap); });
  });
  const dcBottom = dcTop + lines.length * LH;
  const extra = dcBottom - (dcTop + 94.5);            // paragraph longer/shorter than the 4 lines of the sample
  const Y2 = DY2 + extra;

  /* ---------- emitente / pagador ---------- */
  const h2 = (label: string, x: number, y: number, w: number) => { T(upper(label), x, y, 21 - 7, 10.5, sansS, C.navy, { sp: 1.26 }); rect(x, y + 20, w, 1, C.navy); };
  h2('Emitente', 56, 410.9 + DY + extra, 325); h2('Pagador', 413, 410.9 + DY + extra, 325);
  const kv = (x: number, rows: [string, string][]) => rows.forEach(([k, v], i) => { const y = 439.9 + DY + extra + i * 24; T(k, x, y, 18, 12, sansR, C.gray); T(v, x + 114, y, 18, 12, sansM, C.ink); });
  kv(56, [['Nome', `${d.issuer.owner} (${d.issuer.brand})`], ['Localidade', d.issuer.place], ['Contato', d.issuer.email]]);
  kv(413, [['Cliente', clienteNome], ['Conta ewvon', d.customer.name], ['E-mail', d.customer.adminEmail]]);

  /* ---------- payment data ---------- */
  h2('Dados do pagamento', 56, 551.9 + Y2, 682);
  const pdTop = 580.9 + Y2; box(56, pdTop, 682, 51, C.line, 1);
  const cells: [string, string, boolean][] = [['Data', brDate(d.paidAt), false], ['Forma', 'Mercado Pago', false], ['ID do pagamento', d.paymentId || '-', false], ['Situação', 'Confirmado', true]];
  cells.forEach(([k, v, ok], i) => {
    const x = 57 + i * 170;
    if (i) rect(x - 1, pdTop + 1, 1, 49, C.line);
    T(upper(k), x + 12, pdTop + 10, 13, 10, sansS, C.gray, { sp: 0.8 }); T(v, x + 12, pdTop + 26, 15, 12, sansS, ok ? C.ok : C.ink);
  });

  /* ---------- itemised table ---------- */
  h2('Discriminação', 56, 653.9 + Y2, 682);
  const thTop = 682.9 + Y2;
  const th = (t: string, x: number, right = false) => T(upper(t), x, thTop, 27.5, 10, sansS, C.gray, { align: right ? 'right' : 'left', sp: 0.8 });
  th('Item', 64); th('Descrição', 108); th('Qtd.', 520, true); th('Valor unitário', 630, true); th('Valor total', 730, true);
  rect(56, thTop + 26.5, 682, 1, C.navy);
  let rowTop = thTop + 27.5;
  d.items.forEach((it, i) => {
    T(String(i + 1).padStart(2, '0'), 64, rowTop, 33.2, 12, sansR, C.ink); T(fit(it.description, 360, sansR, 12), 108, rowTop, 33.2, 12, sansR, C.ink);
    T(String(it.qty), 520, rowTop, 33.2, 12, sansR, C.ink, { align: 'right' }); T(brl(it.unitCents), 630, rowTop, 33.2, 12, sansR, C.ink, { align: 'right' }); T(brl(it.unitCents * it.qty), 730, rowTop, 33.2, 12, sansR, C.ink, { align: 'right' });
    rect(56, rowTop + 33.2, 682, 1, C.soft); rowTop += 34.2;
  });
  const totTop = rowTop + 8.3;
  T('Subtotal', 486, totTop, 25, 12, sansR, C.text3); T(brl(total), 730, totTop, 25, 12, sansR, C.text3, { align: 'right' });
  T('Descontos', 486, totTop + 25, 25, 12, sansR, C.text3); T(brl(0), 730, totTop + 25, 25, 12, sansR, C.text3, { align: 'right' });
  rect(478, totTop + 54, 260, 2, C.navy);
  T('Total pago', 486, totTop + 56, 31, 14, sansB, C.navy); T(brl(total), 730, totTop + 56, 31, 14, sansB, C.navy, { align: 'right' });

  /* ---------- date, signature, authentication ---------- */
  const sgTop = totTop + (869.9 - 752.9);
  T(`São Paulo, ${longDate(issued)}.`, 56, sgTop + 1.5, 17, 13, serifR, C.ink);
  rect(56, sgTop + 52.5, 392, 1, C.ink);
  T(d.issuer.owner, 56, sgTop + 59.5, 17.3, 11.5, sansS, C.ink);
  T(`Emitente · ${d.issuer.brand}`, 56, sgTop + 76.8, 15, 11.5, sansR, C.text3);
  box(488, sgTop, 250, 94, C.line, 1);
  T(upper('Autenticação'), 501, sgTop + 11, 15, 10, sansS, C.navy, { sp: 0.8 });
  T(code, 501, sgTop + 29, 19.5, 13, sansS, C.ink, { sp: 0.78 });
  ['Documento emitido eletronicamente, sem', 'necessidade de assinatura manuscrita.'].forEach((l, i) => T(l, 501, sgTop + 50.5 + i * 15.75, 15.75, 10.5, sansR, C.gray));

  /* ---------- notes + footer ---------- */
  const obTop = sgTop + (985.9 - 869.9);
  T('Observações.', 56, obTop, 16.8, 10.5, sansS, C.ink);
  const obx = 56 + wid('Observações. ', sansS, 10.5);
  T('Pagamento confirmado pelo Mercado Pago. Este recibo comprova o pagamento do serviço ewvon e não substitui nota fiscal.', obx, obTop, 16.8, 10.5, sansR, C.gray);
  T(`Dúvidas sobre este recibo: ${d.issuer.email}, informando o número ${d.number}.`, 56, obTop + 16.8, 16.8, 10.5, sansR, C.gray);
  rect(56, 1059, 682, 1, C.line);
  T(`Documento emitido eletronicamente em ${brDate(issued)} · ${d.issuer.brand}`, 56, 1070, 13, 10, sansR, C.foot);
  T(`Recibo ${d.number} · Página 1 de 1`, 738, 1070, 13, 10, sansR, C.foot, { align: 'right' });
  return await pdf.save();
}
