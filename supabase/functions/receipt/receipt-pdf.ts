// Payment receipt (A4 PDF) with the ewvon logo. Pure drawing code: data in, bytes out.
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

const LOGO_PATHS = ['M262 85 L253 76 L253 75 L251 74 L143 74 L142 75 L138 75 L137 76 L132 77 L119 84 L70 132 L69 132 L45 156 L44 156 L41 159 L41 161 L69 192 L80 198 L82 198 L86 200 L91 200 L92 201 L167 201 L168 200 L173 200 L174 199 L180 198 L190 193 L198 186 L199 186 L240 145 L230 150 L228 150 L221 153 L218 153 L217 154 L212 154 L211 155 L109 155 L108 153 L135 127 L142 123 L144 123 L148 121 L154 121 L155 120 L218 120 L219 119 L225 118 L234 113 L242 105 L243 105 L262 86Z', 'M235 57 L206 26 L206 25 L190 9 L187 8 L185 6 L183 6 L178 3 L176 3 L172 1 L168 1 L167 0 L121 0 L120 1 L116 1 L115 2 L109 3 L97 9 L93 12 L70 35 L69 35 L28 75 L27 75 L9 93 L8 93 L3 98 L1 102 L1 104 L0 105 L0 115 L3 122 L22 141 L23 141 L102 64 L103 64 L110 57 L116 53 L126 49 L130 49 L131 48 L208 48 L209 49 L214 49 L215 50 L223 51Z'];

export interface ReceiptData {
  number: string;
  paidAt: Date;
  paymentId: string;
  items: { description: string; qty: number; unitCents: number }[];
  customer: { name: string; legalName: string; cnpj: string; lines: string[]; adminEmail: string };
  issuer: { brand: string; owner: string; place: string; email: string };
  logoPng?: Uint8Array | null;
}

const NAVY = rgb(0.059, 0.09, 0.165);
const GREEN = rgb(0x14 / 255, 0x26 / 255, 0x4a / 255); // ewvon blue (same as the chat side bar)
const GRAY = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.82, 0.85, 0.88);
// Standard PDF fonts only cover Latin-1: keep accents, drop anything else.
const san = (s: unknown) => String(s ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/•/g, '-').replace(/[^\u0009\u000a -~ -ÿ]/g, '').replace(/\s+/g, ' ').trim();
export const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ');
const brDate = (d: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);

