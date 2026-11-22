// Shared bits of the RH screens (design-kit dk- classes, theme tokens): people of the company (including me),
// avatars, dates and the "is this person a manager" check (is_people_manager, migration 20261121010000).
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveUsers } from '@/hooks/useDirectMessages';

export const db = supabase as any;
export type Person = { id: string; user_id?: string | null; name: string; display_name?: string | null; avatar_url?: string | null; sector_id?: string | null };
export const pname = (p?: Person | null) => (p ? p.display_name || p.name : 'Colaborador');
export const initials = (n: string) => n.split(' ').filter(Boolean).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
export const fmtD = (d?: string | null) => (d ? new Date(d.length <= 10 ? `${d}T12:00:00` : d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
export const fmtDH = (d?: string | null) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
export const daysBetween = (a: string, b: string) => Math.round((+new Date(`${b}T12:00:00`) - +new Date(`${a}T12:00:00`)) / 864e5) + 1;
export const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export function usePeople() {
  const { profile } = useAuth();
  const { users } = useActiveUsers();
  return useMemo(() => {
    const list = [...((users || []) as Person[])];
    if (profile && !list.some((u) => u.id === profile.id)) list.unshift({ id: profile.id, user_id: profile.user_id, name: profile.name, display_name: profile.display_name, avatar_url: profile.avatar_url, sector_id: profile.sector_id });
    list.sort((a, b) => pname(a).localeCompare(pname(b), 'pt-BR'));
    return { list, byId: new Map(list.map((p) => [p.id, p])) };
  }, [users, profile]);
}

export function useIsPeopleManager() {
  const { isAdmin } = useAuth();
  const [v, setV] = useState(false);
  useEffect(() => { let alive = true; void db.rpc('is_people_manager').then(({ data }: { data: boolean | null }) => { if (alive) setV(!!data); }); return () => { alive = false; }; }, []);
  return v || isAdmin;
}

export function Av({ p, size = 32 }: { p?: Person | null; size?: number }) {
  const n = pname(p);
  return p?.avatar_url
    ? <img src={p.avatar_url} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
    : <span className="flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-foreground/80" style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}>{initials(n) || '?'}</span>;
}
