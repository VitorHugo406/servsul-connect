// Image signatures: about 30 designed styles in six categories (see SIG_STYLES) are drawn on a canvas at 2x and used
// in the e-mail as ONE PNG (the only way shapes, arcs and a watermark look the same in Gmail and Outlook), followed by
// a small text line with clickable contacts. Logical width 600; height per style in `bannerHeight`.
// Nothing is ever cut: text that does not fit shrinks (and, as a last resort, is condensed), a contact too long for
// its column takes the whole row, and rows get closer together when they would pass the bottom.
// Images come from public buckets (CORS ok).
import { digits, fullConfig, hasCta, hostOf, mapsUrl, safeUrl, socialHref, toHex, type SigConfig, type SigPerson, type SigShape, type SigStyle } from '@/lib/emailSignature';

type Node = [string, Record<string, string>];
const ICONS: Record<string, Node[]> = {"phone":[["path",{"d":"M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"}]],"mail":[["rect",{"width":"20","height":"16","x":"2","y":"4","rx":"2"}],["path",{"d":"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"}]],"globe":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"}],["path",{"d":"M2 12h20"}]],"map-pin":[["path",{"d":"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"}],["circle",{"cx":"12","cy":"10","r":"3"}]],"smartphone":[["rect",{"width":"14","height":"20","x":"5","y":"2","rx":"2","ry":"2"}],["path",{"d":"M12 18h.01"}]],"linkedin":[["path",{"d":"M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"}],["rect",{"width":"4","height":"12","x":"2","y":"9"}],["circle",{"cx":"4","cy":"4","r":"2"}]],"instagram":[["rect",{"width":"20","height":"20","x":"2","y":"2","rx":"5","ry":"5"}],["path",{"d":"M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"}],["line",{"x1":"17.5","x2":"17.51","y1":"6.5","y2":"6.5"}]],"facebook":[["path",{"d":"M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"}]],"youtube":[["path",{"d":"M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"}],["path",{"d":"m10 15 5-3-5-3z"}]],"message-circle":[["path",{"d":"M7.9 20A9 9 0 1 0 4 16.1L2 22Z"}]]};
const F = "SigPoppins, 'Poppins', Arial, sans-serif";
export const BANNER_W = 600;
export const isBannerStyle = (s: SigStyle) => s !== 'classic';
const HEIGHTS: Partial<Record<SigStyle, number>> = { cta: 230, 'promo-ribbon': 230, 'minimal-line': 150, 'minimal-center': 190, underline: 160, mono: 160, card: 180 };
export const bannerHeight = (s: SigStyle) => HEIGHTS[s] ?? (s.startsWith('corp') ? 170 : 200);

let fontsP: Promise<void> | null = null;
export function ensureSigFonts(): Promise<void> {
  if (!fontsP) {
    fontsP = Promise.all([['400', 'Regular'], ['500', 'Medium'], ['700', 'Bold']].map(([w, n]) =>
      new FontFace('SigPoppins', `url(/fonts/Poppins-${n}.ttf)`, { weight: w }).load().then((f) => { document.fonts.add(f); }).catch(() => undefined))).then(() => undefined);
  }
  return fontsP;
}
const imgCache = new Map<string, Promise<HTMLImageElement | null>>();
export function loadImg(url?: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  let p = imgCache.get(url);
  if (!p) {
    p = new Promise((res) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
    imgCache.set(url, p);
  }
  return p;
}

export type BannerAssets = { photo: HTMLImageElement | null; logo: HTMLImageElement | null; wm: HTMLImageElement | null };
export async function bannerAssets(c: SigConfig, p: SigPerson): Promise<BannerAssets> {
  await ensureSigFonts();
  const wmSrc = c.watermark.kind === 'logo' ? c.logoUrl : c.watermark.kind === 'image' ? c.watermark.src : '';
  const [photo, logo, wm] = await Promise.all([loadImg(p.photo), loadImg(c.logoUrl), loadImg(wmSrc)]);
  return { photo, logo, wm };
}

/** Clickable areas recorded while drawing (logical px). The e-mail HTML slices the image so each one gets its own link. */
export type BannerLink = { x: number; y: number; w: number; h: number; href: string };
let LINKS: BannerLink[] | null = null;
const hot = (X: number, Y: number, w: number, h: number, href?: string | null) => { if (LINKS && href && w > 0 && h > 0) LINKS.push({ x: X, y: Y, w, h, href }); };
const siteOf = (d: { c: SigConfig }) => (d.c.show.website ? safeUrl(d.c.website) : '') || safeUrl(d.c.website);
const ctaUrl = (d: { c: SigConfig }) => safeUrl(d.c.cta.url) || safeUrl(d.c.website);

type Ctx = CanvasRenderingContext2D;
type D = { c: SigConfig; p: SigPerson; a: BannerAssets; company: string; W: number; H: number; P: string; S: string; T: string; M: string; BG: string; gray?: boolean };

// ── primitives
const poly = (x: Ctx, pts: number[][], fill: string | CanvasGradient) => { x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.fillStyle = fill; x.fill(); };
const rr = (x: Ctx, X: number, Y: number, w: number, h: number, r: number) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
const ngon = (x: Ctx, cx: number, cy: number, r: number, n: number, rot: number) => { x.beginPath(); for (let i = 0; i < n; i++) { const a = rot + (i * 2 * Math.PI) / n; const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a); if (i) x.lineTo(px, py); else x.moveTo(px, py); } x.closePath(); };
const hexPath = (x: Ctx, cx: number, cy: number, r: number) => ngon(x, cx, cy, r, 6, Math.PI / 6);
/** path of a photo/logo shape centred on (cx, cy) inside a 2r box */
function shapePath(x: Ctx, sh: SigShape, cx: number, cy: number, r: number) {
  if (sh === 'hexagon') return hexPath(x, cx, cy, r);
  if (sh === 'octagon') return ngon(x, cx, cy, r, 8, Math.PI / 8);
  if (sh === 'diamond') return ngon(x, cx, cy, r * 1.08, 4, -Math.PI / 2);
  if (sh === 'rounded') return rr(x, cx - r, cy - r, r * 2, r * 2, r * 0.3);
  if (sh === 'square') { x.beginPath(); x.rect(cx - r, cy - r, r * 2, r * 2); return; }
  if (sh === 'leaf') { const a = r * 0.95, b = r * 0.12, X = cx - r, Y = cy - r, w = r * 2; x.beginPath(); x.moveTo(X + a, Y); x.arcTo(X + w, Y, X + w, Y + w, b); x.arcTo(X + w, Y + w, X, Y + w, a); x.arcTo(X, Y + w, X, Y, b); x.arcTo(X, Y, X + w, Y, a); x.closePath(); return; }
  x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2);
}
const alpha = (hex: string, a: number) => { const h = toHex(hex).slice(1); return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`; };
const shade = (hex: string, k: number) => { const h = toHex(hex).slice(1); const f = (i: number) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0'); return `#${f(0)}${f(2)}${f(4)}`; };
const mix = (hex: string, to: string, k: number) => { const a = toHex(hex).slice(1), b = toHex(to).slice(1); const f = (i: number) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - k) + parseInt(b.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0'); return `#${f(0)}${f(2)}${f(4)}`; };
const lum = (hex: string) => { const h = toHex(hex).slice(1); return (0.299 * parseInt(h.slice(0, 2), 16) + 0.587 * parseInt(h.slice(2, 4), 16) + 0.114 * parseInt(h.slice(4, 6), 16)) / 255; };
const onColor = (hex: string) => (lum(hex) > 0.62 ? '#1f2326' : '#ffffff');
/** readable version of a colour on a dark background */
const bright = (hex: string) => (lum(hex) < 0.45 ? mix(hex, '#ffffff', 0.45) : hex);
type TxtO = { size?: number; weight?: number; color?: string; align?: CanvasTextAlign; maxW?: number; ls?: number; upper?: boolean };
/** Draws text; with maxW it NEVER cuts: the font shrinks to fit (down to 6.5px) and, only past that, the text is condensed. */
function txt(x: Ctx, s: string, X: number, Y: number, o: TxtO = {}) {
  if (!s) return 0;
  const str = o.upper ? s.toUpperCase() : s;
  let size = o.size || 12;
  const anyX = x as Ctx & { letterSpacing?: string };
  const setF = () => { x.font = `${o.weight || 400} ${size}px ${F}`; };
  setF(); x.fillStyle = o.color || '#222'; x.textAlign = o.align || 'left'; x.textBaseline = 'alphabetic';
  if (o.ls) anyX.letterSpacing = `${o.ls}px`;
  let w = x.measureText(str).width, sx = 1;
  if (o.maxW && w > o.maxW) {
    size = Math.max(Math.min(size, 6.5), (size * o.maxW) / w * 0.99); setF(); w = x.measureText(str).width;
    if (w > o.maxW) sx = o.maxW / w;
  }
  if (sx < 1) { x.save(); x.translate(X, Y); x.scale(sx, 1); x.fillText(str, 0, 0); x.restore(); w *= sx; } else x.fillText(str, X, Y);
  if (o.ls) anyX.letterSpacing = '0px';
  return w;
}
/** first name + rest in two weights, scaled together so the full name always fits */
function nameSplit(x: Ctx, d: D, X: number, Y: number, maxW: number, size: number, color: string, w1 = 700, w2 = 400, upper = true) {
  const n = nameOf(d).split(' '); const a = upper ? (n[0] || '').toUpperCase() : n[0] || '', b = upper ? n.slice(1).join(' ').toUpperCase() : n.slice(1).join(' ');
  const m = (s: string, w: number, z: number) => { x.font = `${w} ${z}px ${F}`; return x.measureText(s).width; };
  const gap = size * 0.3; const tot = m(a, w1, size) + (b ? gap + m(b, w2, size) : 0);
  const z = tot > maxW ? Math.max(7, (size * maxW) / tot * 0.99) : size;
  const wa = txt(x, a, X, Y, { size: z, weight: w1, color, maxW });
  if (b) txt(x, b, X + wa + z * 0.3, Y, { size: z, weight: w2, color, maxW: Math.max(10, maxW - wa - z * 0.3) });
}
function icon(x: Ctx, name: string, X: number, Y: number, size: number, color: string, lw = 2) {
  const nodes = ICONS[name]; if (!nodes) return;
  x.save(); x.translate(X, Y); x.scale(size / 24, size / 24); x.strokeStyle = color; x.lineWidth = lw; x.lineCap = 'round'; x.lineJoin = 'round';
  for (const [t, a] of nodes) {
    if (t === 'path') { x.stroke(new Path2D(a.d)); continue; }
    x.beginPath();
    if (t === 'circle') x.arc(+a.cx, +a.cy, +a.r, 0, Math.PI * 2);
    else if (t === 'rect') { const r = +(a.rx || 0); if (r) rr(x, +a.x, +a.y, +a.width, +a.height, r); else x.rect(+a.x, +a.y, +a.width, +a.height); }
    else if (t === 'line') { x.moveTo(+a.x1, +a.y1); x.lineTo(+a.x2, +a.y2); }
    x.stroke();
  }
  x.restore();
}
type BadgeShape = 'circle' | 'hex' | 'square' | 'outline';
/** icon inside a filled badge (circle / hexagon / rounded square / outline) or bare */
function badge(x: Ctx, name: string, cx: number, cy: number, r: number, bg: string | null, fg: string, shape: BadgeShape = 'circle') {
  if (bg) {
    if (shape === 'hex') hexPath(x, cx, cy, r + 1); else if (shape === 'square') rr(x, cx - r, cy - r, r * 2, r * 2, 3); else { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); }
    if (shape === 'outline') { x.strokeStyle = bg; x.lineWidth = 1.2; x.stroke(); } else { x.fillStyle = bg; x.fill(); }
  }
  const s = r * 1.15; icon(x, name, cx - s / 2, cy - s / 2, s, fg, 2.2);
}
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
const withGray = (x: Ctx, d: D, f: () => void) => { if (!d.gray) return f(); const fx = x as Ctx & { filter?: string }; const old = fx.filter; fx.filter = 'grayscale(1)'; f(); fx.filter = old || 'none'; };
function photo(x: Ctx, d: D, cx: number, cy: number, r: number, ring?: { color: string; width: number }, force?: SigShape) {
  const sh = force || d.c.photoShape;
  if (ring) { x.save(); shapePath(x, sh, cx, cy, r); x.lineWidth = ring.width * 2; x.strokeStyle = ring.color; x.lineJoin = 'round'; x.stroke(); x.restore(); }
  x.save(); shapePath(x, sh, cx, cy, r); x.clip();
  const img = d.c.photo ? d.a.photo : null;
  if (img) { const k = Math.max((2 * r) / img.width, (2 * r) / img.height); const w = img.width * k, h = img.height * k; withGray(x, d, () => x.drawImage(img, cx - w / 2, cy - h / 2, w, h)); }
  else if (d.c.photo) { x.fillStyle = shade(d.P, 0.85); x.fillRect(cx - r, cy - r, 2 * r, 2 * r); txt(x, initials(d.p.name), cx, cy + r * 0.22, { size: r * 0.62, weight: 700, color: '#fff', align: 'center' }); }
  else if (d.a.logo) { x.fillStyle = '#fff'; x.fillRect(cx - r, cy - r, 2 * r, 2 * r); const img2 = d.a.logo; const k = Math.min((r * 1.44) / img2.width, r / img2.height); withGray(x, d, () => x.drawImage(img2, cx - (img2.width * k) / 2, cy - (img2.height * k) / 2, img2.width * k, img2.height * k)); }
  else { x.fillStyle = d.P; x.fillRect(cx - r, cy - r, 2 * r, 2 * r); txt(x, initials(d.company), cx, cy + r * 0.22, { size: r * 0.6, weight: 700, color: '#fff', align: 'center' }); }
  x.restore();
}
/** The logo inside the box (X, Y, w, h). "Original" keeps its proportions; any other shape draws it in that shape:
 *  a near-square logo fills the shape, a wide one sits on a white tile of that shape. */
function logo(x: Ctx, d: D, X: number, Y: number, w: number, h: number, textColor: string) {
  const img = d.a.logo, sh = d.c.logoShape;
  hot(X, Y, w, h, siteOf(d));
  if (sh && sh !== 'original') {
    const s = Math.min(w, h * 1.15), r = s / 2, cx = X + w / 2, cy = Y + h / 2;
    x.save(); shapePath(x, sh, cx, cy, r);
    if (!img) { x.fillStyle = d.P; x.fill(); x.clip(); txt(x, initials(d.company), cx, cy + r * 0.24, { size: r * 0.7, weight: 700, color: onColor(d.P), align: 'center', maxW: r * 1.6 }); x.restore(); return; }
    x.fillStyle = '#ffffff'; x.fill(); x.strokeStyle = 'rgba(0,0,0,0.10)'; x.lineWidth = 1; x.stroke(); x.clip();
    const ar = img.width / img.height;
    if (ar > 0.72 && ar < 1.4) { const k = Math.max(s / img.width, s / img.height); withGray(x, d, () => x.drawImage(img, cx - (img.width * k) / 2, cy - (img.height * k) / 2, img.width * k, img.height * k)); }
    else { const inner = s * 0.8; const k = Math.min(inner / img.width, inner / img.height); withGray(x, d, () => x.drawImage(img, cx - (img.width * k) / 2, cy - (img.height * k) / 2, img.width * k, img.height * k)); }
    x.restore(); return;
  }
  if (img) { const k = Math.min(w / img.width, h / img.height); const iw = img.width * k, ih = img.height * k; withGray(x, d, () => x.drawImage(img, X + (w - iw) / 2, Y + (h - ih) / 2, iw, ih)); return; }
  txt(x, d.company, X + w / 2, Y + h / 2 + 6, { size: 16, weight: 700, color: textColor, align: 'center', maxW: w });
}
/** logo on a white tile (for dark/coloured areas); a shaped logo already brings its own tile */
function logoTile(x: Ctx, d: D, X: number, Y: number, w: number, h: number) {
  if (d.c.logoShape === 'original') { rr(x, X, Y, w, h, 10); x.fillStyle = '#ffffff'; x.fill(); }
  logo(x, d, X + 6, Y + 4, w - 12, h - 8, '#1f2326');
}
function contacts(d: D) {
  const c = d.c, p = d.p, out: [string, string, string, string][] = [];
  if (c.show.phone && p.phone) out.push(['phone', p.phone, 'Telefone', `tel:${digits(p.phone)}`]);
  if (c.show.mobile && p.mobile) out.push(['smartphone', p.mobile, 'Celular', `tel:${digits(p.mobile)}`]);
  if (c.show.email && p.email) out.push(['mail', p.email, 'E-mail', `mailto:${p.email.trim()}`]);
  const site = safeUrl(c.website); if (c.show.website && site) out.push(['globe', hostOf(site), 'Site', site]);
  if (c.show.address && c.address.trim()) out.push(['map-pin', c.address.trim(), 'Endereço', mapsUrl(c.address)]);
  return out;
}
function socials(d: D) {
  const m: [keyof SigConfig['social'], string][] = [['linkedin', 'linkedin'], ['instagram', 'instagram'], ['facebook', 'facebook'], ['youtube', 'youtube'], ['whatsapp', 'message-circle']];
  return m.filter(([k]) => d.c.social[k]?.trim()).map(([, i]) => i);
}
const socialLinks = (d: D) => (['linkedin', 'instagram', 'facebook', 'youtube', 'whatsapp'] as (keyof SigConfig['social'])[]).filter((k) => d.c.social[k]?.trim()).map((k) => socialHref(k, d.c.social[k]));
function socialRow(x: Ctx, d: D, cx: number, cy: number, r: number, bg: string | null, fg: string, align: 'center' | 'left' = 'center', shape: 'circle' | 'outline' | 'square' = 'circle') {
  const list = socials(d); if (!list.length) return;
  const gap = r * 2 + 6; const total = list.length * gap - 6; let X = align === 'center' ? cx - total / 2 + r : cx + r;
  const hrefs = socialLinks(d);
  list.forEach((s, i) => { badge(x, s, X, cy, r, bg, fg, shape); hot(X - r - 3, cy - r - 3, r * 2 + 6, r * 2 + 6, hrefs[i]); X += gap; });
}
type ListO = { cols?: number; colW?: number; rowH?: number; size?: number; r?: number; bg?: string | null; fg?: string; color?: string; shape?: BadgeShape; pill?: string; label?: boolean; bottom?: number };
/** Every contact the visual shows (never a fixed maximum). Y = centre of the first row; rows stay above `bottom`. */
function contactList(x: Ctx, d: D, X: number, Y: number, o: ListO) {
  const list = contacts(d); if (!list.length) return;
  const cols = Math.max(1, o.cols || 1), colW = o.colW || 220, total = colW * cols, bottom = o.bottom ?? d.H - 6;
  let rowH = o.rowH || 18, r = o.r || 7, size = o.size || 10.5, label = !!o.label;
  const room = (v: string, w: number) => { x.font = `500 ${size * 0.86}px ${F}`; return x.measureText(v).width + r * 2 + 12 + (o.pill ? 8 : 0) <= w; };
  // a value too long for its column (even 14% smaller) takes the whole row
  const slots: { i: number; col: number; row: number; w: number }[] = []; let row = 0, col = 0;
  list.forEach(([, v], i) => {
    if (cols > 1 && !room(v, colW)) { if (col) { row++; col = 0; } slots.push({ i, col: 0, row, w: total }); row++; }
    else { slots.push({ i, col, row, w: colW }); col++; if (col >= cols) { col = 0; row++; } }
  });
  const rows = row + (col ? 1 : 0);
  const fits = () => Y + (rows - 1) * rowH + r <= bottom + 0.5;
  if (!fits() && label) { label = false; rowH = Math.min(rowH, 18); }
  if (!fits() && rows > 1) {
    rowH = Math.max(9, (bottom - r - Y) / (rows - 1));
    if (rowH < r * 2 + 3) { r = Math.max(4.5, (rowH - 3) / 2); size = Math.min(size, Math.max(6.5, rowH * 0.66)); }
  }
  for (const s of slots) {
    const [ic, val, lab, href] = list[s.i]; const bx = X + s.col * colW, by = Y + s.row * rowH, maxW = s.w - r * 2 - 12 - (o.pill ? 8 : 0);
    if (o.pill) { x.font = `500 ${size}px ${F}`; const w = Math.min(s.w - 8, x.measureText(val).width + r * 2 + 18); rr(x, bx - 3, by - r - 2, w, r * 2 + 4, r + 2); x.fillStyle = o.pill; x.fill(); }
    badge(x, ic, bx + r, by, r, o.bg === undefined ? d.P : o.bg, o.fg || '#fff', o.shape || 'circle');
    let tw = 0;
    if (label) { txt(x, lab, bx + r * 2 + 7, by - 2, { size: 6.5, weight: 500, color: d.M, upper: true, ls: 0.6 }); tw = txt(x, val, bx + r * 2 + 7, by + 8, { size, weight: 600, color: o.color || d.T, maxW }); }
    else tw = txt(x, val, bx + r * 2 + 7, by + size * 0.36, { size, weight: 500, color: o.color || d.T, maxW });
    hot(bx - 3, by - rowH / 2, Math.min(s.w, r * 2 + 7 + tw + 6), rowH, href);
  }
}
/** contacts as centred lines (icon + value), wrapping into up to `lines` lines; the font shrinks until all fit */
function contactInline(x: Ctx, d: D, cx: number, Y: number, maxW: number, o: { size?: number; color?: string; iconColor?: string; lines?: number; lineH?: number }) {
  const list = contacts(d); if (!list.length) return;
  let size = o.size || 10; const lines = o.lines || 2;
  const lay = () => {
    x.font = `500 ${size}px ${F}`; const gap = size * 1.6, ic = size * 1.25;
    const ws = list.map(([, v]) => ic + 5 + Math.min(x.measureText(v).width, maxW - ic - 5));
    const out: number[][] = [[]]; let lw = 0;
    ws.forEach((w, i) => { const cur = out[out.length - 1]; if (cur.length && lw + gap + w > maxW) { out.push([i]); lw = w; } else { cur.push(i); lw += (cur.length > 1 ? gap : 0) + w; } });
    return { out, ws, gap, ic };
  };
  let L = lay(); while (L.out.length > lines && size > 6.5) { size -= 0.5; L = lay(); }
  const lh = o.lineH || size * 2;
  L.out.forEach((idx, li) => {
    const tot = idx.reduce((a, i, k) => a + L.ws[i] + (k ? L.gap : 0), 0); let X = cx - tot / 2; const y = Y + li * lh;
    idx.forEach((i) => { const [ic, v, , href] = list[i]; hot(X - 3, y - lh * 0.68, L.ws[i] + 6, lh, href); icon(x, ic, X, y - L.ic * 0.78, L.ic, o.iconColor || d.P, 2); txt(x, v, X + L.ic + 5, y, { size, weight: 500, color: o.color || d.T, maxW: L.ws[i] - L.ic - 5 }); X += L.ws[i] + L.gap; });
  });
}
const nameOf = (d: D) => (d.p.name || '').trim() || 'Seu nome';
const roleOf = (d: D) => [d.c.show.role && d.p.role, d.c.show.sector && d.p.sector].filter(Boolean).join(' · ');
function dots(x: Ctx, X: number, Y: number, cols: number, rows: number, color: string, gap = 6, r = 1.2) { x.fillStyle = color; for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { x.beginPath(); x.arc(X + i * gap, Y + j * gap, r, 0, Math.PI * 2); x.fill(); } }
/** name (baseline Y) + role + optional accent bar + contacts — the block most styles share */
type InfoO = { ns?: number; nameColor?: string; roleColor?: string; upper?: boolean; split?: boolean; bar?: string | null; ls?: number; roleUpper?: boolean; contactsY?: number } & ListO;
function info(x: Ctx, d: D, X: number, Y: number, w: number, o: InfoO) {
  const ns = o.ns || 21;
  if (o.split) nameSplit(x, d, X, Y, w, ns, o.nameColor || d.T); else txt(x, nameOf(d), X, Y, { size: ns, weight: 700, color: o.nameColor || d.T, maxW: w, upper: o.upper, ls: o.ls });
  txt(x, roleOf(d), X, Y + ns * 0.5 + 11, { size: o.roleUpper ? 9.5 : 11.5, weight: o.roleUpper ? 600 : 400, color: o.roleColor || d.M, maxW: w, upper: o.roleUpper, ls: o.roleUpper ? 1.4 : 0 });
  if (o.bar) { x.fillStyle = o.bar; x.fillRect(X, Y + ns * 0.5 + 20, 40, 2.5); }
  contactList(x, d, X, o.contactsY ?? Y + ns * 0.5 + 41, { ...o, colW: o.colW ?? (o.cols && o.cols > 1 ? w / o.cols : w) });
}
const glow = (x: Ctx, color: string, blur: number, f: () => void) => { x.save(); x.shadowColor = color; x.shadowBlur = blur; f(); x.restore(); };

function watermark(x: Ctx, d: D) {
  const w = d.c.watermark; if (w.kind === 'none') return;
  const H = d.H, W = d.W, size = Math.max(10, Math.min(100, w.size)) / 100;
  x.save(); x.globalAlpha = Math.max(0.02, Math.min(0.5, w.opacity));
  const img = w.kind === 'text' ? null : d.a.wm;
  const drawOne = (cx: number, cy: number, h: number) => {
    if (img) { const k = h / img.height; const iw = Math.min(img.width * k, W * 0.6); const ih = iw / img.width * img.height; x.drawImage(img, cx - iw / 2, cy - ih / 2, iw, ih); }
    else if (w.kind === 'text' && w.text.trim()) txt(x, w.text.trim(), cx, cy + h * 0.33, { size: h, weight: 700, color: d.T, align: 'center' });
  };
  if (w.pos === 'full') {
    const h = Math.max(9, H * size * 0.22); const stepX = Math.max(90, h * (w.kind === 'text' ? Math.max(4, w.text.length * 0.62) : 3)), stepY = h * 2.6;
    x.translate(W / 2, H / 2); x.rotate(-0.33); x.translate(-W / 2, -H / 2);
    for (let yy = -H; yy < H * 2; yy += stepY) for (let xx = -W * 0.5; xx < W * 1.5; xx += stepX) drawOne(xx + ((yy / stepY) % 2 ? stepX / 2 : 0), yy, h);
  } else {
    const h = H * size; const cx = w.pos === 'left' ? W * 0.2 : w.pos === 'right' ? W * 0.8 : W / 2;
    drawOne(cx, H / 2, h);
  }
  x.restore();
}
const bgFill = (x: Ctx, d: D, c: string | CanvasGradient) => { x.fillStyle = c; x.fillRect(0, 0, d.W, d.H); };
const ctaText = (d: D) => (d.c.cta.text || 'Quer saber mais?');
const ctaBtn = (d: D) => (d.c.cta.button || 'Agende uma conversa');
/** splits a sentence in two balanced lines */
const twoLines = (s: string) => { const w = s.split(' '); if (w.length < 2) return [s, '']; let best = 1, diff = 1e9; for (let i = 1; i < w.length; i++) { const df = Math.abs(w.slice(0, i).join(' ').length - w.slice(i).join(' ').length); if (df < diff) { diff = df; best = i; } } return [w.slice(0, best).join(' '), w.slice(best).join(' ')]; };

type BannerStyle = Exclude<SigStyle, 'classic'>;
// ── styles
const STYLES: Record<BannerStyle, (x: Ctx, d: D) => void> = {
  // ─ Moderno
  diagonal(x, d) {
    bgFill(x, d, d.BG);
    poly(x, [[0, 0], [175, 0], [108, 200], [0, 200]], d.P);
    poly(x, [[175, 0], [204, 0], [137, 200], [108, 200]], d.S);
    poly(x, [[548, 0], [600, 0], [600, 52]], d.S);
    watermark(x, d);
    x.strokeStyle = alpha(d.T, 0.2); x.lineWidth = 1.2; x.beginPath(); x.moveTo(555, 186); x.lineTo(565, 170); x.lineTo(575, 186); x.closePath(); x.stroke();
    photo(x, d, 112, 100, 66, { color: '#fff', width: 5 });
    info(x, d, 212, 64, 238, { ns: 22, bar: d.S, cols: 2, rowH: 19, r: 7, size: 9.5, bg: d.P, fg: onColor(d.P), bottom: 192 });
    x.fillStyle = alpha(d.T, 0.25); x.fillRect(460, 58, 1.5, 86);
    logo(x, d, 474, 54, 112, 48, d.T);
    socialRow(x, d, 530, 130, 9, d.T, '#fff');
  },
  triangles(x, d) {
    bgFill(x, d, d.BG);
    poly(x, [[0, 0], [96, 0], [0, 150]], d.S); poly(x, [[0, 150], [0, 200], [70, 200]], d.T); poly(x, [[96, 0], [120, 0], [0, 188], [0, 150]], d.T);
    watermark(x, d);
    poly(x, [[286, 6], [314, 6], [300, 22]], d.T);
    x.strokeStyle = d.T; x.lineWidth = 1.4; x.beginPath(); x.moveTo(530, 186); x.lineTo(546, 168); x.lineTo(562, 186); x.closePath(); x.stroke();
    x.strokeStyle = d.S; x.lineWidth = 3; x.beginPath(); x.moveTo(566, 56); x.lineTo(600, 100); x.lineTo(566, 144); x.stroke();
    photo(x, d, 98, 102, 60, { color: d.S, width: 4 });
    info(x, d, 190, 64, 272, { ns: 22, nameColor: d.S === '#ffffff' ? d.P : d.S, roleColor: d.T, bar: d.T, cols: 2, rowH: 21, r: 8, size: 9.5, bg: d.S, fg: onColor(d.S), bottom: 192 });
    x.fillStyle = d.S; x.fillRect(470, 48, 2, 104); x.fillRect(476, 48, 2, 104);
    logo(x, d, 490, 54, 98, 46, d.T);
    socialRow(x, d, 539, 128, 8, d.T, '#fff');
  },
  hexagon(x, d) {
    bgFill(x, d, d.BG);
    const gl = x.createLinearGradient(0, 0, 60, 0); gl.addColorStop(0, shade(d.P, 0.8)); gl.addColorStop(1, d.P);
    poly(x, [[0, 0], [58, 0], [18, 100], [58, 200], [0, 200]], gl);
    const gr = x.createLinearGradient(430, 0, 600, 0); gr.addColorStop(0, d.P); gr.addColorStop(1, shade(d.P, 0.75));
    poly(x, [[468, 0], [600, 0], [600, 200], [468, 200], [430, 100]], gr);
    watermark(x, d);
    logo(x, d, 64, 50, 108, 48, d.T);
    if (d.c.slogan.trim()) txt(x, d.c.slogan.trim(), 118, 116, { size: 7.5, color: d.M, align: 'center', maxW: 108, upper: true });
    [0.5, 0.7, 0.85, 1].forEach((a, i) => { x.fillStyle = alpha(d.P, a); x.beginPath(); x.arc(98 + i * 13, 132, 4, 0, Math.PI * 2); x.fill(); });
    x.fillStyle = alpha(d.T, 0.35); x.fillRect(186, 44, 1.4, 112);
    info(x, d, 202, 62, 224, { ns: 20, split: true, nameColor: d.P, cols: 1, rowH: 20, r: 8, size: 9.5, bg: d.P, fg: onColor(d.P), shape: 'hex', bottom: 192 });
    hexPath(x, 516, 100, 84); x.strokeStyle = alpha('#ffffff', 0.85); x.lineWidth = 2; x.stroke();
    hexPath(x, 516, 100, 76); x.fillStyle = '#ffffff'; x.fill();
    photo(x, d, 516, 100, 70, undefined, 'hexagon');
  },
  darkpanel(x, d) {
    bgFill(x, d, d.P);
    dots(x, 18, 160, 4, 3, alpha('#ffffff', 0.35));
    poly(x, [[198, 12], [592, 12], [592, 188], [148, 188]], d.BG);
    watermark(x, d);
    dots(x, 548, 26, 5, 3, alpha(d.T, 0.25));
    logoTile(x, d, 14, 16, 112, 40);
    x.beginPath(); x.arc(170, 112, 66, 0, Math.PI * 2); x.fillStyle = shade(d.P, 0.8); x.fill();
    photo(x, d, 170, 112, 56, { color: d.BG, width: 3 });
    const so = socials(d).length > 0;
    info(x, d, 254, 56, 318, { ns: 22, bar: d.P, cols: 2, rowH: 24, r: 7, size: 9.5, bg: d.P, fg: onColor(d.P), pill: '#eef0f3', contactsY: 112, bottom: so ? 158 : 180 });
    socialRow(x, d, 254, 174, 7, null, d.T, 'left');
  },
  chevron(x, d) {
    bgFill(x, d, d.BG);
    poly(x, [[0, 0], [118, 0], [170, 100], [118, 200], [0, 200]], d.P);
    poly(x, [[132, 0], [150, 0], [202, 100], [150, 200], [132, 200], [184, 100]], d.S);
    poly(x, [[560, 0], [600, 0], [600, 200], [560, 200], [586, 100]], alpha(d.P, 0.12));
    watermark(x, d);
    photo(x, d, 88, 100, 62, { color: '#fff', width: 4 });
    info(x, d, 222, 64, 230, { ns: 21, bar: d.S, rowH: 18, r: 7, size: 9.5, bg: d.P, fg: onColor(d.P), bottom: 192 });
    x.fillStyle = alpha(d.T, 0.2); x.fillRect(462, 50, 1.4, 100);
    logo(x, d, 474, 50, 96, 46, d.T);
    socialRow(x, d, 522, 126, 8, d.P, onColor(d.P));
  },
  blocks(x, d) {
    bgFill(x, d, d.BG);
    x.save(); x.translate(560, 96); x.rotate(Math.PI / 4); x.fillStyle = d.P; x.fillRect(-92, -92, 184, 184); x.restore();
    x.save(); x.translate(452, 186); x.rotate(Math.PI / 4); x.fillStyle = d.S; x.fillRect(-16, -16, 32, 32); x.restore();
    x.save(); x.translate(28, 26); x.rotate(Math.PI / 4); x.strokeStyle = alpha(d.P, 0.5); x.lineWidth = 1.5; x.strokeRect(-10, -10, 20, 20); x.restore();
    watermark(x, d);
    photo(x, d, 94, 100, 62, { color: d.P, width: 3 });
    info(x, d, 184, 64, 250, { ns: 21, bar: d.S, rowH: 18, r: 7, size: 9.5, bg: d.P, fg: onColor(d.P), bottom: 192 });
    logoTile(x, d, 480, 62, 112, 52);
    socialRow(x, d, 536, 150, 8, null, onColor(d.P));
  },
  slash(x, d) {
    bgFill(x, d, d.BG);
    poly(x, [[150, 28], [600, 28], [584, 112], [134, 112]], alpha(d.P, 0.1));
    poly(x, [[0, 0], [58, 0], [20, 200], [0, 200]], d.P);
    poly(x, [[70, 0], [84, 0], [46, 200], [32, 200]], d.S);
    watermark(x, d);
    photo(x, d, 122, 100, 58, { color: '#fff', width: 4 });
    txt(x, nameOf(d), 200, 64, { size: 22, weight: 700, color: d.T, maxW: 258 });
    txt(x, roleOf(d), 200, 86, { size: 11.5, color: d.P, maxW: 258, weight: 500 });
    logo(x, d, 470, 36, 108, 40, d.T);
    socialRow(x, d, 524, 96, 7, d.P, onColor(d.P));
    contactList(x, d, 200, 134, { cols: 2, colW: 192, rowH: 19, r: 7, size: 9.5, bg: d.P, fg: onColor(d.P), bottom: 192 });
  },
  // ─ Criativo
  arcs(x, d) {
    bgFill(x, d, d.BG);
    const g = x.createLinearGradient(0, 0, d.W, d.H); g.addColorStop(0, alpha(d.P, 0.07)); g.addColorStop(0.6, alpha(d.P, 0)); bgFill(x, d, g);
    watermark(x, d);
    x.lineCap = 'round';
    x.strokeStyle = d.P; x.lineWidth = 6; x.beginPath(); x.arc(98, 100, 80, Math.PI * 0.55, Math.PI * 1.55); x.stroke();
    x.strokeStyle = alpha(d.P, 0.45); x.lineWidth = 2; x.beginPath(); x.arc(98, 100, 90, Math.PI * 0.7, Math.PI * 1.4); x.stroke();
    x.strokeStyle = d.S; x.lineWidth = 3; x.beginPath(); x.arc(98, 100, 80, Math.PI * 1.62, Math.PI * 1.85); x.stroke();
    photo(x, d, 98, 100, 64, { color: '#fff', width: 4 });
    info(x, d, 200, 62, 244, { ns: 20, upper: true, nameColor: d.P, roleColor: d.T, rowH: 17, r: 7, size: 9.5, bg: d.P, fg: onColor(d.P), bottom: 192 });
    x.fillStyle = alpha(d.P, 0.5); x.fillRect(452, 34, 1.5, 96);
    logo(x, d, 466, 28, 118, 46, d.P);
    x.beginPath(); x.arc(600, 200, 92, Math.PI, Math.PI * 1.5); x.lineTo(600, 200); x.closePath(); x.fillStyle = shade(d.P, 0.55); x.fill();
    x.strokeStyle = d.P; x.lineWidth = 4; x.beginPath(); x.arc(600, 200, 100, Math.PI, Math.PI * 1.5); x.stroke();
    socialRow(x, d, 560, 172, 8, null, '#fff');
  },
  wave(x, d) {
    bgFill(x, d, d.BG);
    for (let i = 0; i < 6; i++) poly(x, [[330 + i * 48, 0], [354 + i * 48, 0], [254 + i * 48, 200], [230 + i * 48, 200]], alpha(d.T, 0.035));
    x.beginPath(); x.moveTo(0, 0); x.lineTo(150, 0); x.bezierCurveTo(105, 70, 200, 130, 125, 200); x.lineTo(0, 200); x.closePath(); x.fillStyle = d.P; x.fill();
    watermark(x, d);
    x.strokeStyle = alpha('#ffffff', 0.45); x.lineWidth = 1.5; x.beginPath(); x.arc(40, 152, 18, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(70, 40, 6, 0, Math.PI * 2); x.stroke();
    photo(x, d, 142, 100, 62, { color: '#ffffff', width: 6 });
    x.strokeStyle = alpha(d.P, 0.5); x.lineWidth = 1.5; x.beginPath(); x.arc(142, 100, 72, 0, Math.PI * 2); x.stroke();
    txt(x, nameOf(d), 232, 64, { size: 23, weight: 700, color: d.T, maxW: 200 });
    txt(x, roleOf(d), 232, 85, { size: 12, color: alpha(d.T, 0.75), maxW: 200 });
    x.fillStyle = alpha(d.T, 0.25); x.fillRect(232, 95, 150, 1.2);
    contactList(x, d, 232, 116, { rowH: 24, r: 8, size: 10, bg: d.T, fg: d.T, shape: 'outline', label: true, colW: 200, bottom: 192 });
    x.fillStyle = alpha(d.T, 0.3); x.fillRect(440, 40, 1.4, 120);
    logo(x, d, 458, 40, 124, 48, d.T);
    if (d.c.slogan.trim()) txt(x, d.c.slogan.trim(), 520, 110, { size: 8.5, color: d.M, align: 'center', maxW: 134 });
    socialRow(x, d, 520, 146, 8, d.T, d.T, 'center', 'outline');
  },
  ring(x, d) {
    bgFill(x, d, d.BG === '#ffffff' ? '#f4f5f7' : d.BG);
    x.strokeStyle = alpha(d.P, 0.6); x.lineWidth = 1.2; x.beginPath(); x.moveTo(0, 46); x.lineTo(46, 0); x.moveTo(0, 58); x.lineTo(58, 0); x.moveTo(554, 200); x.lineTo(600, 154); x.moveTo(542, 200); x.lineTo(600, 142); x.stroke();
    watermark(x, d);
    x.fillStyle = d.P; x.beginPath(); x.arc(28, 30, 10, 0, Math.PI * 2); x.fill(); x.beginPath(); x.arc(572, 170, 10, 0, Math.PI * 2); x.fill();
    x.strokeStyle = d.P; x.lineWidth = 11; x.lineCap = 'butt'; x.beginPath(); x.arc(106, 100, 72, -Math.PI * 0.15, Math.PI * 1.25); x.stroke();
    photo(x, d, 106, 100, 56);
    txt(x, nameOf(d), 194, 90, { size: 19, weight: 700, color: d.T, maxW: 134 });
    txt(x, roleOf(d), 194, 108, { size: 11, color: d.M, maxW: 134 });
    x.fillStyle = d.T; x.fillRect(334, 40, 1.6, 120); x.fillRect(494, 40, 1.6, 120);
    contactList(x, d, 346, 62, { rowH: 21, r: 7, size: 8.8, bg: d.T, fg: '#fff', colW: 146, bottom: 170 });
    logo(x, d, 504, 58, 88, 44, d.T);
    socialRow(x, d, 548, 128, 7, d.T, '#fff');
  },
  bubbles(x, d) {
    bgFill(x, d, d.BG);
    ([[38, 176, 52, d.P, 0.14], [566, 26, 64, d.S, 0.28], [506, 190, 30, d.P, 0.18], [154, 16, 13, d.S, 0.55], [590, 128, 11, d.P, 0.8], [196, 186, 7, d.P, 0.5]] as [number, number, number, string, number][])
      .forEach(([cx, cy, r, c, a]) => { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fillStyle = alpha(c, a); x.fill(); });
    watermark(x, d);
    x.strokeStyle = alpha(d.P, 0.35); x.lineWidth = 1.5; x.beginPath(); x.arc(100, 100, 77, 0, Math.PI * 2); x.stroke();
    photo(x, d, 100, 100, 64, { color: d.P, width: 3 });
    info(x, d, 198, 64, 252, { ns: 21, bar: d.S, rowH: 18, r: 7, size: 9.5, bg: d.P, fg: onColor(d.P), bottom: 192 });
    logo(x, d, 464, 58, 120, 46, d.T);
    socialRow(x, d, 524, 130, 8, d.P, onColor(d.P));
  },
  blob(x, d) {
    bgFill(x, d, d.BG);
    x.beginPath(); x.moveTo(20, 44); x.bezierCurveTo(66, -12, 196, 4, 206, 72); x.bezierCurveTo(216, 136, 168, 204, 96, 194); x.bezierCurveTo(24, 184, -18, 104, 20, 44); x.fillStyle = alpha(d.S, 0.55); x.fill();
    x.beginPath(); x.moveTo(34, 52); x.bezierCurveTo(80, 6, 186, 20, 190, 84); x.bezierCurveTo(194, 140, 150, 186, 96, 180); x.bezierCurveTo(36, 172, 4, 104, 34, 52); x.fillStyle = d.P; x.fill();
    x.beginPath(); x.moveTo(520, 200); x.bezierCurveTo(540, 150, 600, 150, 600, 120); x.lineTo(600, 200); x.closePath(); x.fillStyle = alpha(d.P, 0.15); x.fill();
    watermark(x, d);
    photo(x, d, 110, 100, 60, { color: '#fff', width: 4 });
    info(x, d, 222, 64, 230, { ns: 21, bar: d.P, rowH: 18, r: 7, size: 9.5, bg: d.P, fg: onColor(d.P), bottom: 192 });
    logo(x, d, 466, 50, 118, 46, d.T);
    socialRow(x, d, 525, 124, 8, d.P, onColor(d.P));
    dots(x, 548, 168, 6, 3, alpha(d.P, 0.4));
  },
  gradient(x, d) {
    const g = x.createLinearGradient(0, 0, d.W, d.H); g.addColorStop(0, shade(d.P, 0.85)); g.addColorStop(1, d.S === '#ffffff' ? shade(d.P, 0.5) : mix(d.P, d.S, 0.55)); bgFill(x, d, g);
    x.beginPath(); x.arc(560, -10, 130, 0, Math.PI * 2); x.fillStyle = alpha('#ffffff', 0.08); x.fill();
    x.beginPath(); x.arc(30, 210, 80, 0, Math.PI * 2); x.fillStyle = alpha('#ffffff', 0.06); x.fill();
    watermark(x, { ...d, T: '#ffffff' });
    photo(x, d, 96, 100, 62, { color: alpha('#ffffff', 0.7), width: 4 });
    info(x, d, 188, 64, 264, { ns: 21, nameColor: '#ffffff', roleColor: alpha('#ffffff', 0.85), bar: '#ffffff', rowH: 18, r: 7, size: 9.5, bg: '#ffffff', fg: shade(d.P, 0.8), color: '#ffffff', bottom: 192 });
    logoTile(x, d, 470, 50, 114, 54);
    socialRow(x, d, 527, 136, 8, null, '#ffffff');
  },
  // ─ Corporativo
  'corp-light'(x, d) { corporate(x, d, 'light'); },
  'corp-color'(x, d) { corporate(x, d, 'color'); },
  'corp-dark'(x, d) { corporate(x, d, 'dark'); },
  'corp-stripe'(x, d) {
    bgFill(x, d, d.BG);
    x.fillStyle = d.P; x.fillRect(0, 0, d.W, 8); x.fillStyle = d.S; x.fillRect(0, 0, 150, 8);
    watermark(x, d);
    logo(x, d, 22, 30, 146, 60, d.T);
    txt(x, d.company.toUpperCase(), 95, 112, { size: 10, weight: 700, color: d.T, align: 'center', maxW: 150, ls: 1 });
    socialRow(x, d, 95, 140, 7, d.P, onColor(d.P));
    x.fillStyle = alpha(d.T, 0.18); x.fillRect(186, 30, 1.4, 118);
    info(x, d, 206, 52, 372, { ns: 22, roleUpper: true, roleColor: d.P, cols: 2, rowH: 19, r: 7, size: 9.5, bg: null, fg: d.P, contactsY: 96, bottom: 162 });
  },
  'corp-split'(x, d) {
    bgFill(x, d, d.BG);
    poly(x, [[0, 0], [266, 0], [246, 170], [0, 170]], d.P);
    poly(x, [[266, 0], [274, 0], [254, 170], [246, 170]], d.S);
    watermark(x, d);
    photo(x, d, 56, 85, 38, { color: '#ffffff', width: 3 });
    txt(x, nameOf(d), 104, 78, { size: 17, weight: 700, color: onColor(d.P), maxW: 134 });
    txt(x, roleOf(d), 104, 96, { size: 10, color: alpha(onColor(d.P), 0.85), maxW: 134 });
    x.fillStyle = d.S; x.fillRect(104, 104, 30, 2.5);
    contactList(x, d, 290, 40, { rowH: 21, r: 7, size: 9.5, bg: d.P, fg: onColor(d.P), colW: 186, bottom: 160 });
    logo(x, d, 486, 36, 100, 50, d.T);
    socialRow(x, d, 536, 128, 7, d.P, onColor(d.P));
  },
  'corp-frame'(x, d) {
    bgFill(x, d, d.BG);
    rr(x, 8, 8, 584, 154, 12); x.strokeStyle = d.P; x.lineWidth = 1.6; x.stroke();
    x.fillStyle = d.P; x.fillRect(8 + 20, 160, 120, 4);
    watermark(x, d);
    logo(x, d, 24, 36, 132, 56, d.T);
    if (d.c.slogan.trim()) txt(x, d.c.slogan.trim(), 90, 116, { size: 7.5, color: d.M, align: 'center', maxW: 140, upper: true, ls: 0.5 });
    x.fillStyle = alpha(d.P, 0.5); x.fillRect(170, 30, 1.4, 110);
    photo(x, d, 222, 85, 38, { color: d.P, width: 2 });
    info(x, d, 276, 60, 296, { ns: 19, bar: d.P, cols: 2, rowH: 18, r: 7, size: 9, bg: d.P, fg: onColor(d.P), contactsY: 104, bottom: 150 });
    socialRow(x, d, 568, 30, 7, null, d.P, 'center', 'outline');
  },
  // ─ Minimalista
  'minimal-line'(x, d) {
    bgFill(x, d, d.BG);
    watermark(x, d);
    photo(x, d, 62, 75, 44);
    x.fillStyle = d.P; x.fillRect(124, 26, 3, 98);
    info(x, d, 142, 48, 300, { ns: 20, roleColor: d.P, cols: 2, rowH: 17, r: 6.5, size: 9.5, bg: null, fg: d.P, contactsY: 86, bottom: 142 });
    logo(x, d, 466, 34, 116, 46, d.T);
    socialRow(x, d, 524, 108, 7, null, d.M, 'center', 'outline');
  },
  'minimal-center'(x, d) {
    bgFill(x, d, d.BG);
    watermark(x, d);
    logo(x, d, 18, 16, 96, 36, d.T);
    socialRow(x, d, 548, 34, 7, null, d.P, 'center', 'outline');
    photo(x, d, 300, 50, 34, { color: alpha(d.P, 0.25), width: 3 });
    txt(x, nameOf(d), 300, 112, { size: 20, weight: 700, color: d.T, align: 'center', maxW: 420 });
    txt(x, roleOf(d), 300, 130, { size: 11, color: d.M, align: 'center', maxW: 420 });
    x.fillStyle = d.P; x.fillRect(282, 139, 36, 2);
    contactInline(x, d, 300, 160, 560, { size: 10, iconColor: d.P, lines: 2, lineH: 17 });
  },
  card(x, d) {
    bgFill(x, d, d.BG === '#ffffff' ? '#eef1f4' : shade(d.BG, 0.94));
    glow(x, 'rgba(15,23,42,0.16)', 14, () => { x.shadowOffsetY = 4; rr(x, 14, 14, 572, 152, 16); x.fillStyle = d.BG; x.fill(); });
    x.save(); rr(x, 14, 14, 572, 152, 16); x.clip(); x.fillStyle = d.P; x.fillRect(14, 14, 6, 152); watermark(x, d); x.restore();
    photo(x, d, 82, 90, 44, { color: d.P, width: 2.5 });
    info(x, d, 144, 58, 270, { ns: 20, bar: d.P, rowH: 16, r: 6.5, size: 9.5, bg: d.P, fg: onColor(d.P), bottom: 158 });
    x.fillStyle = alpha(d.T, 0.12); x.fillRect(428, 34, 1.4, 112);
    logo(x, d, 444, 50, 128, 48, d.T);
    socialRow(x, d, 508, 124, 7, d.P, onColor(d.P));
  },
  underline(x, d) {
    bgFill(x, d, d.BG);
    watermark(x, d);
    const nw = txt(x, nameOf(d), 28, 56, { size: 26, weight: 700, color: d.T, maxW: 390 });
    x.fillStyle = d.P; x.fillRect(28, 66, Math.min(nw, 390) * 0.55, 5); x.fillStyle = d.S; x.fillRect(28 + Math.min(nw, 390) * 0.55 + 4, 66, 18, 5);
    txt(x, roleOf(d), 28, 90, { size: 12, color: d.M, maxW: 390 });
    contactList(x, d, 28, 116, { cols: 2, colW: 198, rowH: 18, r: 6.5, size: 9.5, bg: null, fg: d.P, bottom: 152 });
    photo(x, d, 520, 54, 38, { color: d.P, width: 2 });
    logo(x, d, 466, 100, 108, 30, d.T);
    socialRow(x, d, 520, 146, 6.5, null, d.M, 'center', 'outline');
  },
  mono(x, d) {
    const g: D = { ...d, P: '#111111', S: '#111111', T: '#111111', M: '#555555', BG: '#ffffff', gray: true };
    bgFill(x, g, '#ffffff');
    watermark(x, g);
    photo(x, g, 70, 80, 50);
    x.fillStyle = '#111'; x.fillRect(138, 26, 2, 108);
    info(x, g, 158, 52, 290, { ns: 21, upper: true, ls: 1, roleUpper: true, roleColor: '#555555', cols: 2, rowH: 18, r: 7, size: 9.5, bg: '#111111', fg: '#ffffff', shape: 'square', contactsY: 96, bottom: 152 });
    logo(x, g, 466, 40, 116, 48, '#111');
    socialRow(x, g, 524, 118, 7, '#111111', '#ffffff', 'center', 'square');
  },
  // ─ Com chamada
  cta(x, d) {
    bgFill(x, d, d.BG);
    watermark(x, d);
    photo(x, d, 74, 74, 58);
    const list = socials(d).length ? socials(d) : ['phone', 'mail', 'globe'];
    const sh = socials(d).length ? socialLinks(d) : [];
    list.slice(0, 3).forEach((s, i) => { badge(x, s, 166, 34 + i * 38, 14, d.P, onColor(d.P)); hot(150, 18 + i * 38, 32, 32, sh[i]); });
    txt(x, nameOf(d), 196, 38, { size: 17, weight: 700, color: d.P, maxW: 390 });
    txt(x, roleOf(d), 196, 56, { size: 12, color: d.T, maxW: 390 });
    const cl = contacts(d); const step = cl.length > 1 ? Math.min(17, 64 / (cl.length - 1)) : 17;
    cl.forEach(([, v, , href], i) => { const tw = txt(x, v, 196, 80 + i * step, { size: step < 15 ? 10 : 11, color: d.T, maxW: 390 }); hot(193, 80 + i * step - step * 0.72, tw + 6, step, href); });
    hot(10, 160, 580, 60, ctaUrl(d));
    rr(x, 210, 160, 380, 60, 14); x.fillStyle = alpha(d.P, 0.28); x.fill();
    rr(x, 10, 160, 236, 60, 14); x.fillStyle = shade(d.P, 0.8); x.fill();
    const [l1, l2] = twoLines(ctaText(d).toUpperCase());
    txt(x, l1, 30, l2 ? 185 : 195, { size: 15, weight: 700, color: '#fff', maxW: 200 });
    if (l2) txt(x, l2, 30, 205, { size: 15, weight: 700, color: '#fff', maxW: 200 });
    txt(x, ctaBtn(d).toUpperCase(), 418, 195, { size: 13, weight: 700, color: shade(d.P, 0.7), align: 'center', maxW: 300 });
  },
  'cta-side'(x, d) {
    bgFill(x, d, d.BG);
    poly(x, [[412, 0], [600, 0], [600, 200], [382, 200]], d.P);
    poly(x, [[400, 0], [408, 0], [378, 200], [370, 200]], d.S);
    watermark(x, d);
    photo(x, d, 70, 68, 48, { color: d.P, width: 3 });
    txt(x, nameOf(d), 134, 58, { size: 19, weight: 700, color: d.T, maxW: 228 });
    txt(x, roleOf(d), 134, 77, { size: 11, color: d.M, maxW: 228 });
    x.fillStyle = d.S; x.fillRect(134, 86, 30, 2.5);
    contactList(x, d, 24, 138, { cols: 2, colW: 172, rowH: 19, r: 7, size: 9.5, bg: d.P, fg: onColor(d.P), bottom: 192 });
    logoTile(x, d, 444, 12, 120, 40);
    const ink = onColor(d.P); const [l1, l2] = twoLines(ctaText(d));
    txt(x, l1, 500, l2 ? 84 : 94, { size: 15, weight: 700, color: ink, align: 'center', maxW: 176 });
    if (l2) txt(x, l2, 500, 103, { size: 15, weight: 700, color: ink, align: 'center', maxW: 176 });
    rr(x, 420, 118, 162, 34, 17); x.fillStyle = ink; x.fill(); hot(412, 64, 178, 94, ctaUrl(d));
    txt(x, ctaBtn(d), 501, 140, { size: 11.5, weight: 700, color: d.P, align: 'center', maxW: 148 });
    socialRow(x, d, 501, 178, 7, null, ink);
  },
  'promo-ribbon'(x, d) {
    bgFill(x, d, d.BG);
    watermark(x, d);
    photo(x, d, 78, 84, 56, { color: d.S, width: 4 });
    info(x, d, 162, 58, 280, { ns: 21, bar: d.S, cols: 2, rowH: 19, r: 7, size: 9.5, bg: d.P, fg: onColor(d.P), bottom: 164 });
    logo(x, d, 462, 36, 122, 48, d.T);
    socialRow(x, d, 523, 112, 7, d.P, onColor(d.P));
    x.fillStyle = d.P; x.fillRect(0, 176, d.W, 54); hot(0, 176, d.W, 54, ctaUrl(d));
    poly(x, [[0, 176], [206, 176], [184, 230], [0, 230]], d.S);
    txt(x, ctaText(d), 18, 209, { size: 13, weight: 700, color: onColor(d.S), maxW: 168 });
    const bw = txt(x, ctaBtn(d).toUpperCase(), 394, 209, { size: 13, weight: 700, color: onColor(d.P), align: 'center', maxW: 330, ls: 0.8 });
    x.strokeStyle = onColor(d.P); x.lineWidth = 2; x.beginPath(); const ax = 394 + bw / 2 + 12; x.moveTo(ax, 204); x.lineTo(ax + 14, 204); x.moveTo(ax + 9, 199); x.lineTo(ax + 14, 204); x.lineTo(ax + 9, 209); x.stroke();
  },
  // ─ Escuro
  'dark-gold'(x, d) {
    const G = d.S === '#ffffff' ? '#C9A227' : d.S;
    bgFill(x, d, '#111214');
    watermark(x, { ...d, T: G });
    x.strokeStyle = alpha(G, 0.45); x.lineWidth = 1; x.strokeRect(10.5, 10.5, 579, 179);
    x.fillStyle = G; [[10, 10, 1, 1], [590, 10, -1, 1], [10, 190, 1, -1], [590, 190, -1, -1]].forEach(([X, Y, sx, sy]) => { x.fillRect(X, Y, 26 * sx, 2.5 * sy); x.fillRect(X, Y, 2.5 * sx, 26 * sy); });
    photo(x, d, 100, 100, 62, { color: G, width: 2.5 });
    info(x, d, 194, 66, 258, { ns: 20, upper: true, ls: 1, nameColor: '#ffffff', roleUpper: true, roleColor: G, bar: G, rowH: 17.5, r: 7, size: 9.5, bg: G, fg: G, shape: 'outline', color: '#e5e5e5', bottom: 184 });
    logoTile(x, d, 468, 52, 114, 52);
    socialRow(x, d, 525, 138, 7.5, G, G, 'center', 'outline');
  },
  neon(x, d) {
    const N = bright(d.P);
    bgFill(x, d, '#0b0f1a');
    x.strokeStyle = alpha(N, 0.09); x.lineWidth = 1; x.beginPath(); for (let i = 0; i <= 600; i += 24) { x.moveTo(i, 0); x.lineTo(i, 200); } for (let j = 0; j <= 200; j += 24) { x.moveTo(0, j); x.lineTo(600, j); } x.stroke();
    watermark(x, { ...d, T: N });
    glow(x, N, 18, () => { shapePath(x, d.c.photoShape, 102, 100, 66); x.strokeStyle = N; x.lineWidth = 3; x.stroke(); });
    photo(x, d, 102, 100, 60);
    glow(x, alpha(N, 0.8), 12, () => txt(x, nameOf(d), 196, 66, { size: 22, weight: 700, color: '#ffffff', maxW: 256 }));
    txt(x, roleOf(d), 196, 88, { size: 11.5, color: N, maxW: 256, weight: 500 });
    glow(x, N, 8, () => { x.fillStyle = N; x.fillRect(196, 97, 40, 2.5); });
    contactList(x, d, 196, 118, { rowH: 17.5, r: 7, size: 9.5, bg: N, fg: N, shape: 'outline', color: '#cbd5e1', colW: 258, bottom: 190 });
    logoTile(x, d, 470, 52, 112, 52);
    socialRow(x, d, 526, 138, 7.5, N, N, 'center', 'outline');
  },
  midnight(x, d) {
    const g = x.createLinearGradient(0, 0, 0, d.H); g.addColorStop(0, mix(shade(d.P, 0.35), '#0b1020', 0.5)); g.addColorStop(1, mix(shade(d.P, 0.2), '#05070d', 0.5)); bgFill(x, d, g);
    x.beginPath(); x.arc(520, 40, 110, 0, Math.PI * 2); x.fillStyle = alpha('#ffffff', 0.04); x.fill();
    dots(x, 24, 24, 8, 3, alpha('#ffffff', 0.18), 7, 1);
    [[350, 30], [420, 170], [585, 110], [250, 20]].forEach(([sx, sy]) => { x.beginPath(); x.arc(sx, sy, 1.4, 0, Math.PI * 2); x.fillStyle = alpha('#ffffff', 0.6); x.fill(); });
    watermark(x, { ...d, T: '#ffffff' });
    photo(x, d, 100, 106, 60, { color: d.S, width: 3 });
    info(x, d, 192, 70, 262, { ns: 21, nameColor: '#ffffff', roleColor: alpha('#ffffff', 0.72), bar: d.S, rowH: 17.5, r: 7, size: 9.5, bg: d.S, fg: onColor(d.S), color: '#e2e8f0', bottom: 190 });
    logoTile(x, d, 470, 52, 112, 52);
    socialRow(x, d, 526, 138, 7.5, null, '#ffffff');
  },
};
function corporate(x: Ctx, d: D, v: 'light' | 'color' | 'dark') {
  const bg = v === 'light' ? (d.BG === '#ffffff' ? '#eef1f3' : d.BG) : v === 'color' ? d.P : '#1f2326';
  const ink = v === 'light' ? d.T : '#ffffff'; const acc = v === 'light' ? d.P : v === 'color' ? '#ffffff' : bright(d.P);
  bgFill(x, d, bg);
  watermark(x, { ...d, T: ink });
  x.fillStyle = alpha(ink, 0.35); x.fillRect(572, 0, 28, 46); x.fillStyle = v === 'color' ? shade(d.P, 0.65) : acc; x.fillRect(584, 46, 16, 124);
  if (v !== 'light') logoTile(x, d, 22, 24, 136, 62); else logo(x, d, 26, 28, 128, 56, ink);
  txt(x, d.company.toUpperCase(), 90, 110, { size: 12, weight: 700, color: ink, align: 'center', maxW: 160 });
  if (d.c.slogan.trim()) txt(x, d.c.slogan.trim(), 90, 124, { size: 6.5, color: alpha(ink, 0.7), align: 'center', maxW: 160, upper: true, ls: 0.5 });
  x.fillStyle = acc; x.fillRect(188, 26, 3, 118);
  nameSplit(x, d, 208, 54, 352, 24, ink, 400, 700);
  txt(x, roleOf(d), 210, 72, { size: 9.5, weight: 500, color: v === 'light' ? acc : alpha(ink, 0.85), upper: true, ls: 2.2, maxW: 350 });
  contactList(x, d, 210, 100, { cols: 2, colW: 178, rowH: 19, r: 7, size: 9.5, bg: null, fg: acc, color: ink, bottom: 160 });
}

/** Draws the banner into the canvas (2x for sharp text). Returns false for the classic (text) style. */
export function drawBanner(canvas: HTMLCanvasElement, cfg0: Partial<SigConfig>, p: SigPerson, a: BannerAssets, company: string, links?: BannerLink[]): boolean {
  const c = fullConfig(cfg0); if (!isBannerStyle(c.style)) return false;
  const draw = STYLES[c.style as BannerStyle]; if (!draw) return false;
  const W = BANNER_W, H = bannerHeight(c.style), k = 2;
  canvas.width = W * k; canvas.height = H * k;
  const x = canvas.getContext('2d'); if (!x) return false;
  x.setTransform(k, 0, 0, k, 0, 0); x.clearRect(0, 0, W, H);
  const d: D = { c, p, a, company: company || 'Empresa', W, H, P: toHex(c.color), S: toHex(c.color2, '#F5B800'), T: toHex(c.textColor, '#333333'), M: '#6b7280', BG: toHex(c.bgColor, '#ffffff') };
  LINKS = links || null;
  try { draw(x, d); } finally { LINKS = null; }
  return true;
}

export type SliceRow = { y: number; h: number; cells: { x: number; w: number; href: string | null }[] };
/** Cuts the banner into horizontal bands and each band into cells so every clickable area is its own image + link.
 *  Bands with the same cells are merged, so a typical signature becomes 10–40 small images. */
export function sliceBanner(links: BannerLink[], W: number, H: number): SliceRow[] {
  const L = links.map((l) => ({ x0: Math.max(0, Math.floor(l.x)), y0: Math.max(0, Math.floor(l.y)), x1: Math.min(W, Math.ceil(l.x + l.w)), y1: Math.min(H, Math.ceil(l.y + l.h)), href: l.href }))
    .filter((l) => l.x1 - l.x0 >= 2 && l.y1 - l.y0 >= 2);
  const ys = [...new Set([0, H, ...L.flatMap((l) => [l.y0, l.y1])])].sort((a, b) => a - b);
  const rows: SliceRow[] = [];
  for (let i = 0; i < ys.length - 1; i++) {
    const a = ys[i], b = ys[i + 1]; if (b <= a) continue;
    const act = L.filter((l) => l.y0 < b && l.y1 > a);
    const xs = [...new Set([0, W, ...act.flatMap((l) => [l.x0, l.x1])])].sort((p, q) => p - q);
    const cells: SliceRow['cells'] = [];
    for (let j = 0; j < xs.length - 1; j++) {
      const sx = xs[j], ex = xs[j + 1]; if (ex <= sx) continue;
      const hit = act.find((l) => l.x0 <= sx && l.x1 >= ex); const href = hit ? hit.href : null;
      const last = cells[cells.length - 1];
      if (last && last.href === href) last.w += ex - sx; else cells.push({ x: sx, w: ex - sx, href });
    }
    const prev = rows[rows.length - 1];
    const same = prev && prev.cells.length === cells.length && prev.cells.every((c, k) => c.x === cells[k].x && c.w === cells[k].w && c.href === cells[k].href);
    if (same) prev.h += b - a; else rows.push({ y: a, h: b - a, cells });
  }
  return rows;
}

/** Rows under the banner: clickable contacts (optional) and the legal notice. */
export function bannerLinksHtml(cfg0: Partial<SigConfig>, p: SigPerson): string {
  const c = fullConfig(cfg0);
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const site = safeUrl(c.website); const color = toHex(c.color);
  const link = (h: string, l: string) => `<a href="${esc(h)}" style="color:${color};text-decoration:none">${esc(l)}</a>`;
  const bits: string[] = [];
  if (c.textLinks) {
    if (c.show.phone && p.phone) bits.push(link(`tel:${p.phone.replace(/[^\d+]/g, '')}`, p.phone));
    if (c.show.mobile && p.mobile) bits.push(link(`tel:${p.mobile.replace(/[^\d+]/g, '')}`, p.mobile));
    if (c.show.email && p.email) bits.push(link(`mailto:${p.email}`, p.email));
    if (c.show.website && site) bits.push(link(site, hostOf(site)));
    if (hasCta(c.style) && safeUrl(c.cta.url)) bits.push(link(safeUrl(c.cta.url), c.cta.button || 'Agendar'));
  }
  const line = bits.length ? `<tr><td style="padding-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#666666">${bits.join('&nbsp;&nbsp;·&nbsp;&nbsp;')}</td></tr>` : '';
  const disc = c.disclaimer.trim() ? `<tr><td style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.4;color:#999999;max-width:600px">${esc(c.disclaimer.trim()).replace(/\n/g, '<br>')}</td></tr>` : '';
  return line + disc;
}

/** E-mail HTML of the banner: the sliced images (row-major `urls`, one per cell of `rows`), each clickable area with its
 *  own link (phone, e-mail, site, address, social networks, logo, call-to-action), then the rows above. */
export function bannerHtml(rows: SliceRow[], urls: string[], cfg0: Partial<SigConfig>, p: SigPerson): string {
  const c = fullConfig(cfg0);
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const alt = esc([p.name, [c.show.role && p.role, c.show.sector && p.sector].filter(Boolean).join(' · ')].filter(Boolean).join(' — '));
  const z = 'padding:0;margin:0;line-height:0;font-size:0;mso-line-height-rule:exactly';
  let k = 0;
  const band = rows.map((r) => {
    const tds = r.cells.map((cell) => {
      const img = `<img src="${esc(urls[k] || '')}" width="${cell.w}" height="${r.h}" alt="${k === 0 ? alt : ''}" style="display:block;border:0;outline:none;width:${cell.w}px;height:${r.h}px">`; k++;
      return `<td width="${cell.w}" valign="top" style="${z}">${cell.href ? `<a href="${esc(cell.href)}" target="_blank" style="display:block;text-decoration:none">${img}</a>` : img}</td>`;
    }).join('');
    return `<tr><td style="${z}"><table cellpadding="0" cellspacing="0" border="0" width="${BANNER_W}" style="border-collapse:collapse;width:${BANNER_W}px"><tr>${tds}</tr></table></td></tr>`;
  }).join('');
  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr><td style="${z}"><table cellpadding="0" cellspacing="0" border="0" width="${BANNER_W}" style="border-collapse:collapse;width:${BANNER_W}px">${band}</table></td></tr>${bannerLinksHtml(c, p)}</table>`;
}
