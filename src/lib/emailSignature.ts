// E-mail signatures: a company "visual" (SigConfig, saved in email_signature_templates.config) + the person's data
// become email-safe HTML (tables + inline styles only, web-safe fonts, images from public URLs) that the person copies
// into Gmail/Outlook. Nothing here talks to an e-mail provider.
import { supabase } from '@/integrations/supabase/client';
import { getCompanyLogoPathFromValue } from '@/lib/companyLogo';

export type SigLayout = 'left' | 'right' | 'top' | 'bottom' | 'none';
export type SigStyle = 'classic' | 'diagonal' | 'arcs' | 'darkpanel' | 'ring' | 'cta' | 'wave' | 'hexagon' | 'triangles' | 'corp-light' | 'corp-color' | 'corp-dark';
export type SigWatermark = { kind: 'none' | 'logo' | 'image' | 'text'; src: string; text: string; pos: 'center' | 'left' | 'right' | 'full'; opacity: number; size: number };
export type SigConfig = {
  style: SigStyle;
  color2: string;
  bgColor: string;
  photoShape: 'circle' | 'hexagon' | 'rounded';
  watermark: SigWatermark;
  cta: { text: string; button: string; url: string };
  textLinks: boolean;
  layout: SigLayout;
  logoUrl: string;
  logoWidth: number;
  logoShape: 'original' | 'rounded' | 'circle';
  photo: boolean;
  color: string;
  textColor: string;
  font: string;
  size: number;
  divider: 'line' | 'bar' | 'none';
  nameStyle: 'bold' | 'upper';
  show: { role: boolean; sector: boolean; phone: boolean; mobile: boolean; email: boolean; website: boolean; address: boolean };
  website: string;
  address: string;
  slogan: string;
  disclaimer: string;
  social: { linkedin: string; instagram: string; facebook: string; youtube: string; whatsapp: string };
};
export type SigPerson = { name: string; role?: string; sector?: string; phone?: string; mobile?: string; email?: string; photo?: string | null };
export type SigTemplate = { id: string; name: string; config: Partial<SigConfig>; is_default: boolean; updated_at?: string };

export const SIG_FONTS: [string, string][] = [
  ['Arial, Helvetica, sans-serif', 'Arial'], ['Helvetica, Arial, sans-serif', 'Helvetica'], ['Verdana, Geneva, sans-serif', 'Verdana'],
  ['Tahoma, Geneva, sans-serif', 'Tahoma'], ["'Trebuchet MS', Arial, sans-serif", 'Trebuchet MS'], ['Georgia, serif', 'Georgia'],
  ["'Times New Roman', Times, serif", 'Times New Roman'],
];
export const SIG_LAYOUTS: [SigLayout, string][] = [['left', 'Logo à esquerda'], ['right', 'Logo à direita'], ['top', 'Logo em cima'], ['bottom', 'Logo embaixo'], ['none', 'Sem logo']];

export const SIG_STYLES: [SigStyle, string][] = [
  ['classic', 'Clássico (texto)'], ['diagonal', 'Diagonal'], ['arcs', 'Arcos'], ['darkpanel', 'Painel escuro'], ['ring', 'Anel'],
  ['cta', 'Com chamada (botão)'], ['wave', 'Onda lateral'], ['hexagon', 'Hexágono'], ['triangles', 'Triângulos'],
  ['corp-light', 'Corporativo claro'], ['corp-color', 'Corporativo na cor'], ['corp-dark', 'Corporativo escuro'],
];
export const DEFAULT_SIG: SigConfig = {
  style: 'diagonal', color2: '#F5B800', bgColor: '#ffffff', photoShape: 'circle',
  watermark: { kind: 'none', src: '', text: '', pos: 'center', opacity: 0.08, size: 70 },
  cta: { text: 'Quer saber mais?', button: 'Agende uma conversa', url: '' },
  textLinks: true,
  layout: 'left', logoUrl: '', logoWidth: 110, logoShape: 'original', photo: true, color: '#2358C3', textColor: '#333333',
  font: SIG_FONTS[0][0], size: 13, divider: 'bar', nameStyle: 'bold',
  show: { role: true, sector: true, phone: true, mobile: true, email: true, website: true, address: false },
  website: '', address: '', slogan: '', disclaimer: '',
  social: { linkedin: '', instagram: '', facebook: '', youtube: '', whatsapp: '' },
};

