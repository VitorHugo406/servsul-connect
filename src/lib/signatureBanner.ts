// Image signatures: the designed styles (diagonal, arcs, dark panel, ring, call-to-action, wave, hexagon, triangles,
// corporate light/colour/dark) are drawn on a canvas at 2x and used in the e-mail as ONE PNG (the only way shapes,
// arcs and a watermark look the same in Gmail and Outlook), followed by a small text line with clickable contacts.
// Logical size 600 x 200 (230 with a call-to-action, 170 corporate). Images come from public buckets (CORS ok).
import { fullConfig, hostOf, safeUrl, toHex, type SigConfig, type SigPerson, type SigStyle } from '@/lib/emailSignature';

type Node = [string, Record<string, string>];
const ICONS: Record<string, Node[]> = {"phone":[["path",{"d":"M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"}]],"mail":[["rect",{"width":"20","height":"16","x":"2","y":"4","rx":"2"}],["path",{"d":"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"}]],"globe":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"}],["path",{"d":"M2 12h20"}]],"map-pin":[["path",{"d":"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"}],["circle",{"cx":"12","cy":"10","r":"3"}]],"smartphone":[["rect",{"width":"14","height":"20","x":"5","y":"2","rx":"2","ry":"2"}],["path",{"d":"M12 18h.01"}]],"linkedin":[["path",{"d":"M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"}],["rect",{"width":"4","height":"12","x":"2","y":"9"}],["circle",{"cx":"4","cy":"4","r":"2"}]],"instagram":[["rect",{"width":"20","height":"20","x":"2","y":"2","rx":"5","ry":"5"}],["path",{"d":"M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"}],["line",{"x1":"17.5","x2":"17.51","y1":"6.5","y2":"6.5"}]],"facebook":[["path",{"d":"M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"}]],"youtube":[["path",{"d":"M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"}],["path",{"d":"m10 15 5-3-5-3z"}]],"message-circle":[["path",{"d":"M7.9 20A9 9 0 1 0 4 16.1L2 22Z"}]]};
const F = "SigPoppins, 'Poppins', Arial, sans-serif";
export const BANNER_W = 600;
export const isBannerStyle = (s: SigStyle) => s !== 'classic';
export const bannerHeight = (s: SigStyle) => (s === 'cta' ? 230 : s.startsWith('corp') ? 170 : 200);

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

type Ctx = CanvasRenderingContext2D;
type D = { c: SigConfig; p: SigPerson; a: BannerAssets; company: string; W: number; H: number; P: string; S: string; T: string; M: string; BG: string };

// ── primitives
const poly = (x: Ctx, pts: number[][], fill: string | CanvasGradient) => { x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.fillStyle = fill; x.fill(); };
const rr = (x: Ctx, X: number, Y: number, w: number, h: number, r: number) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
const hexPath = (x: Ctx, cx: number, cy: number, r: number) => { x.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a); if (i) x.lineTo(px, py); else x.moveTo(px, py); } x.closePath(); };
const alpha = (hex: string, a: number) => { const h = toHex(hex).slice(1); return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`; };
const shade = (hex: string, k: number) => { const h = toHex(hex).slice(1); const f = (i: number) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0'); return `#${f(0)}${f(2)}${f(4)}`; };
const lum = (hex: string) => { const h = toHex(hex).slice(1); return (0.299 * parseInt(h.slice(0, 2), 16) + 0.587 * parseInt(h.slice(2, 4), 16) + 0.114 * parseInt(h.slice(4, 6), 16)) / 255; };
const onColor = (hex: string) => (lum(hex) > 0.62 ? '#1f2326' : '#ffffff');
function fit(x: Ctx, s: string, maxW: number) { if (x.measureText(s).width <= maxW) return s; let t = s; while (t.length > 1 && x.measureText(t + '…').width > maxW) t = t.slice(0, -1); return t + '…'; }
function txt(x: Ctx, s: string, X: number, Y: number, o: { size?: number; weight?: number; color?: string; align?: CanvasTextAlign; maxW?: number; ls?: number; upper?: boolean } = {}) {
  if (!s) return 0;
  x.font = `${o.weight || 400} ${o.size || 12}px ${F}`; x.fillStyle = o.color || '#222'; x.textAlign = o.align || 'left'; x.textBaseline = 'alphabetic';
  const anyX = x as Ctx & { letterSpacing?: string };
  if (o.ls) anyX.letterSpacing = `${o.ls}px`;
  const t = o.maxW ? fit(x, o.upper ? s.toUpperCase() : s, o.maxW) : (o.upper ? s.toUpperCase() : s);
  x.fillText(t, X, Y);
  const w = x.measureText(t).width;
  if (o.ls) anyX.letterSpacing = '0px';
  return w;
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
/** icon inside a filled badge (circle / hexagon / rounded square) or bare */
function badge(x: Ctx, name: string, cx: number, cy: number, r: number, bg: string | null, fg: string, shape: 'circle' | 'hex' | 'square' | 'outline' = 'circle') {
  if (bg) {
    if (shape === 'hex') hexPath(x, cx, cy, r + 1); else if (shape === 'square') rr(x, cx - r, cy - r, r * 2, r * 2, 3); else { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); }
    if (shape === 'outline') { x.strokeStyle = bg; x.lineWidth = 1.2; x.stroke(); } else { x.fillStyle = bg; x.fill(); }
  }
  const s = r * 1.15; icon(x, name, cx - s / 2, cy - s / 2, s, fg, 2.2);
}
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
function photo(x: Ctx, d: D, cx: number, cy: number, r: number, ring?: { color: string; width: number }) {
  if (!d.c.photo && !d.a.photo) { /* the style still shows a portrait spot with initials when the visual asks for a photo */ }
  const shape = d.c.photoShape;
  const clip = () => { if (shape === 'hexagon') hexPath(x, cx, cy, r); else if (shape === 'rounded') rr(x, cx - r, cy - r, r * 2, r * 2, r * 0.28); else { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); } };
  if (ring) { x.save(); clip(); x.lineWidth = ring.width * 2; x.strokeStyle = ring.color; x.stroke(); x.restore(); }
  x.save(); clip(); x.clip();
  const img = d.c.photo ? d.a.photo : null;
  if (img) { const k = Math.max((2 * r) / img.width, (2 * r) / img.height); const w = img.width * k, h = img.height * k; x.drawImage(img, cx - w / 2, cy - h / 2, w, h); }
  else if (d.c.photo) { x.fillStyle = shade(d.P, 0.85); x.fillRect(cx - r, cy - r, 2 * r, 2 * r); txt(x, initials(d.p.name), cx, cy + r * 0.22, { size: r * 0.62, weight: 700, color: '#fff', align: 'center' }); }
  else if (d.a.logo) { x.fillStyle = '#fff'; x.fillRect(cx - r, cy - r, 2 * r, 2 * r); logo(x, d, cx - r * 0.72, cy - r * 0.5, r * 1.44, r, '#fff'); }
  else { x.fillStyle = d.P; x.fillRect(cx - r, cy - r, 2 * r, 2 * r); txt(x, initials(d.company), cx, cy + r * 0.22, { size: r * 0.6, weight: 700, color: '#fff', align: 'center' }); }
  x.restore();
}
function logo(x: Ctx, d: D, X: number, Y: number, w: number, h: number, textColor: string) {
  const img = d.a.logo;
  if (img) { const k = Math.min(w / img.width, h / img.height); const iw = img.width * k, ih = img.height * k; x.drawImage(img, X + (w - iw) / 2, Y + (h - ih) / 2, iw, ih); return; }
  txt(x, d.company, X + w / 2, Y + h / 2 + 6, { size: 16, weight: 700, color: textColor, align: 'center', maxW: w });
}
function contacts(d: D) {
  const c = d.c, p = d.p, out: [string, string, string][] = [];
  if (c.show.phone && p.phone) out.push(['phone', p.phone, 'Telefone']);
  if (c.show.mobile && p.mobile) out.push(['smartphone', p.mobile, 'Celular']);
  if (c.show.email && p.email) out.push(['mail', p.email, 'E-mail']);
  const site = safeUrl(c.website); if (c.show.website && site) out.push(['globe', hostOf(site), 'Site']);
  if (c.show.address && c.address.trim()) out.push(['map-pin', c.address.trim(), 'Endereço']);
  return out;
}
function socials(d: D) {
  const m: [keyof SigConfig['social'], string][] = [['linkedin', 'linkedin'], ['instagram', 'instagram'], ['facebook', 'facebook'], ['youtube', 'youtube'], ['whatsapp', 'message-circle']];
  return m.filter(([k]) => d.c.social[k]?.trim()).map(([, i]) => i);
}
function socialRow(x: Ctx, d: D, cx: number, cy: number, r: number, bg: string | null, fg: string, align: 'center' | 'left' = 'center', shape: 'circle' | 'outline' | 'square' = 'circle') {
  const list = socials(d); if (!list.length) return;
  const gap = r * 2 + 6; const total = list.length * gap - 6; let X = align === 'center' ? cx - total / 2 + r : cx + r;
  for (const s of list) { badge(x, s, X, cy, r, bg, fg, shape); X += gap; }
}
function contactList(x: Ctx, d: D, X: number, Y: number, o: { cols?: number; colW?: number; rowH?: number; size?: number; r?: number; bg?: string | null; fg?: string; color?: string; shape?: 'circle' | 'hex' | 'square' | 'outline'; pill?: string; label?: boolean; max?: number }) {
  const list = contacts(d).slice(0, o.max || 6); const cols = o.cols || 1, colW = o.colW || 220, rowH = o.rowH || 18, r = o.r || 7, size = o.size || 10.5;
  list.forEach(([ic, val, lab], i) => {
    const col = cols > 1 ? i % cols : 0, row = cols > 1 ? Math.floor(i / cols) : i;
    const bx = X + col * colW, by = Y + row * rowH;
    if (o.pill) { x.font = `500 ${size}px ${F}`; const w = Math.min(colW - 8, x.measureText(val).width + r * 2 + 18); rr(x, bx - 3, by - r - 2, w, r * 2 + 4, r + 2); x.fillStyle = o.pill; x.fill(); }
    badge(x, ic, bx + r, by, r, o.bg === undefined ? d.P : o.bg, o.fg || '#fff', o.shape || 'circle');
    if (o.label) { txt(x, lab, bx + r * 2 + 7, by - 2, { size: 6.5, weight: 500, color: d.M, upper: true, ls: 0.6 }); txt(x, val, bx + r * 2 + 7, by + 8, { size, weight: 600, color: o.color || d.T, maxW: colW - r * 2 - 12 }); }
    else txt(x, val, bx + r * 2 + 7, by + size * 0.36, { size, weight: 500, color: o.color || d.T, maxW: colW - r * 2 - 12 });
  });
}
const nameOf = (d: D) => (d.p.name || '').trim() || 'Seu nome';
const roleOf = (d: D) => [d.c.show.role && d.p.role, d.c.show.sector && d.p.sector].filter(Boolean).join(' · ');
function dots(x: Ctx, X: number, Y: number, cols: number, rows: number, color: string, gap = 6, r = 1.2) { x.fillStyle = color; for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { x.beginPath(); x.arc(X + i * gap, Y + j * gap, r, 0, Math.PI * 2); x.fill(); } }

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
    for (let yy = -H; yy < H * 2; yy += stepY) for (let xx = -W * 0.5, k = 0; xx < W * 1.5; xx += stepX, k++) drawOne(xx + ((yy / stepY) % 2 ? stepX / 2 : 0), yy, h);
  } else {
    const h = H * size; const cx = w.pos === 'left' ? W * 0.2 : w.pos === 'right' ? W * 0.8 : W / 2;
    drawOne(cx, H / 2, h);
  }
  x.restore();
}

