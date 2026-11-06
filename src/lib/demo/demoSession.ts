// Demo (test) session: 3h, desktop only, all data in localStorage under a private prefix.
export const DEMO_FLAG_KEY = 'nuvexa:demo:session';
export const DEMO_DATA_PREFIX = 'nuvexa:demo:data:';
export const DEMO_DURATION_MS = 3 * 60 * 60 * 1000;

export interface DemoSession { startedAt: number; expiresAt: number; userId: string; profileId: string; companyId: string; }

export function readDemoSession(now = Date.now()): DemoSession | null {
  try {
    const raw = localStorage.getItem(DEMO_FLAG_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as DemoSession;
    if (!s?.expiresAt || s.expiresAt <= now) return null;
    return s;
  } catch { return null; }
}

export function isDemoExpired(now = Date.now()): boolean {
  try { const raw = localStorage.getItem(DEMO_FLAG_KEY); if (!raw) return false; return JSON.parse(raw).expiresAt <= now; } catch { return false; }
}

export function clearDemoData() {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && (k.startsWith(DEMO_DATA_PREFIX) || k === DEMO_FLAG_KEY)) keys.push(k); }
  keys.forEach(k => localStorage.removeItem(k));
}

export function startDemoSession(now = Date.now()): DemoSession {
  clearDemoData();
  const s: DemoSession = { startedAt: now, expiresAt: now + DEMO_DURATION_MS, userId: crypto.randomUUID(), profileId: crypto.randomUUID(), companyId: crypto.randomUUID() };
  localStorage.setItem(DEMO_FLAG_KEY, JSON.stringify(s));
  localStorage.setItem(`ewvor_onboarding_completed_${s.userId}`, 'true');
  return s;
}

export function endDemoSession(message = 'expired') {
  clearDemoData();
  window.location.href = `/?demo=${message}`;
}

export function formatRemaining(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}