export function fullConfig(c?: Partial<SigConfig> | null): SigConfig {
  const x = (c || {}) as Partial<SigConfig>;
  // visuals saved before the image styles existed keep the text (classic) look
  const style = x.style || (Object.keys(x).length ? 'classic' : DEFAULT_SIG.style);
  return { ...DEFAULT_SIG, ...x, style, show: { ...DEFAULT_SIG.show, ...(x.show || {}) }, social: { ...DEFAULT_SIG.social, ...(x.social || {}) },
    watermark: { ...DEFAULT_SIG.watermark, ...(x.watermark || {}) }, cta: { ...DEFAULT_SIG.cta, ...(x.cta || {}) } };
}

/** "#rrggbb" from a hex or an "H S% L%" theme value (the company colour is stored either way). */
export function toHex(c: string | null | undefined, fallback = '#2358C3'): string {
  const v = (c || '').trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return v.length === 4 ? '#' + [...v.slice(1)].map((d) => d + d).join('') : v.toLowerCase();
  const m = v.replace(/hsl\(|\)/g, '').match(/^(-?[\d.]+)(?:deg)?[ ,]+([\d.]+)%[ ,]+([\d.]+)%$/);
  if (!m) return fallback;
  const h = ((+m[1] % 360) + 360) % 360, s = +m[2] / 100, l = +m[3] / 100;
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, '0');
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function companyLogoPublicUrl(value: string | null | undefined): string {
  const path = getCompanyLogoPathFromValue(value);
  if (!path) return /^https:\/\//i.test(value || '') ? (value as string) : '';
  return supabase.storage.from('company-logos').getPublicUrl(path).data.publicUrl;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const safeUrl = (u: string) => { const v = u.trim(); if (!v) return ''; const full = /^https?:\/\//i.test(v) ? v : `https://${v}`; try { const x = new URL(full); return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : ''; } catch { return ''; } };
export const digits = (s: string) => s.replace(/[^\d+]/g, '');
export const hostOf = (u: string) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return u; } };

