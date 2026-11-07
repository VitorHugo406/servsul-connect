// Small helpers shared by the Ewwon mobile app.

export type StatusKey = 'disp' | 'reun' | 'almo' | 'ocup' | 'fora';

/** Status labels/colours from the prototype, mapped to the values stored in profiles.user_status. */
export const ST: Record<StatusKey, [string, string]> = {
  disp: ['Disponível', '#46d37b'],
  reun: ['Em reunião', '#ff8f80'],
  almo: ['Almoçando', '#ffc36b'],
  ocup: ['Não incomodar', '#ff5d5d'],
  fora: ['Fora do expediente', '#8b8b94'],
};
export const STATUS_TO_DB: Record<StatusKey, string> = { disp: 'available', reun: 'meeting', almo: 'lunch', ocup: 'busy', fora: 'away' };
export function statusFromDb(v: string | null | undefined): StatusKey {
  switch (v) {
    case 'meeting': return 'reun';
    case 'lunch': return 'almo';
    case 'busy': case 'leave': return 'ocup';
    case 'away': case 'offline': case 'vacation': return 'fora';
    default: return 'disp';
  }
}

export const pad2 = (x: number) => String(x).padStart(2, '0');
export const hm = (d = new Date()) => pad2(d.getHours()) + ':' + pad2(d.getMinutes());

/** Same rules as the prototype's EwwonUtil.fmtTime. */
export function fmtTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const n = new Date();
  const days = Math.floor((new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 864e5);
  if (days <= 0) return hm(d);
  if (days === 1) return 'Ontem';
  if (days < 7) return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.getDay()];
  return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1);
}

export function initials(name: string): string {
  return (name || '?').trim().split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?';
}

/** Stable hue (0-359) derived from an id, used for avatar backgrounds. */
export function hueOf(id: string): number {
  let h = 0;
  for (const c of id || '') h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h) % 360;
}

/** Hue of a hex colour (sector colours), falling back to the id hash. */
export function hueFromColor(color: string | null | undefined, fallback: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec((color || '').trim());
  if (!m) return hueOf(fallback);
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return hueOf(fallback);
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = Math.round(h * 60);
  return h < 0 ? h + 360 : h;
}

export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function sinceLabel(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const m = MONTHS_SHORT[d.getMonth()];
  return m.charAt(0).toUpperCase() + m.slice(1) + ' ' + d.getFullYear();
}

export function timeToHm(t?: string | null, fallback = '08:00'): string {
  if (!t) return fallback;
  return t.slice(0, 5);
}

export function relDays(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'há 1 dia';
  if (days < 7) return `há ${days} dias`;
  const w = Math.floor(days / 7);
  return w === 1 ? 'há 1 semana' : `há ${w} semanas`;
}

export const safeStore = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem('ewwon_' + key);
      return raw == null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem('ewwon_' + key, JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
  },
};

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] || 'image/png';
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
