// Dash: a separate "system" (Painel DP 3D) shown full screen, with its own navigation. It lives in
// public/dash/painel.html and is embedded as a same-origin iframe; its flag (Sistema | Dash) sends
// `ewvon:dash-exit` to go back to the ewvon system through the shared transition.
import { useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useCompanyLogoUrl } from '@/lib/companyLogo';
import { readableOn } from '@/lib/branding';
import { switchMode } from '@/lib/modeSwitch';

const db = supabase as any;
const ROLE: Record<string, string> = { admin: 'Administrador', supervisor: 'Supervisor', colaborador: 'Colaborador' };
const day = (v?: string | null) => (v ? String(v).slice(0, 10) : null);
const minutes = (d: Date) => d.getHours() * 60 + d.getMinutes();

const STATUS: Record<string, string> = { available: 'Disponível', busy: 'Ocupado', meeting: 'Em reunião', lunch: 'Almoço', away: 'Ausente', offline: 'Offline' };

/** The same company data the rest of ewvon uses: people (with status), sectors, meeting rooms and today's bookings. */
async function loadCompanyData(companyId: string, company: { name: string; logo: string }) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const [pr, sc, rm, bk, pt, pres, hrq] = await Promise.all([
    db.from('profiles').select('id,user_id,name,display_name,sector_id,created_at,updated_at,birth_date,autonomy_level,is_active,profile_type,user_status').eq('company_id', companyId).neq('profile_type', 'system').limit(2000),
    db.from('sectors').select('id,name').eq('company_id', companyId),
    db.from('meeting_rooms').select('id,name,capacity').eq('company_id', companyId).eq('is_active', true).order('name'),
    db.from('meeting_bookings').select('id,room_id,title,notes,starts_at,ends_at,booked_by').eq('company_id', companyId).gte('ends_at', start.toISOString()).lte('starts_at', end.toISOString()),
    db.from('meeting_booking_participants').select('booking_id,profile_id'),
    db.from('user_presence').select('user_id,is_online,last_heartbeat'),
    // HR / time-clock data synced by `hr-sync`. Failure or no integration = no HR data (never invented).
    db.from('hr_people_status').select('profile_id,status,clock_in,hours_bank_minutes,synced_at,source,data'),
  ]);
  const hrById = new Map<string, any>();
  ((hrq?.error ? [] : hrq?.data || []) as any[]).forEach((x) => {
    const age = x?.synced_at ? Date.now() - new Date(x.synced_at).getTime() : Infinity;
    if (!(age < 24 * 3600 * 1000)) return;                       // month totals only while fresh (< 24 h)
    const fresh = age < 15 * 60 * 1000;                          // status of the day only while fresh (< 15 min)
    hrById.set(x.profile_id, { status: fresh ? x.status ?? null : null, clockIn: fresh ? x.clock_in ?? null : null, bankMinutes: x.hours_bank_minutes ?? null, syncedAt: x.synced_at, data: x.data ?? null });
  });
  const people: any[] = pr.data || [];
  const sectors = new Map<string, string>(((sc.data || []) as any[]).map((x) => [x.id, x.name]));
  const byId = new Map<string, any>(people.map((p) => [p.id, p]));
  const online = new Set<string>(((pres.data || []) as any[]).filter((x) => x.is_online && Date.now() - new Date(x.last_heartbeat).getTime() < 150000).map((x) => x.user_id));
  const nameOf = (p: any) => p?.display_name || p?.name || '';
  const emps = people.map((p) => ({
    id: p.id, nome: nameOf(p), depto: sectors.get(p.sector_id) || 'Sem setor', cargo: ROLE[p.autonomy_level] || 'Colaborador',
    st: online.has(p.user_id) ? (STATUS[p.user_status || 'available'] || 'Online') : 'Offline',
    lunch: online.has(p.user_id) && p.user_status === 'lunch',
    adm: day(p.created_at), dem: p.is_active ? null : day(p.updated_at), nasc: day(p.birth_date),
    hr: hrById.get(p.id) ?? null,
  }));
  const parts = new Map<string, string[]>();
  ((pt.data || []) as any[]).forEach((x) => { if (byId.has(x.profile_id)) parts.set(x.booking_id, [...(parts.get(x.booking_id) || []), x.profile_id]); });
  const rooms = ((rm.data || []) as any[]).map((r) => ({
    name: r.name, cap: r.capacity,
    meets: ((bk.data || []) as any[]).filter((b) => b.room_id === r.id).map((b) => {
      const ids = [...new Set([...(b.booked_by && byId.has(b.booked_by) ? [b.booked_by] : []), ...(parts.get(b.id) || [])])];
      return { ini: minutes(new Date(b.starts_at)), fim: minutes(new Date(b.ends_at)), assunto: b.title || 'Reunião', desc: b.notes || '', resp: nameOf(byId.get(b.booked_by)), n: ids.length, ppl: ids };
    }),
  }));
  return { emps, rooms, company };
}

