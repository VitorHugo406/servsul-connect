// /sala/checkin/<token>: the page behind a meeting room's QR code. Needs the person to be signed in (company
// members only); shows the current/next booking of the room and records the check-in (room_checkin RPC, migration
// 20261121010000). Check-in opens 15 minutes before the booking starts.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, DoorOpen, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type R = { room: string; capacity: number; current: { id: string; title: string; starts_at: string; ends_at: string; host: string; checked: number; me: boolean } | null; next: { title: string; starts_at: string; ends_at: string } | null };
const hm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export default function RoomCheckin() {
  const { token } = useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [r, setR] = useState<R | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (doIt: boolean) => {
    const { data, error } = await (supabase as any).rpc('room_checkin', { _token: token || '', _do: doIt });
    setR(error ? null : (data as R));
  }, [token]);
  useEffect(() => { if (user) void load(false); }, [user, load]);
  const shell = (body: React.ReactNode) => <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4"><div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-sm">{body}</div></div>;
  if (loading) return shell(<Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />);
  if (!user) return shell(<><DoorOpen className="mx-auto h-10 w-10 text-primary" /><b className="mt-3 block text-lg">Check-in na sala</b><p className="mt-1 text-sm text-muted-foreground">Entre com a sua conta da empresa e leia o QR Code de novo.</p><button type="button" onClick={() => nav('/auth')} className="mt-4 h-10 w-full rounded-[10px] bg-primary text-sm font-semibold text-primary-foreground">Entrar</button></>);
  if (r === undefined) return shell(<Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />);
  if (!r) return shell(<><b className="block text-lg">Sala não encontrada</b><p className="mt-1 text-sm text-muted-foreground">O QR Code é de outra empresa ou foi trocado.</p></>);
  const c = r.current;
  return shell(<>
    <DoorOpen className="mx-auto h-10 w-10 text-primary" />
    <b className="mt-3 block text-lg">{r.room}</b>
    <p className="text-xs text-muted-foreground">Até {r.capacity} pessoas</p>
    {c ? <div className="mt-5 rounded-[12px] border border-border p-4 text-left">
      <div className="text-xs font-semibold text-primary">Agora · {hm(c.starts_at)}–{hm(c.ends_at)}</div>
      <div className="mt-1 font-semibold">{c.title}</div>
      <div className="text-sm text-muted-foreground">Organizada por {c.host} · {c.checked} {c.checked === 1 ? 'presença confirmada' : 'presenças confirmadas'}</div>
      {c.me ? <div className="mt-3 flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />Seu check-in está feito.</div>
        : <button type="button" disabled={busy} onClick={async () => { setBusy(true); await load(true); setBusy(false); }} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Fazer check-in</button>}
    </div> : <p className="mt-5 text-sm text-muted-foreground">Nenhuma reunião agora nesta sala.</p>}
    {r.next ? <p className="mt-4 text-xs text-muted-foreground">Próxima: {r.next.title} · {new Date(r.next.starts_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} {hm(r.next.starts_at)}</p> : null}
  </>);
}