export async function buildReceiptPdf(d: ReceiptData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Recibo ${d.number} - ewvon`); pdf.setAuthor('ewvon'); pdf.setCreator('ewvon');
  const page = pdf.addPage([595.28, 841.89]);
  const W = 595.28, H = 841.89, M = 48;
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ital = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const text = (t: string, x: number, y: number, size = 9.5, font = reg, color = NAVY) => page.drawText(san(t), { x, y, size, font, color });
  const right = (t: string, xr: number, y: number, size = 9.5, font = reg, color = NAVY) => { const s = san(t); page.drawText(s, { x: xr - font.widthOfTextAtSize(s, size), y, size, font, color }); };
  const wrap = (t: string, max: number, size: number, font = reg) => {
    const words = san(t).split(' '); const out: string[] = []; let cur = '';
    for (const w of words) { const n = cur ? cur + ' ' + w : w; if (font.widthOfTextAtSize(n, size) > max && cur) { out.push(cur); cur = w; } else cur = n; }
    if (cur) out.push(cur); return out;
  };

  // Watermark: the ewvon mark, very light, behind the lower half (replaces the flag of the sample receipt).
  const scale = 1.2;
  for (const p of LOGO_PATHS) page.drawSvgPath(p, { x: (W - 275 * scale) / 2, y: 560, scale, color: NAVY, opacity: 0.06, borderWidth: 0 });

  // Header: title + logo.
  text('RECIBO', M, H - M - 36, 46, bold, NAVY);
  let logoW = 0;
  if (d.logoPng) {
    try { const img = await pdf.embedPng(d.logoPng); logoW = 150; const h = (img.height / img.width) * logoW; page.drawImage(img, { x: W - M - logoW, y: H - M - 30, width: logoW, height: h }); } catch { logoW = 0; }
  }
  if (!logoW) right('ewvon', W - M, H - M - 28, 26, bold, NAVY);

  // Issuer.
  let y = H - M - 64;
  text(d.issuer.brand, M, y, 10, bold); y -= 13;
  text(d.issuer.owner, M, y, 9.5); y -= 12;
  text(d.issuer.place, M, y, 9.5); y -= 12;
  text(d.issuer.email, M, y, 9.5);

  // Three columns: customer / company in ewvon / receipt data.
  y -= 40;
  const colA = M, colB = M + 190, colC = M + 365;
  text('CLIENTE', colA, y, 11, bold, GREEN); text('CONTA NO EWVON', colB, y, 11, bold, GREEN); text('RECIBO', colC, y, 11, bold, GREEN);
  let ya = y - 16;
  for (const l of [d.customer.legalName, d.customer.cnpj ? 'CNPJ ' + d.customer.cnpj : '', ...d.customer.lines].filter(Boolean)) for (const w of wrap(l, 165, 9.5)) { text(w, colA, ya, 9.5); ya -= 12; }
  let yb = y - 16;
  for (const l of [d.customer.name, d.customer.adminEmail]) for (const w of wrap(l, 160, 9.5)) { text(w, colB, yb, 9.5); yb -= 12; }
  const meta: [string, string][] = [['Recibo n.', d.number], ['Data do pagamento', brDate(d.paidAt)], ['Pagamento (ID)', d.paymentId || '-'], ['Forma', 'Mercado Pago']];
  let yc = y - 16;
  for (const [k, v] of meta) { text(k, colC, yc, 8.5, reg, GRAY); right(v, W - M, yc, 9.5, bold); yc -= 16; }
  y = Math.min(ya, yb, yc) - 22;

  // Items table.
  page.drawLine({ start: { x: M, y: y + 18 }, end: { x: W - M, y: y + 18 }, thickness: 1.2, color: GREEN });
  text('QTD', M + 6, y, 10, bold); text('DESCRIÇÃO', M + 70, y, 10, bold); right('PREÇO UNIT.', W - M - 90, y, 10, bold); right('VALOR', W - M - 6, y, 10, bold);
  page.drawLine({ start: { x: M, y: y - 8 }, end: { x: W - M, y: y - 8 }, thickness: 0.6, color: LINE });
  y -= 26; let total = 0;
  for (const it of d.items) {
    const lines = wrap(it.description, 270, 9.5);
    text(String(it.qty), M + 10, y, 9.5);
    lines.forEach((l, i) => text(l, M + 70, y - i * 12, 9.5));
    right(brl(it.unitCents), W - M - 90, y, 9.5); right(brl(it.unitCents * it.qty), W - M - 6, y, 9.5);
    total += it.unitCents * it.qty; y -= 12 * lines.length + 10;
  }
  y -= 6;
  page.drawLine({ start: { x: W - M - 230, y: y + 14 }, end: { x: W - M, y: y + 14 }, thickness: 0.6, color: LINE });
  right('TOTAL PAGO', W - M - 100, y - 6, 13, bold); right(brl(total), W - M - 6, y - 6, 15, bold, GREEN);

  // Terms + thanks.
  const ty = 250;
  page.drawLine({ start: { x: W - M - 235, y: ty + 70 }, end: { x: W - M - 235, y: 70 }, thickness: 0.8, color: NAVY });
  text('TERMOS E CONDIÇÕES', W - M - 220, ty + 50, 11, bold, GREEN);
  let yt = ty + 32;
  for (const l of wrap('Pagamento confirmado pelo Mercado Pago. Este recibo comprova o pagamento do serviço ewvon e não substitui nota fiscal.', 215, 9)) { text(l, W - M - 220, yt, 9); yt -= 12; }
  yt -= 6;
  for (const l of wrap('Dúvidas sobre este recibo? Escreva para ' + d.issuer.email + ' informando o número ' + d.number + '.', 215, 9, reg)) { text(l, W - M - 220, yt, 9, reg, GRAY); yt -= 12; }
  text('Obrigado!', M, 110, 40, ital, NAVY);
  text('Documento emitido eletronicamente em ' + brDate(new Date()) + '.', M, 60, 8, reg, GRAY);
  return await pdf.save();
}