/** Email-safe HTML of the signature. */
export function renderSignature(cfg0: Partial<SigConfig>, p: SigPerson): string {
  const c = fullConfig(cfg0);
  const color = toHex(c.color), text = toHex(c.textColor, '#333333'), muted = '#777777';
  const base = `font-family:${c.font};font-size:${c.size}px;line-height:1.45;color:${text}`;
  const link = (href: string, label: string) => `<a href="${esc(href)}" style="color:${color};text-decoration:none">${esc(label)}</a>`;
  const lines: string[] = [];
  const name = (p.name || '').trim() || 'Seu nome';
  lines.push(`<div style="font-size:${c.size + 3}px;font-weight:bold;color:${color};${c.nameStyle === 'upper' ? 'text-transform:uppercase;letter-spacing:0.5px;' : ''}">${esc(name)}</div>`);
  const sub = [c.show.role && p.role, c.show.sector && p.sector].filter(Boolean) as string[];
  if (sub.length) lines.push(`<div style="color:${muted}">${esc(sub.join(' · '))}</div>`);
  if (c.divider === 'line') lines.push(`<div style="border-top:1px solid ${color};margin:6px 0;width:180px;font-size:0;line-height:0">&nbsp;</div>`);
  else lines.push(`<div style="height:6px;font-size:0;line-height:0">&nbsp;</div>`);
  const contact: string[] = [];
  if (c.show.phone && p.phone) contact.push(`<span style="color:${color};font-weight:bold">T</span>&nbsp;${link(`tel:${digits(p.phone)}`, p.phone)}`);
  if (c.show.mobile && p.mobile) contact.push(`<span style="color:${color};font-weight:bold">C</span>&nbsp;${link(`tel:${digits(p.mobile)}`, p.mobile)}`);
  if (contact.length) lines.push(`<div>${contact.join('&nbsp;&nbsp;&nbsp;')}</div>`);
  if (c.show.email && p.email) lines.push(`<div>${link(`mailto:${p.email}`, p.email)}</div>`);
  const site = safeUrl(c.website);
  if (c.show.website && site) lines.push(`<div>${link(site, hostOf(site))}</div>`);
  if (c.show.address && c.address.trim()) lines.push(`<div style="color:${muted}">${esc(c.address.trim())}</div>`);
  const socials = (Object.entries(c.social) as [string, string][]).map(([k, v]) => {
    const label = { linkedin: 'LinkedIn', instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', whatsapp: 'WhatsApp' }[k] || k;
    const href = k === 'whatsapp' ? (digits(v) ? `https://wa.me/${digits(v).replace(/^\+/, '')}` : '') : safeUrl(v);
    return href ? link(href, label) : '';
  }).filter(Boolean);
  if (socials.length) lines.push(`<div style="margin-top:4px;font-size:${Math.max(11, c.size - 1)}px">${socials.join(`<span style="color:#bbbbbb">&nbsp;·&nbsp;</span>`)}</div>`);
  if (c.slogan.trim()) lines.push(`<div style="margin-top:4px;font-style:italic;color:${muted}">${esc(c.slogan.trim())}</div>`);
  const textCell = lines.join('');

  const radius = c.logoShape === 'circle' ? '50%' : c.logoShape === 'rounded' ? '10px' : '0';
  const logo = c.layout !== 'none' && c.logoUrl
    ? `<img src="${esc(c.logoUrl)}" width="${c.logoWidth}" alt="" style="display:block;border:0;max-width:${c.logoWidth}px;height:auto;border-radius:${radius}">` : '';
  const photo = c.photo && p.photo ? `<img src="${esc(p.photo)}" width="64" height="64" alt="" style="display:block;border:0;width:64px;height:64px;border-radius:50%;object-fit:cover">` : '';
  const bar = c.divider === 'bar' ? `border-left:2px solid ${color};` : '';
  const barR = c.divider === 'bar' ? `border-right:2px solid ${color};` : '';
  const td = (inner: string, style = '') => `<td valign="middle" style="${style}">${inner}</td>`;

  let body = '';
  if (logo && (c.layout === 'left' || c.layout === 'right')) {
    const logoTd = td(logo, c.layout === 'left' ? 'padding-right:14px' : 'padding-left:14px');
    const photoTd = photo ? td(photo, 'padding-right:12px') : '';
    const txtTd = td(textCell, c.layout === 'left' ? `${bar}padding-left:14px` : `${barR}padding-right:14px`);
    body = `<tr>${c.layout === 'left' ? logoTd + photoTd + txtTd : photoTd + txtTd + logoTd}</tr>`;
  } else {
    const row = `<tr>${photo ? td(photo, 'padding-right:12px') : ''}${td(textCell, c.divider === 'bar' ? `${bar}padding-left:12px` : '')}</tr>`;
    const inner = `<table cellpadding="0" cellspacing="0" border="0" style="${base}">${row}</table>`;
    const logoRow = logo ? `<tr><td style="${c.layout === 'top' ? 'padding-bottom:10px' : 'padding-top:10px'}">${logo}</td></tr>` : '';
    body = c.layout === 'top' ? `${logoRow}<tr><td>${inner}</td></tr>` : `<tr><td>${inner}</td></tr>${logoRow}`;
  }
  const disc = c.disclaimer.trim()
    ? `<tr><td colspan="4" style="padding-top:10px;font-size:10px;line-height:1.4;color:#999999;max-width:520px">${esc(c.disclaimer.trim()).replace(/\n/g, '<br>')}</td></tr>` : '';
  return `<table cellpadding="0" cellspacing="0" border="0" style="${base};border-collapse:collapse">${body}${disc}</table>`;
}

/** Plain-text version (clipboard fallback and mail apps without HTML signatures). */
export function signatureText(cfg0: Partial<SigConfig>, p: SigPerson): string {
  const c = fullConfig(cfg0);
  const out = [p.name || ''];
  const sub = [c.show.role && p.role, c.show.sector && p.sector].filter(Boolean).join(' · ');
  if (sub) out.push(sub);
  if (c.show.phone && p.phone) out.push(`T ${p.phone}`);
  if (c.show.mobile && p.mobile) out.push(`C ${p.mobile}`);
  if (c.show.email && p.email) out.push(p.email);
  const site = safeUrl(c.website); if (c.show.website && site) out.push(site);
  if (c.show.address && c.address.trim()) out.push(c.address.trim());
  if (c.slogan.trim()) out.push(c.slogan.trim());
  if (c.disclaimer.trim()) out.push('', c.disclaimer.trim());
  return out.filter((l, i) => l || i > 0).join('\n');
}

/** Copies the rendered signature as rich text (so pasting in Gmail/Outlook keeps the layout). */
export async function copyRich(html: string, text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && 'write' in navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
      return true;
    }
  } catch { /* fall back below */ }
  const div = document.createElement('div');
  div.contentEditable = 'true'; div.innerHTML = html;
  Object.assign(div.style, { position: 'fixed', left: '-9999px', top: '0' });
  document.body.appendChild(div);
  const r = document.createRange(); r.selectNodeContents(div);
  const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r);
  let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
  s?.removeAllRanges(); div.remove();
  return ok;
}
