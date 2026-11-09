import brandLogo from '@/assets/ewvon-mark-dark.png';

export const BRAND_LOGO_URL = brandLogo;
export const BRAND_PRIMARY = '#3D2FD6';
export const BRAND_SECONDARY = '#12C2F0';
const COMPANY_CACHE_PREFIX = 'ewvor:company:';
const LAST_COMPANY_KEY = 'ewvor:last-company';
const NEUTRAL_PRIMARY = '#64748B';
const NEUTRAL_SECONDARY = '#94A3B8';

export interface BrandColors { primary_color: string; secondary_color: string; }

function hexToHslTuple(hex: string): { h: number; s: number; l: number } {
  const clean = (hex || '').replace('#', '').trim() || '64748B';
  const v = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0');
  const r = parseInt(v.slice(0, 2), 16) / 255; const g = parseInt(v.slice(2, 4), 16) / 255; const b = parseInt(v.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const l = (max + min) / 2; let h = 0; let s = 0;
  if (max !== min) { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min); switch (max) { case r: h = (g - b) / d + (g < b ? 6 : 0); break; case g: h = (b - r) / d + 2; break; case b: h = (r - g) / d + 4; break; } h *= 60; }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** WCAG relative luminance of a hex color (0 = black, 1 = white). */
export function luminance(hex: string): number {
  const clean = (hex || '').replace('#', '').trim();
  const v = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0');
  const ch = [0, 2, 4].map((i) => { const c = parseInt(v.slice(i, i + 2), 16) / 255; return Number.isNaN(c) ? 0 : c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
/** True when a color is light enough that white text on it is hard to read (yellow, lime, light orange, pastel…). */
export const isLightColor = (hex: string) => luminance(hex) > 0.36;
/** Readable text color for a background in the company color. */
export const readableOn = (hex: string) => (isLightColor(hex) ? '#111111' : '#ffffff');
const FG_DARK = '222 30% 10%';
const FG_LIGHT = '0 0% 100%';

export function applyBrand(colors: BrandColors | null) {
  const root = document.documentElement;
  const primary = colors?.primary_color || NEUTRAL_PRIMARY;
  const secondary = colors?.secondary_color || NEUTRAL_SECONDARY;
  const p = hexToHslTuple(primary); const s = hexToHslTuple(secondary);
  root.style.setProperty('--company-hue', String(p.h)); root.style.setProperty('--brand', `hsl(${p.h} ${p.s}% ${p.l}%)`); root.style.setProperty('--brand-2', `hsl(${s.h} ${s.s}% ${s.l}%)`); const pLight = isLightColor(primary); const sLight = isLightColor(secondary);
  // A light company color keeps its gradient light so the dark text stays readable end to end.
  root.style.setProperty('--brand-dark', pLight ? `hsl(${p.h} ${p.s}% ${Math.max(45, p.l - 12)}%)` : `hsl(${p.h} ${Math.min(70, p.s + 5)}% ${Math.max(14, p.l - 30)}%)`);
  root.style.setProperty('--primary-foreground', pLight ? FG_DARK : FG_LIGHT); root.style.setProperty('--secondary-foreground', sLight ? FG_DARK : FG_LIGHT); root.style.setProperty('--brand-foreground', pLight ? '#111111' : '#ffffff'); root.style.setProperty('--brand-glow', `hsla(${p.h}, 75%, 55%, 0.35)`); root.style.setProperty('--brand-glow-soft', `hsla(${p.h}, 75%, 55%, 0.14)`); root.style.setProperty('--primary', `${p.h} ${p.s}% ${p.l}%`); root.style.setProperty('--secondary', `${s.h} ${s.s}% ${s.l}%`); root.style.setProperty('--ring', `${p.h} ${p.s}% ${p.l}%`); root.style.setProperty('--sidebar-primary', `${s.h} ${s.s}% ${s.l}%`); root.style.setProperty('--sidebar-primary-foreground', sLight ? FG_DARK : FG_LIGHT); root.style.setProperty('--sidebar-ring', `${s.h} ${s.s}% ${s.l}%`);
}

export function getCachedBrand(): (BrandColors & { id?: string; name?: string; slug?: string; logo_url?: string | null }) | null {
  if (typeof window === 'undefined') return null;
  try {
    const lastRaw = localStorage.getItem(LAST_COMPANY_KEY);
    if (lastRaw) { const last = JSON.parse(lastRaw); if (last?.primary_color && last?.secondary_color) return last; }
  } catch {}
  return null;
}

// Do not apply an arbitrary cached company at module initialization. The
// authenticated company is resolved by AuthContext and applied with its ID.
// This prevents another company's colors from flashing during login/session hydration.

export function resetBrand() { applyBrand({ primary_color: NEUTRAL_PRIMARY, secondary_color: NEUTRAL_SECONDARY }); }
