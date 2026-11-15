// Standard birthday mural (A4). One model for every company: company logo + ewvon in the header capsule,
// company color as the accent, up to 10 people per page (extra pages are created), small QR code, numbered pages.
import type { jsPDF } from 'jspdf';
import { BLACK, GRAY, Img, PAGE_H as H, PAGE_W as W, Pdf, RGB, WHITE, Theme, makeTheme, mix, newDoc, qrData } from './pdfKit';

export interface BirthdayPdfPerson { name: string; sector: string; day: number; avatar?: Img | null }
export interface BirthdayPdfOptions {
  companyName: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  logo?: Img | null;        // company logo
  ewvonLogo?: Img | null;   // white ewvon logo (shown on the dark capsule)
  month: number;            // 1-12
  year: number;
  people: BirthdayPdfPerson[];
  url: string;              // QR code target (keep it short)
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MARGIN = 34;
const PER_PAGE = 10;

function rng(seed: number) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

function background(p: Pdf, t: Theme, secondary: RGB, logo?: Img | null) {
  const cream = mix(t.accent, WHITE, 0.92);
  p.rect(0, 0, W, H, { fill: cream });
  // company logo as a soft watermark behind the cards
  if (logo) p.opacity(0.09, () => p.fit(logo, (W - 400) / 2, H / 2 - 200 - 20, 400, 400));
  // confetti
  const r = rng(7);
  const cols: RGB[] = [t.accent, BLACK, secondary, WHITE];
  for (let i = 0; i < 150; i++) {
    const x = r() * W, y = r() * H, col = cols[Math.floor(r() * cols.length)], round = r() < 0.5, size = 1.6 + r() * 1.6, len = 5 + r() * 4;
    p.opacity(col === BLACK ? 0.3 : 0.75, () => { if (round) p.circle(x, y, size, { fill: col }); else p.rr(x - len / 2, y - 1.5, len, 3, 1.5, { fill: col }); });
  }
  p.curve(34, H - 200, [100, H - 150, 170, H - 215, 215, H - 185], BLACK, 1.1, [3, 4]);
  plane(p, 226, H - 183, 0.7);
}

function plane(p: Pdf, x: number, y: number, s: number) {
  const pts: [number, number][] = [[14, 0], [-2, 3], [-6, 12], [-9, 12], [-6, 2], [-12, 1.5], [-14, 5], [-16, 5], [-14, 0], [-16, -5], [-14, -5], [-12, -1.5], [-6, -2], [-9, -12], [-6, -12], [-2, -3]];
  // rotate -30deg (nose pointing up-right) then scale and move
  const a = (-30 * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
  p.poly(pts.map(([px, py]) => [x + s * (px * c - py * sn), y + s * (px * sn + py * c)] as [number, number]), { fill: BLACK });
}

function balloon(p: Pdf, x: number, y: number, r: number, color: RGB, tilt: number) {
  p.doc.setLineDashPattern([], 0);
  p.curve(x, y - r * 1.25, [x - 6, y - r * 2.1, x + 6, y - r * 2.8, x + tilt, y - r * 3.8], [140, 140, 140], 0.8);
  p.ellipse(x, y, r, r * 1.25, { fill: color, stroke: BLACK, lw: 1.3 });
  p.poly([[x, y - r * 1.25], [x - 3, y - r * 1.25 - 4.5], [x + 3, y - r * 1.25 - 4.5]], { fill: BLACK });
  p.opacity(0.55, () => p.ellipse(x - r * 0.38, y + r * 0.52, r * 0.18, r * 0.33, { fill: WHITE }));
}

function header(p: Pdf, o: BirthdayPdfOptions, t: Theme) {
  const ewH = 20, ewW = o.ewvonLogo ? (ewH * o.ewvonLogo.w) / o.ewvonLogo.h : 58;
  const fm = 32, gap = 22, pad = 26;
  const capW = pad * 2 + ewW + gap * 2 + 1 + (o.logo ? fm : 0) + (o.logo ? 0 : 0), capH = 50;
  const cx = W / 2, cy = H - 28 - capH / 2;
  p.rr(cx - capW / 2, cy - capH / 2, capW, capH, capH / 2, { fill: [0, 0, 0] });
  const x = cx - capW / 2 + pad;
  if (o.ewvonLogo) p.image(o.ewvonLogo.data, x, cy - ewH / 2, ewW, ewH); else p.text(x, cy - 5, 'ewvon', { w: 'Bold', size: 16, color: WHITE });
  if (o.logo) {
    const sx = x + ewW + gap;
    p.line(sx, cy - 13, sx, cy + 13, [128, 128, 128], 0.7);
    const fx = sx + 1 + gap;
    p.clipRR(fx, cy - fm / 2, fm, fm, 9, () => { p.rect(fx, cy - fm / 2, fm, fm, { fill: WHITE }); p.fit(o.logo!, fx, cy - fm / 2, fm, fm); });
  }
  const ty = H - 28 - capH - 46;
  p.text(W / 2, ty, 'ANIVERSARIANTES', { w: 'Bold', size: 30, align: 'c' });
  const label = `${MESES[o.month - 1].toUpperCase()} ${o.year}`;
  const lw = p.width(label, 'Bold', 11.5) + 30;
  p.rr((W - lw) / 2, ty - 33, lw, 22, 11, { fill: [0, 0, 0] });
  p.text(W / 2, ty - 26, label, { w: 'Bold', size: 11.5, color: t.barText, align: 'c' });
  balloon(p, W - 70, ty + 4, 15, t.accent, 5); balloon(p, W - 96, ty - 10, 10, BLACK, -5);
  balloon(p, 70, ty + 4, 15, t.accent, -5); balloon(p, 96, ty - 10, 10, BLACK, 5);
}

async function footer(p: Pdf, o: BirthdayPdfOptions, page: number, total: number, qr: string) {
  const q = 66, pad = 9, box = q + pad * 2, bx = W - MARGIN - box, by = 20;
  p.opacity(0.1, () => p.rr(bx + 2, by - 2.5, box, box, 18, { fill: [0, 0, 0] }));
  p.rr(bx, by, box, box, 18, { fill: WHITE, stroke: BLACK, lw: 1.5 });
  p.image(qr, bx + pad, by + pad, q, q);
  p.text(MARGIN, by + box - 22, p.ellipsize(o.companyName, 'Bold', 11, 300), { w: 'Bold', size: 11 });
  p.text(MARGIN, by + box - 37, 'Aponte a câmera para o QR Code', { size: 9, color: GRAY });
  p.text(MARGIN, by + box - 49, 'e deixe seu recado aos aniversariantes!', { size: 9, color: GRAY });
  p.text(MARGIN, by + 4, `Página ${page} de ${total}`, { w: 'Medium', size: 8, color: GRAY });
}

function card(p: Pdf, x: number, y: number, w: number, h: number, person: BirthdayPdfPerson, month: number, t: Theme) {
  const r = 24;
  p.opacity(0.09, () => p.rr(x + 2, y - 3, w, h, r, { fill: [0, 0, 0] }));
  p.rr(x, y, w, h, r, { fill: WHITE, stroke: BLACK, lw: 1.5 });
  const d = 58, px = x + 17, py = y + (h - d) / 2;
  p.circle(px + d / 2, py + d / 2, d / 2 + 4, { fill: t.accent, stroke: BLACK, lw: 1.4 });
  if (person.avatar) p.image(person.avatar.data, px, py, d, d);
  else {
    p.circle(px + d / 2, py + d / 2, d / 2, { fill: BLACK });
    const ini = person.name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
    p.text(px + d / 2, py + d / 2 - 7, ini, { w: 'Bold', size: 20, color: t.barText, align: 'c' });
  }
  const tx = px + d + 20, tw = x + w - 16 - tx;
  // Big name; long names shrink a little so they always fit in two lines.
  let NAME = 14.5;
  let lines = p.split(person.name, 'Bold', NAME, tw);
  while (lines.length > 2 && NAME > 11) { NAME -= 0.5; lines = p.split(person.name, 'Bold', NAME, tw); }
  lines = lines.slice(0, 2);
  const LINE = NAME + 2.5;
  let ty = y + h - 24;
  for (const ln of lines) { p.text(tx, ty, ln, { w: 'Bold', size: NAME }); ty -= LINE; }
  p.text(tx, ty - 0.5, p.ellipsize(person.sector || 'Sem departamento', 'Regular', 8.3, tw), { size: 8.3, color: GRAY });
  const txt = `${String(person.day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
  const pw = p.width(txt, 'Bold', 8.8) + 18;
  p.rr(tx, y + 13, pw, 17, 8.5, { fill: [0, 0, 0] });
  p.text(tx + 9, y + 18.2, txt, { w: 'Bold', size: 8.8, color: t.barText });
  p.text(tx + pw + 7, y + 18.2, 'Feliz aniversário!', { w: 'Medium', size: 8 });
}

export async function buildBirthdayPdf(o: BirthdayPdfOptions): Promise<jsPDF> {
  const doc = await newDoc();
  const p = new Pdf(doc);
  const t = makeTheme(o.primaryColor);
  const secondary: RGB = o.secondaryColor ? (makeTheme(o.secondaryColor).accent) : [255, 159, 26];
  const qr = await qrData(o.url);
  const people = [...o.people].sort((a, b) => a.day - b.day || a.name.localeCompare(b.name));
  const pages: BirthdayPdfPerson[][] = [];
  for (let i = 0; i < people.length; i += PER_PAGE) pages.push(people.slice(i, i + PER_PAGE));
  if (!pages.length) pages.push([]);
  const cols = 2, gx = 20, gy = 18;
  const cw = (W - 2 * MARGIN - (cols - 1) * gx) / cols, ch = 93, topY = H - 196;
  pages.forEach((group, n) => {
    if (n) doc.addPage();
    background(p, t, secondary, o.logo);
    header(p, o, t);
    if (!group.length) p.text(W / 2, H / 2, 'Nenhum aniversariante neste mês', { w: 'Bold', size: 14, color: GRAY, align: 'c' });
    group.forEach((person, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      card(p, MARGIN + c * (cw + gx), topY - ch - r * (ch + gy), cw, ch, person, o.month, t);
    });
    void footer(p, o, n + 1, pages.length, qr);
  });
  doc.setProperties({ title: `Aniversariantes de ${MESES[o.month - 1]} - ${o.companyName}`, author: o.companyName });
  return doc;
}