// ── styles
const STYLES: Record<Exclude<SigStyle, 'classic'>, (x: Ctx, d: D) => void> = {
  diagonal(x, d) {
    x.fillStyle = d.BG; x.fillRect(0, 0, d.W, d.H);
    poly(x, [[0, 0], [175, 0], [108, 200], [0, 200]], d.P);
    poly(x, [[175, 0], [204, 0], [137, 200], [108, 200]], d.S);
    poly(x, [[548, 0], [600, 0], [600, 52]], d.S);
    watermark(x, d);
    x.strokeStyle = alpha(d.T, 0.2); x.lineWidth = 1.2; x.beginPath(); x.moveTo(555, 186); x.lineTo(565, 170); x.lineTo(575, 186); x.closePath(); x.stroke();
    poly(x, [[330, 10], [338, 24], [322, 24]], alpha(d.T, 0.18));
    photo(x, d, 112, 100, 66, { color: '#fff', width: 5 });
    txt(x, nameOf(d), 212, 72, { size: 22, weight: 700, color: d.T, maxW: 230 });
    txt(x, roleOf(d), 212, 92, { size: 12, color: d.M, maxW: 230 });
    x.fillStyle = d.S; x.fillRect(212, 101, 44, 2.5);
    contactList(x, d, 212, 122, { cols: 2, colW: 122, rowH: 19, r: 7, size: 9.5, bg: d.P, fg: onColor(d.P), max: 6 });
    x.fillStyle = alpha(d.T, 0.25); x.fillRect(460, 58, 1.5, 86);
    logo(x, d, 474, 58, 112, 44, d.T);
    socialRow(x, d, 530, 128, 9, d.T, '#fff');
  },
  arcs(x, d) {
    x.fillStyle = d.BG; x.fillRect(0, 0, d.W, d.H);
    const g = x.createLinearGradient(0, 0, d.W, d.H); g.addColorStop(0, alpha(d.P, 0.07)); g.addColorStop(0.6, alpha(d.P, 0)); x.fillStyle = g; x.fillRect(0, 0, d.W, d.H);
    watermark(x, d);
    x.lineCap = 'round';
    x.strokeStyle = d.P; x.lineWidth = 6; x.beginPath(); x.arc(98, 100, 80, Math.PI * 0.55, Math.PI * 1.55); x.stroke();
    x.strokeStyle = alpha(d.P, 0.45); x.lineWidth = 2; x.beginPath(); x.arc(98, 100, 90, Math.PI * 0.7, Math.PI * 1.4); x.stroke();
    x.strokeStyle = d.S; x.lineWidth = 3; x.beginPath(); x.arc(98, 100, 80, Math.PI * 1.62, Math.PI * 1.85); x.stroke();
    photo(x, d, 98, 100, 64, { color: '#fff', width: 4 });
    txt(x, nameOf(d), 200, 68, { size: 21, weight: 700, color: d.P, upper: true, maxW: 240 });
    txt(x, roleOf(d), 200, 87, { size: 12, weight: 500, color: d.T, maxW: 240 });
    contactList(x, d, 200, 110, { rowH: 17, r: 7, size: 9.5, bg: d.P, fg: onColor(d.P), max: 5 });
    x.fillStyle = alpha(d.P, 0.5); x.fillRect(452, 34, 1.5, 96);
    logo(x, d, 470, 30, 112, 42, d.P);
    x.beginPath(); x.arc(600, 200, 92, Math.PI, Math.PI * 1.5); x.lineTo(600, 200); x.closePath(); x.fillStyle = shade(d.P, 0.55); x.fill();
    x.strokeStyle = d.P; x.lineWidth = 4; x.beginPath(); x.arc(600, 200, 100, Math.PI, Math.PI * 1.5); x.stroke();
    socialRow(x, d, 560, 170, 8, null, '#fff');
  },
  darkpanel(x, d) {
    x.fillStyle = d.P; x.fillRect(0, 0, d.W, d.H);
    dots(x, 18, 160, 4, 3, alpha('#ffffff', 0.35));
    poly(x, [[198, 12], [592, 12], [592, 188], [148, 188]], d.BG);
    watermark(x, d);
    dots(x, 548, 28, 5, 3, alpha(d.T, 0.25));
    rr(x, 14, 16, 104, 38, 8); x.fillStyle = '#ffffff'; x.fill(); logo(x, d, 20, 20, 92, 30, d.T);
    x.beginPath(); x.arc(170, 112, 66, 0, Math.PI * 2); x.fillStyle = shade(d.P, 0.8); x.fill();
    photo(x, d, 170, 112, 56, { color: d.BG, width: 3 });
    txt(x, nameOf(d), 254, 62, { size: 22, weight: 700, color: d.T, maxW: 320 });
    txt(x, roleOf(d), 254, 81, { size: 12, color: d.M, maxW: 320 });
    x.fillStyle = d.P; x.fillRect(254, 90, 30, 2.5);
    contactList(x, d, 258, 114, { cols: 2, colW: 162, rowH: 24, r: 7, size: 9.5, bg: d.P, fg: onColor(d.P), pill: '#eef0f3', max: 4 });
    socialRow(x, d, 254, 172, 7, null, d.T, 'left');
  },
  ring(x, d) {
    x.fillStyle = d.BG === '#ffffff' ? '#f4f5f7' : d.BG; x.fillRect(0, 0, d.W, d.H);
    x.strokeStyle = alpha(d.P, 0.6); x.lineWidth = 1.2; x.beginPath(); x.moveTo(0, 46); x.lineTo(46, 0); x.moveTo(0, 58); x.lineTo(58, 0); x.moveTo(554, 200); x.lineTo(600, 154); x.moveTo(542, 200); x.lineTo(600, 142); x.stroke();
    watermark(x, d);
    x.fillStyle = d.P; x.beginPath(); x.arc(28, 30, 10, 0, Math.PI * 2); x.fill(); x.beginPath(); x.arc(572, 170, 10, 0, Math.PI * 2); x.fill();
    dots(x, 540, 22, 5, 3, alpha(d.T, 0.3));
    x.strokeStyle = d.P; x.lineWidth = 11; x.lineCap = 'butt'; x.beginPath(); x.arc(110, 100, 72, -Math.PI * 0.15, Math.PI * 1.25); x.stroke();
    photo(x, d, 110, 100, 56);
    txt(x, nameOf(d), 200, 84, { size: 19, weight: 700, color: d.T, maxW: 130 });
    txt(x, roleOf(d), 200, 102, { size: 11, color: d.M, maxW: 130 });
    x.fillStyle = d.T; x.fillRect(340, 44, 1.6, 112); x.fillRect(470, 44, 1.6, 112);
    contactList(x, d, 352, 66, { rowH: 21, r: 7, size: 8.6, bg: d.T, fg: '#fff', max: 5 });
    logo(x, d, 484, 64, 104, 36, d.T);
    socialRow(x, d, 536, 128, 8, d.T, '#fff');
  },
  cta(x, d) {
    x.fillStyle = d.BG; x.fillRect(0, 0, d.W, d.H);
    watermark(x, d);
    photo(x, d, 74, 74, 58);
    const list = socials(d).length ? socials(d) : ['phone', 'mail', 'globe'];
    list.slice(0, 3).forEach((s, i) => badge(x, s, 166, 34 + i * 38, 14, d.P, onColor(d.P)));
    txt(x, nameOf(d), 196, 40, { size: 17, weight: 700, color: d.P, maxW: 380 });
    txt(x, roleOf(d), 196, 58, { size: 12, color: d.T, maxW: 380 });
    const cl = contacts(d).slice(0, 3); cl.forEach(([, v], i) => txt(x, v, 196, 82 + i * 17, { size: 11, color: d.T, maxW: 380 }));
    rr(x, 210, 156, 380, 62, 14); x.fillStyle = alpha(d.P, 0.28); x.fill();
    rr(x, 10, 156, 236, 62, 14); x.fillStyle = shade(d.P, 0.8); x.fill();
    const t = (d.c.cta.text || 'Quer saber mais?').toUpperCase(); const words = t.split(' '); const half = Math.ceil(words.length / 2);
    txt(x, words.slice(0, half).join(' '), 30, 183, { size: 15, weight: 700, color: '#fff', maxW: 200 });
    txt(x, words.slice(half).join(' '), 30, 203, { size: 15, weight: 700, color: '#fff', maxW: 200 });
    txt(x, (d.c.cta.button || 'Agende uma conversa').toUpperCase(), 418, 192, { size: 13, weight: 700, color: shade(d.P, 0.7), align: 'center', maxW: 300 });
  },
  wave(x, d) {
    x.fillStyle = d.BG; x.fillRect(0, 0, d.W, d.H);
    for (let i = 0; i < 6; i++) poly(x, [[330 + i * 48, 0], [354 + i * 48, 0], [254 + i * 48, 200], [230 + i * 48, 200]], alpha(d.T, 0.035));
    x.beginPath(); x.moveTo(0, 0); x.lineTo(150, 0); x.bezierCurveTo(105, 70, 200, 130, 125, 200); x.lineTo(0, 200); x.closePath(); x.fillStyle = d.P; x.fill();
    watermark(x, d);
    x.strokeStyle = alpha('#ffffff', 0.45); x.lineWidth = 1.5; x.beginPath(); x.arc(40, 152, 18, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(70, 40, 6, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.moveTo(18, 70); x.lineTo(30, 90); x.lineTo(6, 90); x.closePath(); x.stroke();
    photo(x, d, 142, 100, 62, { color: '#ffffff', width: 6 });
    x.strokeStyle = alpha(d.P, 0.5); x.lineWidth = 1.5; x.beginPath(); x.arc(142, 100, 72, 0, Math.PI * 2); x.stroke();
    txt(x, nameOf(d), 232, 70, { size: 24, weight: 700, color: d.T, maxW: 200 });
    txt(x, roleOf(d), 232, 92, { size: 13, color: alpha(d.T, 0.75), maxW: 200 });
    x.fillStyle = alpha(d.T, 0.25); x.fillRect(232, 102, 150, 1.2);
    contactList(x, d, 232, 124, { rowH: 24, r: 8, size: 10, bg: d.T, fg: '#fff', shape: 'outline', label: true, max: 3 });
    x.fillStyle = alpha(d.T, 0.3); x.fillRect(440, 40, 1.4, 120);
    logo(x, d, 462, 44, 120, 44, d.T);
    if (d.c.slogan.trim()) txt(x, d.c.slogan.trim(), 522, 112, { size: 8.5, color: d.M, align: 'center', maxW: 130 });
    socialRow(x, d, 522, 146, 8, d.T, d.T, 'center', 'outline');
  },
  hexagon(x, d) {
    x.fillStyle = d.BG; x.fillRect(0, 0, d.W, d.H);
    const gl = x.createLinearGradient(0, 0, 60, 0); gl.addColorStop(0, shade(d.P, 0.8)); gl.addColorStop(1, d.P);
    poly(x, [[0, 0], [58, 0], [18, 100], [58, 200], [0, 200]], gl);
    const gr = x.createLinearGradient(430, 0, 600, 0); gr.addColorStop(0, d.P); gr.addColorStop(1, shade(d.P, 0.75));
    poly(x, [[468, 0], [600, 0], [600, 200], [468, 200], [430, 100]], gr);
    watermark(x, d);
    logo(x, d, 66, 56, 104, 40, d.T);
    if (d.c.slogan.trim()) txt(x, d.c.slogan.trim(), 118, 114, { size: 7.5, color: d.M, align: 'center', maxW: 104, upper: true });
    [0.5, 0.7, 0.85, 1].forEach((a, i) => { x.fillStyle = alpha(d.P, a); x.beginPath(); x.arc(98 + i * 13, 130, 4, 0, Math.PI * 2); x.fill(); });
    x.fillStyle = alpha(d.T, 0.35); x.fillRect(186, 44, 1.4, 112);
    const n = nameOf(d).split(' '); const first = n[0] || '', rest = n.slice(1).join(' ');
    const w1 = txt(x, first.toUpperCase(), 202, 66, { size: 21, weight: 700, color: d.P });
    txt(x, rest.toUpperCase(), 202 + w1 + 6, 66, { size: 21, weight: 400, color: d.P, maxW: 200 });
    txt(x, roleOf(d), 202, 84, { size: 11, color: d.M, maxW: 220 });
    x.fillStyle = alpha(d.T, 0.25); x.fillRect(202, 92, 120, 1);
    contactList(x, d, 204, 112, { rowH: 21, r: 8, size: 9.5, bg: d.P, fg: onColor(d.P), shape: 'hex', max: 4 });
    hexPath(x, 516, 100, 84); x.strokeStyle = alpha('#ffffff', 0.85); x.lineWidth = 2; x.stroke();
    hexPath(x, 516, 100, 76); x.fillStyle = '#ffffff'; x.fill();
    const saved = d.c.photoShape; d.c.photoShape = 'hexagon'; photo(x, d, 516, 100, 70); d.c.photoShape = saved;
  },
  triangles(x, d) {
    x.fillStyle = d.BG; x.fillRect(0, 0, d.W, d.H);
    poly(x, [[0, 0], [96, 0], [0, 150]], d.S);
    poly(x, [[0, 150], [0, 200], [70, 200]], d.T);
    poly(x, [[96, 0], [120, 0], [0, 188], [0, 150]], d.T);
    watermark(x, d);
    poly(x, [[286, 6], [314, 6], [300, 22]], d.T);
    x.strokeStyle = d.T; x.lineWidth = 1.4; x.beginPath(); x.moveTo(530, 186); x.lineTo(546, 168); x.lineTo(562, 186); x.closePath(); x.stroke();
    x.strokeStyle = d.S; x.lineWidth = 3; x.beginPath(); x.moveTo(566, 56); x.lineTo(600, 100); x.lineTo(566, 144); x.stroke();
    x.beginPath(); x.arc(98, 102, 68, 0, Math.PI * 2); x.strokeStyle = d.S; x.lineWidth = 5; x.stroke();
    photo(x, d, 98, 102, 60);
    txt(x, nameOf(d), 190, 64, { size: 22, weight: 700, color: d.S, maxW: 250 });
    const rw = txt(x, roleOf(d), 190, 84, { size: 12, color: d.T, maxW: 250 });
    x.fillStyle = d.T; x.fillRect(190, 88, Math.min(rw, 90), 1.4);
    contactList(x, d, 190, 112, { cols: 2, colW: 136, rowH: 21, r: 8, size: 9.5, bg: d.S, fg: onColor(d.S), max: 6 });
    x.fillStyle = d.S; x.fillRect(470, 48, 2, 104); x.fillRect(476, 48, 2, 104);
    logo(x, d, 490, 58, 96, 40, d.T);
    socialRow(x, d, 538, 126, 8, d.T, '#fff');
  },
  'corp-light'(x, d) { corporate(x, d, 'light'); },
  'corp-color'(x, d) { corporate(x, d, 'color'); },
  'corp-dark'(x, d) { corporate(x, d, 'dark'); },
};
function corporate(x: Ctx, d: D, v: 'light' | 'color' | 'dark') {
  const bg = v === 'light' ? (d.BG === '#ffffff' ? '#eef1f3' : d.BG) : v === 'color' ? d.P : '#1f2326';
  const ink = v === 'light' ? d.T : '#ffffff'; const acc = v === 'light' ? d.P : v === 'color' ? '#ffffff' : d.P;
  x.fillStyle = bg; x.fillRect(0, 0, d.W, d.H);
  watermark(x, { ...d, T: ink });
  x.fillStyle = alpha(ink, 0.35); x.fillRect(572, 0, 28, 46); x.fillStyle = v === 'color' ? shade(d.P, 0.65) : acc; x.fillRect(584, 46, 16, 124);
  if (v !== 'light') { rr(x, 22, 26, 136, 60, 10); x.fillStyle = '#ffffff'; x.fill(); }
  logo(x, d, 30, 30, 120, 52, v === 'light' ? ink : '#1f2326');
  txt(x, d.company.toUpperCase(), 90, 110, { size: 12, weight: 700, color: ink, align: 'center', maxW: 160 });
  if (d.c.slogan.trim()) txt(x, d.c.slogan.trim(), 90, 124, { size: 6.5, color: alpha(ink, 0.7), align: 'center', maxW: 160, upper: true, ls: 0.5 });
  x.fillStyle = acc; x.fillRect(188, 26, 3, 118);
  const n = nameOf(d).split(' '); const first = n[0] || '', rest = n.slice(1).join(' ');
  const w1 = txt(x, first.toUpperCase(), 208, 54, { size: 24, weight: 400, color: ink });
  txt(x, rest.toUpperCase(), 208 + w1 + 8, 54, { size: 24, weight: 700, color: ink, maxW: 330 - w1 });
  txt(x, roleOf(d), 210, 72, { size: 9.5, weight: 500, color: v === 'light' ? acc : alpha(ink, 0.85), upper: true, ls: 2.2, maxW: 340 });
  contactList(x, d, 210, 102, { cols: 2, colW: 178, rowH: 19, r: 7, size: 9.5, bg: null, fg: acc, color: ink, max: 6 });
}

/** Draws the banner into the canvas (2x for sharp text). Returns false for the classic (text) style. */
export function drawBanner(canvas: HTMLCanvasElement, cfg0: Partial<SigConfig>, p: SigPerson, a: BannerAssets, company: string): boolean {
  const c = fullConfig(cfg0); if (!isBannerStyle(c.style)) return false;
  const W = BANNER_W, H = bannerHeight(c.style), k = 2;
  canvas.width = W * k; canvas.height = H * k;
  const x = canvas.getContext('2d'); if (!x) return false;
  x.setTransform(k, 0, 0, k, 0, 0); x.clearRect(0, 0, W, H);
  const d: D = { c, p, a, company: company || 'Empresa', W, H, P: toHex(c.color), S: toHex(c.color2, '#F5B800'), T: toHex(c.textColor, '#333333'), M: '#6b7280', BG: toHex(c.bgColor, '#ffffff') };
  STYLES[c.style as Exclude<SigStyle, 'classic'>](x, d);
  return true;
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
    if (c.style === 'cta' && safeUrl(c.cta.url)) bits.push(link(safeUrl(c.cta.url), c.cta.button || 'Agendar'));
  }
  const line = bits.length ? `<tr><td style="padding-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#666666">${bits.join('&nbsp;&nbsp;·&nbsp;&nbsp;')}</td></tr>` : '';
  const disc = c.disclaimer.trim() ? `<tr><td style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.4;color:#999999;max-width:600px">${esc(c.disclaimer.trim()).replace(/\n/g, '<br>')}</td></tr>` : '';
  return line + disc;
}

/** E-mail HTML around the uploaded banner: the image (linked to the site or the call-to-action) + the rows above. */
export function bannerHtml(url: string, cfg0: Partial<SigConfig>, p: SigPerson): string {
  const c = fullConfig(cfg0); const H = bannerHeight(c.style);
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const href = (c.style === 'cta' && safeUrl(c.cta.url)) || safeUrl(c.website);
  const alt = esc([p.name, [c.show.role && p.role, c.show.sector && p.sector].filter(Boolean).join(' · ')].filter(Boolean).join(' — '));
  const img = `<img src="${esc(url)}" width="${BANNER_W}" height="${H}" alt="${alt}" style="display:block;border:0;width:${BANNER_W}px;max-width:100%;height:auto">`;
  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr><td>${href ? `<a href="${esc(href)}">${img}</a>` : img}</td></tr>${bannerLinksHtml(c, p)}</table>`;
}
