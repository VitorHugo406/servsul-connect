import vetorLogo from '@/assets/vetor-logo.png.asset.json';

export const VETOR_LOGO_URL = vetorLogo.url;
export const VETOR_PRIMARY = '#2E5AAC';
export const VETOR_SECONDARY = '#4C7DE0';

export interface BrandColors {
  primary_color: string;
  secondary_color: string;
}

function hexToHslTuple(hex: string): { h: number; s: number; l: number } {
  const clean = (hex || '').replace('#', '').trim() || '2E5AAC';
  const v = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.padEnd(6, '0');
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      case b: h = ((r - g) / d + 4); break;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function applyBrand(colors: BrandColors | null) {
  const root = document.documentElement;
  const primary = colors?.primary_color || VETOR_PRIMARY;
  const secondary = colors?.secondary_color || VETOR_SECONDARY;
  const p = hexToHslTuple(primary);
  const s = hexToHslTuple(secondary);
  root.style.setProperty('--company-hue', String(p.h));
  root.style.setProperty('--brand', `hsl(${p.h} ${p.s}% ${p.l}%)`);
  root.style.setProperty('--brand-2', `hsl(${s.h} ${s.s}% ${s.l}%)`);
  root.style.setProperty('--brand-dark', `hsl(${p.h} ${Math.min(70, p.s + 5)}% ${Math.max(14, p.l - 30)}%)`);
  root.style.setProperty('--brand-glow', `hsla(${p.h}, 75%, 55%, 0.35)`);
  root.style.setProperty('--brand-glow-soft', `hsla(${p.h}, 75%, 55%, 0.14)`);
  root.style.setProperty('--primary', `${p.h} ${p.s}% ${p.l}%`);
  root.style.setProperty('--secondary', `${s.h} ${s.s}% ${s.l}%`);
  root.style.setProperty('--ring', `${p.h} ${p.s}% ${p.l}%`);
}

export function resetBrand() {
  applyBrand({ primary_color: VETOR_PRIMARY, secondary_color: VETOR_SECONDARY });
}
