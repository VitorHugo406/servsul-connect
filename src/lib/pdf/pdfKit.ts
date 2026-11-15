// Shared drawing kit for the standard PDFs (birthdays and evaluation forms).
// Coordinates follow the original ReportLab models (origin at the bottom-left, points), so the
// layouts match the approved samples one-to-one. Fonts: Poppins, loaded once from /fonts.
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

export type RGB = [number, number, number];
export const PAGE_W = 595.28;
export const PAGE_H = 841.89;

export const hexToRgb = (hex: string | null | undefined, fallback: RGB = [20, 38, 74]): RGB => {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const luminance = (c: RGB) => {
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
export const mix = (a: RGB, b: RGB, t: number): RGB => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
export const WHITE: RGB = [255, 255, 255];
export const BLACK: RGB = [10, 10, 10];
export const GRAY: RGB = [102, 102, 102];
export const LGRAY: RGB = [204, 204, 204];

/** Colors derived from the company color: dark colors become the bar background (light text), light ones keep black bars with colored text. */
export interface Theme { accent: RGB; bar: RGB; barText: RGB; onAccent: RGB; soft: RGB; softer: RGB }
export function makeTheme(primary?: string | null): Theme {
  const accent = hexToRgb(primary);
  const dark = luminance(accent) < 0.18;
  return {
    accent,
    bar: dark ? accent : [0, 0, 0],
    barText: dark ? WHITE : accent,
    onAccent: luminance(accent) < 0.3 ? WHITE : BLACK,
    soft: mix(accent, WHITE, 0.82),
    softer: mix(accent, WHITE, 0.93),
  };
}

// ---------- fonts ----------
let fontSource: (file: string) => Promise<string> = async (file) => {
  const r = await fetch(`/fonts/${file}`);
  if (!r.ok) throw new Error('Fonte indisponível');
  const buf = new Uint8Array(await r.arrayBuffer());
  let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
};
/** Test hook (Node): read the font files from disk instead of fetching them. */
export const setFontSource = (fn: (file: string) => Promise<string>) => { fontSource = fn; };
const fontCache = new Map<string, Promise<string>>();
const font64 = (file: string) => { let p = fontCache.get(file); if (!p) { p = fontSource(file); fontCache.set(file, p); p.catch(() => fontCache.delete(file)); } return p; };

export async function newDoc(): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const files: [string, string, string][] = [['Poppins-Regular.ttf', 'Pop', 'normal'], ['Poppins-Medium.ttf', 'PopM', 'normal'], ['Poppins-Bold.ttf', 'Pop', 'bold']];
  const data = await Promise.all(files.map(([f]) => font64(f)));
  files.forEach(([f, name, style], i) => { doc.addFileToVFS(f, data[i]); doc.addFont(f, name, style); });
  return doc;
}

export type Weight = 'Regular' | 'Medium' | 'Bold';
export interface Img { data: string; w: number; h: number }
type Paint = { fill?: RGB | null; stroke?: RGB | null; lw?: number };

/** Thin ReportLab-like layer over jsPDF (y grows upward). */
export class Pdf {
  constructor(public doc: jsPDF) {}
  private y = (v: number) => PAGE_H - v;
  private style(p: Paint) {
    if (p.fill) this.doc.setFillColor(...p.fill);
    if (p.stroke) { this.doc.setDrawColor(...p.stroke); this.doc.setLineWidth(p.lw ?? 0.8); }
    return p.fill && p.stroke ? 'FD' : p.fill ? 'F' : p.stroke ? 'S' : null;
  }
  rect(x: number, y: number, w: number, h: number, p: Paint) { const s = this.style(p); if (s) this.doc.rect(x, this.y(y + h), w, h, s); }
  rr(x: number, y: number, w: number, h: number, r: number, p: Paint) { const s = this.style(p); if (s) this.doc.roundedRect(x, this.y(y + h), w, h, r, r, s); }
  circle(cx: number, cy: number, r: number, p: Paint) { const s = this.style(p); if (s) this.doc.circle(cx, this.y(cy), r, s); }
  ellipse(cx: number, cy: number, rx: number, ry: number, p: Paint) { const s = this.style(p); if (s) this.doc.ellipse(cx, this.y(cy), rx, ry, s); }
  line(x1: number, y1: number, x2: number, y2: number, color: RGB, lw = 0.6, dash?: [number, number]) {
    this.doc.setDrawColor(...color); this.doc.setLineWidth(lw);
    this.doc.setLineDashPattern(dash ? [dash[0], dash[1]] : [], 0);
    this.doc.line(x1, this.y(y1), x2, this.y(y2));
    this.doc.setLineDashPattern([], 0);
  }
  curve(x0: number, y0: number, c: [number, number, number, number, number, number], color: RGB, lw: number, dash?: [number, number]) {
    this.doc.setDrawColor(...color); this.doc.setLineWidth(lw); if (dash) this.doc.setLineDashPattern(dash, 0);
    this.doc.lines([[c[0] - x0, -(c[1] - y0), c[2] - x0, -(c[3] - y0), c[4] - x0, -(c[5] - y0)]], x0, this.y(y0), [1, 1], 'S', false);
    this.doc.setLineDashPattern([], 0);
  }
  poly(points: [number, number][], p: Paint) {
    const s = this.style(p); if (!s) return;
    const [first, ...rest] = points;
    this.doc.lines(rest.map((pt, i) => [pt[0] - (i ? rest[i - 1][0] : first[0]), -(pt[1] - (i ? rest[i - 1][1] : first[1]))]), first[0], this.y(first[1]), [1, 1], s, true);
  }
  setFont(weight: Weight, size: number) {
    if (weight === 'Bold') this.doc.setFont('Pop', 'bold'); else if (weight === 'Medium') this.doc.setFont('PopM', 'normal'); else this.doc.setFont('Pop', 'normal');
    this.doc.setFontSize(size);
  }
  width(s: string, weight: Weight, size: number) { this.setFont(weight, size); return this.doc.getTextWidth(s); }
  text(x: number, y: number, s: string, o: { w?: Weight; size?: number; color?: RGB; align?: 'l' | 'c' | 'r'; charSpace?: number } = {}) {
    this.setFont(o.w ?? 'Regular', o.size ?? 9);
    this.doc.setTextColor(...(o.color ?? BLACK));
    this.doc.text(s, x, this.y(y), { align: o.align === 'c' ? 'center' : o.align === 'r' ? 'right' : 'left', ...(o.charSpace ? { charSpace: o.charSpace } : {}) });
  }
  split(s: string, weight: Weight, size: number, width: number): string[] { this.setFont(weight, size); return this.doc.splitTextToSize(s, width) as string[]; }
  ellipsize(s: string, weight: Weight, size: number, width: number) {
    if (this.width(s, weight, size) <= width) return s;
    let t = s; while (t && this.width(t + '…', weight, size) > width) t = t.slice(0, -1);
    return t.trimEnd() + '…';
  }
  image(img: string, x: number, y: number, w: number, h: number) { try { this.doc.addImage(img, undefined as never, x, this.y(y + h), w, h, undefined, 'FAST'); } catch { /* image skipped */ } }
  /** Draws inside a rounded rectangle (clip). */
  clipRR(x: number, y: number, w: number, h: number, r: number, draw: () => void) {
    this.doc.saveGraphicsState();
    this.doc.roundedRect(x, this.y(y + h), w, h, r, r, null as never);
    (this.doc as unknown as { clip: () => void; discardPath: () => void }).clip();
    (this.doc as unknown as { discardPath: () => void }).discardPath();
    draw();
    this.doc.restoreGraphicsState();
  }
  opacity(o: number, draw: () => void) {
    this.doc.saveGraphicsState();
    this.doc.setGState(new (this.doc as unknown as { GState: new (a: { opacity: number; 'stroke-opacity': number }) => object }).GState({ opacity: o, 'stroke-opacity': o }));
    draw();
    this.doc.restoreGraphicsState();
  }
  /** Image fitted (contain) in a box, centered. */
  fit(img: Img, x: number, y: number, w: number, h: number) {
    const s = Math.min(w / img.w, h / img.h), dw = img.w * s, dh = img.h * s;
    this.image(img.data, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
}

/** Plain QR code (no logo, margin 0) as a PNG data URL. */
export const qrData = (text: string) => QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 0, width: 360 });
