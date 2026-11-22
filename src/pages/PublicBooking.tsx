// /agendar/<token>: public booking page (no login). Shows the host, the meeting name/duration and the free times
// computed on the server (public_booking_view); the visitor picks a day and a time, types name + e-mail and
// public_booking_create() books it (it re-checks the slot under a lock, limits bookings per day/e-mail and creates the
// host's calendar event). Times are shown in São Paulo time (Brasília), the time zone of the host's availability.
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarCheck2, CheckCircle2, ChevronLeft, ChevronRight, Clock, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type V = { title: string; intro: string | null; duration: number; host: string; avatar: string | null; company: string; slots: string[] };
const TZ = 'America/Sao_Paulo';
const dayKey = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso));
const hm = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const dayLabel = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
const ERR: Record<string, string> = {
  BOOKING_CLOSED: 'Este link de agendamento foi pausado.',
  BOOKING_DATA: 'Confira o nome e o e-mail.',
  BOOKING_LIMIT: 'Muitos agendamentos em pouco tempo. Tente de novo mais tarde.',
  BOOKING_TAKEN: 'Esse horário acabou de ser ocupado. Escolha outro.',
};

export default function PublicBooking() {
  const { token } = useParams();
  const [v, setV] = useState<V | null | undefined>(undefined);
  const [day, setDay] = useState('');
  const [slot, setSlot] = useState('');
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [note, setNote] = useState(''); const [hp, setHp] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [done, setDone] = useState<{ start: string; link: string | null } | null>(null);
  const [weekStart, setWeekStart] = useState(0);
  const load = async () => {
    const { data, error } = await (supabase as any).rpc('public_booking_view', { _token: token || '' });
    setV(error ? null : (data as V) || null);
  };
  useEffect(() => { void load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (v) document.title = `${v.title} · ${v.host} | ${v.company}`; }, [v]);
  const byDay = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of v?.slots || []) { const k = dayKey(s); const a = m.get(k) || []; a.push(s); m.set(k, a); }
    return m;
  }, [v]);
  const days = useMemo(() => [...byDay.keys()].sort(), [byDay]);
  useEffect(() => { if (!day && days.length) setDay(days[0]); }, [days, day]);

  if (v === undefined) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!v) return <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center"><b className="text-lg">Agendamento indisponível</b><p className="text-sm text-muted-foreground">Este link foi pausado ou está errado.</p></div>;

  const book = async (e: React.FormEvent) => {
    e.preventDefault(); if (!slot) return;
    setBusy(true); setErr('');
    const { data, error } = await (supabase as any).rpc('public_booking_create', { _token: token, _start: slot, _name: name, _email: email, _note: note || null, _hp: hp || null });
    setBusy(false);
    if (error) { const code = (error.message || '').match(/BOOKING_[A-Z]+/)?.[0] || ''; setErr(ERR[code] || 'Não foi possível agendar. Tente de novo.'); if (code === 'BOOKING_TAKEN') { setSlot(''); void load(); } return; }
    setDone({ start: (data as { start?: string })?.start || slot, link: (data as { link?: string | null })?.link || null });
  };
  const visibleDays = days.slice(weekStart, weekStart + 7);
  const field = 'w-full rounded-[10px] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-8">
      <div className="mx-auto grid max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:grid-cols-[280px_1fr]">
        <aside className="border-b border-border p-6 md:border-b-0 md:border-r">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{v.company}</div>
          <div className="mt-4 flex items-center gap-3">
            {v.avatar ? <img src={v.avatar} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">{v.host.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</span>}
            <div className="min-w-0"><div className="truncate font-semibold">{v.host}</div><div className="text-xs text-muted-foreground">Anfitrião</div></div>
          </div>
          <h1 className="mt-5 text-xl font-semibold leading-tight">{v.title}</h1>
          <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"><Clock className="h-4 w-4" />{v.duration} minutos</div>
          {v.intro ? <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{v.intro}</p> : null}
          <p className="mt-6 text-xs text-muted-foreground">Horários de Brasília (São Paulo).</p>
        </aside>
        <main className="p-6">
          {done ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              <b className="text-lg">Reunião agendada</b>
              <p className="text-sm text-muted-foreground">{dayLabel(dayKey(done.start))} às {hm(done.start)} · {v.duration} min com {v.host}.</p>
              {done.link ? <a href={done.link} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary underline">Link da reunião</a> : null}
              <p className="text-xs text-muted-foreground">Guarde esta página ou anote o horário. Se precisar mudar, fale com {v.host.split(' ')[0]}.</p>
            </div>
          ) : !days.length ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center"><CalendarCheck2 className="h-8 w-8 text-muted-foreground" /><b>Sem horários livres</b><p className="text-sm text-muted-foreground">Não há horários disponíveis nos próximos dias. Tente mais tarde.</p></div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <b className="text-sm">Escolha o dia</b>
                <div className="flex gap-1">
                  <button type="button" className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-border disabled:opacity-40" disabled={weekStart === 0} onClick={() => setWeekStart((w) => Math.max(0, w - 7))} aria-label="Dias anteriores"><ChevronLeft className="h-4 w-4" /></button>
                  <button type="button" className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-border disabled:opacity-40" disabled={weekStart + 7 >= days.length} onClick={() => setWeekStart((w) => w + 7)} aria-label="Próximos dias"><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                {visibleDays.map((k) => { const d = new Date(`${k}T12:00:00`); const on = k === day; return (
                  <button key={k} type="button" onClick={() => { setDay(k); setSlot(''); }} aria-pressed={on}
                    className={`rounded-[10px] border px-1 py-2 text-center text-xs ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`}>
                    <div className="capitalize">{d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</div><b className="text-base">{d.getDate()}</b><div className="opacity-75">{byDay.get(k)?.length} hor.</div>
                  </button>); })}
              </div>
              <div className="mt-5 text-sm font-medium capitalize">{day ? dayLabel(day) : ''}</div>
              <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                {(byDay.get(day) || []).map((s) => <button key={s} type="button" onClick={() => setSlot(s)} aria-pressed={slot === s} className={`rounded-[10px] border px-2 py-2 text-sm font-medium ${slot === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/60'}`}>{hm(s)}</button>)}
              </div>
              {slot ? (
                <form onSubmit={book} className="mt-6 space-y-3 border-t border-border pt-5">
                  <b className="block text-sm">{dayLabel(dayKey(slot))} às {hm(slot)}</b>
                  <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" required minLength={2} maxLength={120} aria-label="Seu nome" />
                  <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Seu e-mail" required maxLength={200} aria-label="Seu e-mail" />
                  <textarea className={field} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Assunto ou observação (opcional)" maxLength={1000} aria-label="Observação" />
                  <input type="text" value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }} />
                  {err ? <p className="text-sm text-destructive">{err}</p> : null}
                  <button type="submit" disabled={busy} className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Confirmar agendamento</button>
                  <p className="text-xs text-muted-foreground">Seu nome e e-mail vão para o calendário de {v.host.split(' ')[0]}, só para esta reunião.</p>
                </form>
              ) : null}
            </>
          )}
        </main>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">Agendamento feito com ewvon</p>
    </div>
  );
}
