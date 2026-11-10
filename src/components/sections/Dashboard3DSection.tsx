// Dash: a separate "system" (Painel DP 3D) shown full screen, with its own navigation. It lives in
// public/dash/painel.html and is embedded as a same-origin iframe; its flag (Sistema | Dash) sends
// `ewvon:dash-exit` to go back to the ewvon system through the shared transition.
import { useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { readableOn } from '@/lib/branding';
import { switchMode } from '@/lib/modeSwitch';

const db = supabase as any;
const ROLE: Record<string, string> = { admin: 'Administrador', supervisor: 'Supervisor', colaborador: 'Colaborador' };
const day = (v?: string | null) => (v ? String(v).slice(0, 10) : null);
const minutes = (d: Date) => d.getHours() * 60 + d.getMinutes();

/** The same company data the rest of ewvon uses: people, sectors, meeting rooms and today's bookings. */
async function loadCompanyData(companyId: string) {
  const [pr, sc, rm, bk, pt] = await Promise.all([
    db.from('profiles').select('id,name,display_name,sector_id,created_at,updated_at,birth_date,autonomy_level,is_active,profile_type').eq('company_id', companyId).neq('profile_type', 'system'),
    db.from('sectors').select('id,name').eq('company_id', companyId),
    db.from('meeting_rooms').select('id,name,capacity').eq('company_id', companyId).eq('is_active', true).order('name'),
    db.from('meeting_bookings').select('id,room_id,title,starts_at,ends_at,booked_by').eq('company_id', companyId).gte('ends_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()).lte('starts_at', new Date(new Date().setHours(23, 59, 59, 999)).toISOString()),
    db.from('meeting_booking_participants').select('booking_id,profile_id'),
  ]);
  const people: any[] = pr.data || [];
  const sectors = new Map<string, string>(((sc.data || []) as any[]).map((x) => [x.id, x.name]));
  const byId = new Map<string, any>(people.map((p) => [p.id, p]));
  const nameOf = (p: any) => p?.display_name || p?.name || '';
  const emps = people.map((p) => ({
    nome: nameOf(p), depto: sectors.get(p.sector_id) || 'Sem setor', cargo: ROLE[p.autonomy_level] || 'Colaborador',
    adm: day(p.created_at), dem: p.is_active ? null : day(p.updated_at), nasc: day(p.birth_date),
  }));
  const parts = new Map<string, number>();
  ((pt.data || []) as any[]).forEach((x) => parts.set(x.booking_id, (parts.get(x.booking_id) || 0) + 1));
  const rooms = ((rm.data || []) as any[]).map((r) => ({
    name: r.name, cap: r.capacity,
    meets: ((bk.data || []) as any[]).filter((b) => b.room_id === r.id).map((b) => {
      const a = new Date(b.starts_at), z = new Date(b.ends_at);
      return { ini: minutes(a), fim: minutes(z), assunto: b.title || 'Reunião', resp: nameOf(byId.get(b.booked_by)).split(' ')[0], n: parts.get(b.id) || 0 };
    }),
  }));
  return { emps, rooms };
}

export function Dashboard3DSection({ onExit }: { onExit: () => void }) {
  const { profile } = useAuth();
  const frame = useRef<HTMLIFrameElement>(null);
  const last = useRef('');
  const companyId = (profile as any)?.company_id as string | undefined;
  const src = useMemo(() => {
    const css = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();   // "h s% l%"
    const m = css.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/);
    let hex = '#FF6A1A';
    if (m) { const h = +m[1], s = +m[2] / 100, l = +m[3] / 100; const a = s * Math.min(l, 1 - l); const f = (n: number) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); }; hex = `#${f(0)}${f(8)}${f(4)}`; }
    const fg = readableOn(hex);
    return `/dash/painel.html?c=${encodeURIComponent(hex)}&fg=${encodeURIComponent(fg)}`;
  }, []);
  useEffect(() => {
    let alive = true;
    const send = async (force = false) => {
      if (!companyId) return;
      try {
        const data = await loadCompanyData(companyId);
        const sig = JSON.stringify(data);
        if (!alive || (!force && sig === last.current)) return;
        last.current = sig;
        frame.current?.contentWindow?.postMessage({ type: 'ewvon:dash-data', ...data }, location.origin);
      } catch { /* the Dash keeps what it already shows */ }
    };
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin) return;
      if (e.data?.type === 'ewvon:dash-exit') switchMode('system', onExit);
      if (e.data?.type === 'ewvon:dash-ready') void send(true);
    };
    window.addEventListener('message', on);
    const t = window.setInterval(() => void send(), 60000);   // picks up new people, sectors and bookings without reloading
    return () => { alive = false; window.removeEventListener('message', on); window.clearInterval(t); };
  }, [onExit, companyId]);
  return <iframe ref={frame} title="Dash" src={src} className="fixed inset-0 z-40 h-full w-full border-0 bg-[#E8EDF2]" allow="fullscreen" data-company={profile?.company_id || ''} />;
}
