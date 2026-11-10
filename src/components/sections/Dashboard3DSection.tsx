// Dash: a separate "system" (Painel DP 3D) shown full screen, with its own navigation. It lives in
// public/dash/painel.html and is embedded as a same-origin iframe; its flag (Sistema | Dash) sends
// `ewvon:dash-exit` to go back to the ewvon system through the shared transition.
import { useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { readableOn } from '@/lib/branding';
import { switchMode } from '@/lib/modeSwitch';

export function Dashboard3DSection({ onExit }: { onExit: () => void }) {
  const { profile } = useAuth();
  const src = useMemo(() => {
    const css = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();   // "h s% l%"
    const m = css.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/);
    let hex = '#FF6A1A';
    if (m) { const h = +m[1], s = +m[2] / 100, l = +m[3] / 100; const a = s * Math.min(l, 1 - l); const f = (n: number) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); }; hex = `#${f(0)}${f(8)}${f(4)}`; }
    const fg = readableOn(hex);
    return `/dash/painel.html?c=${encodeURIComponent(hex)}&fg=${encodeURIComponent(fg)}`;
  }, []);
  useEffect(() => {
    const on = (e: MessageEvent) => { if (e.origin === location.origin && e.data?.type === 'ewvon:dash-exit') switchMode('system', onExit); };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, [onExit]);
  return <iframe title="Dash" src={src} className="fixed inset-0 z-40 h-full w-full border-0 bg-[#E8EDF2]" allow="fullscreen" data-company={profile?.company_id || ''} />;
}