export function Dashboard3DSection({ onExit }: { onExit: () => void }) {
  const { profile } = useAuth();
  const frame = useRef<HTMLIFrameElement>(null);
  const last = useRef('');
  const sendRef = useRef<(force?: boolean) => Promise<void>>(async () => {});
  const { company } = useCompany();
  const logoUrl = useCompanyLogoUrl(company?.logo_url);
  const companyId = (profile as any)?.company_id as string | undefined;
  const src = useMemo(() => {
    const css = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();   // "h s% l%"
    const m = css.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/);
    let hex = '#FF6A1A';
    if (m) { const h = +m[1], s = +m[2] / 100, l = +m[3] / 100; const a = s * Math.min(l, 1 - l); const f = (n: number) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); }; hex = `#${f(0)}${f(8)}${f(4)}`; }
    const fg = readableOn(hex);
    return `/dash/painel.html?v=20261112b&c=${encodeURIComponent(hex)}&fg=${encodeURIComponent(fg)}`;
  }, []);
  useEffect(() => {
    let alive = true;
    const send = async (force = false) => {
      if (!companyId) return;
      try {
        const data = await loadCompanyData(companyId, { name: company?.name || '', logo: logoUrl || '' });
        const sig = JSON.stringify(data);
        if (!alive || (!force && sig === last.current)) return;
        last.current = sig;
        frame.current?.contentWindow?.postMessage({ type: 'ewvon:dash-data', ...data }, location.origin);
      } catch { /* the Dash keeps what it already shows */ }
    };
    sendRef.current = send;
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin) return;
      if (e.data?.type === 'ewvon:dash-exit') switchMode('system', onExit);
      if (e.data?.type === 'ewvon:dash-ready') void send(true);
    };
    window.addEventListener('message', on);
    // Real time: any change to people, sectors, rooms, bookings or presence refreshes the Dash (grouped, so a burst is one update).
    let timer = 0;
    const soon = () => { window.clearTimeout(timer); timer = window.setTimeout(() => void send(), 900); };
    const tables = ['profiles', 'sectors', 'meeting_rooms', 'meeting_bookings', 'meeting_booking_participants', 'user_presence', 'hr_people_status'];
    let ch = supabase.channel('dash-live-' + companyId);
    tables.forEach((table) => { ch = ch.on('postgres_changes' as never, { event: '*', schema: 'public', table }, soon); });
    ch.subscribe();
    const t = window.setInterval(() => void send(), 30000);   // safety net next to Realtime
    return () => { alive = false; window.clearTimeout(timer); window.removeEventListener('message', on); window.clearInterval(t); void supabase.removeChannel(ch); };
  }, [onExit, companyId, company?.name, logoUrl]);
  return <iframe ref={frame} onLoad={() => window.setTimeout(() => void sendRef.current(true), 50)} title="Dash" src={src} className="fixed inset-0 z-40 h-full w-full border-0 bg-[#E8EDF2]" allow="fullscreen" data-company={profile?.company_id || ''} />;
}
