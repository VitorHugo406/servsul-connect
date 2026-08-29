import brandLogo from '@/assets/nuvexa-logo.png';

export const BRAND_LOGO_URL = brandLogo;
export const BRAND_PRIMARY = '#3D2FD6';
export const BRAND_SECONDARY = '#12C2F0';
const COMPANY_CACHE_PREFIX = 'nuvexa:company:';
const LAST_COMPANY_KEY = 'nuvexa:last-company';
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

export function applyBrand(colors: BrandColors | null) {
  const root = document.documentElement;
  const primary = colors?.primary_color || NEUTRAL_PRIMARY;
  const secondary = colors?.secondary_color || NEUTRAL_SECONDARY;
  const p = hexToHslTuple(primary); const s = hexToHslTuple(secondary);
  root.style.setProperty('--company-hue', String(p.h)); root.style.setProperty('--brand', `hsl(${p.h} ${p.s}% ${p.l}%)`); root.style.setProperty('--brand-2', `hsl(${s.h} ${s.s}% ${s.l}%)`); root.style.setProperty('--brand-dark', `hsl(${p.h} ${Math.min(70, p.s + 5)}% ${Math.max(14, p.l - 30)}%)`); root.style.setProperty('--brand-glow', `hsla(${p.h}, 75%, 55%, 0.35)`); root.style.setProperty('--brand-glow-soft', `hsla(${p.h}, 75%, 55%, 0.14)`); root.style.setProperty('--primary', `${p.h} ${p.s}% ${p.l}%`); root.style.setProperty('--secondary', `${s.h} ${s.s}% ${s.l}%`); root.style.setProperty('--ring', `${p.h} ${p.s}% ${p.l}%`); root.style.setProperty('--sidebar-primary', `${s.h} ${s.s}% ${s.l}%`); root.style.setProperty('--sidebar-primary-foreground', s.l > 62 ? '222 30% 12%' : '0 0% 100%'); root.style.setProperty('--sidebar-ring', `${s.h} ${s.s}% ${s.l}%`);
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
