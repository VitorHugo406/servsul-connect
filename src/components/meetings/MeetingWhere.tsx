// Where a meeting happens, chosen when it is created (Calendário › Marcar reunião and RH › 1:1):
//  - "Chamada pelo ewvon": the calendar event is the call room (calendar_events.video_room = 'ewvon'; needs the
//    video_calls plan feature); everybody joins with "Entrar na chamada".
//  - "Link externo": Teams, Google Meet, Zoom… (calendar_events.meeting_link, https only).
//  - "Sala de reunião": books the room for the same time (meeting_bookings, the participants go into
//    meeting_booking_participants; calendar_events.booking_id + location = room name). Rooms busy in that time are
//    shown as "Ocupada"; the database also refuses overlaps (meeting_bookings_no_overlap).
//  - "Presencial / outro local": free text in calendar_events.location.
// applyWhere() writes all of it on an existing calendar event (create and edit). Migration 20261123030000.
import { useEffect, useMemo, useState } from 'react';
import { DoorOpen, Link2, MapPin, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyPlan } from '@/hooks/useCompanyPlan';
import { planHasFeature } from '@/lib/planAccess';
import { Input } from '@/components/ui/input';
import { Sel } from '@/components/ui/Sel';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type WhereMode = 'ewvon' | 'link' | 'room' | 'local';
export type Where = { mode: WhereMode; link: string; roomId: string; place: string };
export const emptyWhere = (mode: WhereMode = 'link'): Where => ({ mode, link: '', roomId: '', place: '' });
type Room = { id: string; name: string; capacity: number | null; opens_at: string | null; closes_at: string | null };

export const validLink = (u: string) => { try { const x = new URL(u.trim()); return x.protocol === 'https:'; } catch { return false; } };
export const providerOf = (u: string) => {
  const h = (() => { try { return new URL(u).host; } catch { return ''; } })();
  if (/teams\.(microsoft|live)\.com/.test(h)) return 'Microsoft Teams';
  if (/meet\.google\.com/.test(h)) return 'Google Meet';
  if (/zoom\.us$|\.zoom\.us/.test(h)) return 'Zoom';
  if (/webex\.com/.test(h)) return 'Webex';
  return h.replace(/^www\./, '');
};

/** What is missing before saving (null = ready). */
export function whereProblem(w: Where): string | null {
  if (w.mode === 'link' && !validLink(w.link)) return 'Cole o link da reunião (Teams, Meet, Zoom…) começando com https://';
  if (w.mode === 'room' && !w.roomId) return 'Escolha a sala de reunião.';
  if (w.mode === 'local' && !w.place.trim()) return 'Informe o local da reunião.';
  return null;
}

/** Which options this company/person can use. */
export function useWhereOptions() {
  const { profile } = useAuth();
  const { plan } = useCompanyPlan();
  const [rooms, setRooms] = useState<Room[]>([]);
  useEffect(() => {
    if (!profile?.company_id) return;
    let live = true;
    void db.from('meeting_rooms').select('id,name,capacity,opens_at,closes_at').eq('company_id', profile.company_id).eq('is_active', true).order('name')
      .then(({ data }: { data: Room[] | null }) => { if (live) setRooms(data || []); });
    return () => { live = false; };
  }, [profile?.company_id]);
  const video = !!plan && planHasFeature(plan, 'video_calls');
  const roomsOn = (!plan || planHasFeature(plan, 'meeting_rooms')) && rooms.length > 0;
  return { video, roomsOn, rooms };
}

/** The "Onde vai ser" field. start/end (ISO) let it mark rooms already booked in that time. */
export function MeetingWherePicker({ value, onChange, start, end, ignoreBookingId }: { value: Where; onChange: (w: Where) => void; start?: string | null; end?: string | null; ignoreBookingId?: string | null }) {
  const { video, roomsOn, rooms } = useWhereOptions();
  const [busy, setBusy] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!roomsOn || !start || !end || !(new Date(end) > new Date(start))) { setBusy(new Set()); return; }
    let live = true;
    void db.from('meeting_bookings').select('id,room_id').lt('starts_at', end).gt('ends_at', start).in('room_id', rooms.map((r) => r.id))
      .then(({ data }: { data: { id: string; room_id: string }[] | null }) => { if (live) setBusy(new Set((data || []).filter((b) => b.id !== ignoreBookingId).map((b) => b.room_id))); });
    return () => { live = false; };
  }, [roomsOn, rooms, start, end, ignoreBookingId]);
  const opts = useMemo(() => ([
    video ? ['ewvon', 'Chamada pelo ewvon', Video] : null,
    ['link', 'Link externo', Link2],
    roomsOn ? ['room', 'Sala de reunião', DoorOpen] : null,
    ['local', 'Presencial / outro local', MapPin],
  ].filter(Boolean) as [WhereMode, string, typeof Video][]), [video, roomsOn]);
  // a mode the company cannot use (plan without calls, no rooms) falls back to the external link
  useEffect(() => { if (!opts.some(([k]) => k === value.mode)) onChange({ ...value, mode: 'link' }); }, [opts]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<Where>) => onChange({ ...value, ...p });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Onde vai ser a reunião">
        {opts.map(([k, l, I]) => (
          <button key={k} type="button" className="ui-chip inline-flex items-center gap-1.5" aria-pressed={value.mode === k} onClick={() => set({ mode: k })}><I className="h-3.5 w-3.5" />{l}</button>
        ))}
      </div>
      {value.mode === 'ewvon' ? <p className="rounded-[10px] bg-primary/5 px-3 py-2 text-xs text-muted-foreground">Na hora, todos entram pelo botão “Entrar na chamada”, sem sair do ewvon. Fica marcado no calendário de cada participante.</p> : null}
      {value.mode === 'link' ? (
        <div>
          <Input value={value.link} onChange={(e) => set({ link: e.target.value })} placeholder="https://teams.microsoft.com/… ou https://meet.google.com/…" aria-label="Link da reunião" />
          {value.link.trim() ? <p className={`mt-1 text-xs ${validLink(value.link) ? 'text-muted-foreground' : 'text-destructive'}`}>{validLink(value.link) ? `Reunião pelo ${providerOf(value.link)}` : 'O link precisa começar com https://'}</p> : null}
        </div>
      ) : null}
      {value.mode === 'room' ? (
        <div>
          <Sel className="ui-sel w-full" value={value.roomId} onChange={(e) => set({ roomId: e.target.value })} aria-label="Sala">
            <option value="">Escolha a sala</option>
            {rooms.map((r) => <option key={r.id} value={r.id} disabled={busy.has(r.id)}>{r.name}{r.capacity ? ` · ${r.capacity} lugares` : ''}{busy.has(r.id) ? ' · Ocupada nesse horário' : ''}</option>)}
          </Sel>
          <p className="mt-1 text-xs text-muted-foreground">A sala fica reservada no mesmo horário, com os participantes.</p>
        </div>
      ) : null}
      {value.mode === 'local' ? <Input value={value.place} maxLength={300} onChange={(e) => set({ place: e.target.value })} placeholder="Ex.: Sala da diretoria, recepção, cliente…" aria-label="Local" /> : null}
    </div>
  );
}

/** Reads the "where" of an existing calendar event (for editing). */
export function whereFromEvent(e: { video_room?: string | null; meeting_link?: string | null; location?: string | null; booking_id?: string | null }, roomId?: string | null): Where {
  if (e.video_room) return { ...emptyWhere('ewvon') };
  if (e.booking_id) return { ...emptyWhere('room'), roomId: roomId || '' };
  if (e.meeting_link) return { ...emptyWhere('link'), link: e.meeting_link };
  if (e.location) return { ...emptyWhere('local'), place: e.location };
  return emptyWhere('link');
}

const friendly = (m: string) => (/no_overlap|23P01|overlap|conflict|Já existe/i.test(m) ? 'Essa sala já está reservada nesse horário. Escolha outra sala ou outro horário.'
  : /funcionamento/i.test(m) ? 'Esse horário está fora do funcionamento da sala (e a reunião precisa começar e terminar no mesmo dia).'
  : /futuro/i.test(m) ? 'Para reservar a sala, a reunião precisa ser num horário futuro.'
  : /indispon/i.test(m) ? 'Essa sala não está disponível.' : 'Não foi possível reservar a sala.');

/** Saves the "where" on the calendar event: reserves/updates/frees the room and sets call, link or place.
 *  Returns an error message to show, or null. */
export async function applyWhere(eventId: string, w: Where, o: { title: string; start: string; end: string; participants: string[]; profileId: string; companyId: string; prevBookingId?: string | null; roomName?: string }): Promise<string | null> {
  let bookingId: string | null = o.prevBookingId || null;
  let location: string | null = null;
  if (w.mode === 'room') {
    const row = { room_id: w.roomId, title: o.title.slice(0, 160), starts_at: o.start, ends_at: o.end };
    if (bookingId) {
      const { error } = await db.from('meeting_bookings').update(row).eq('id', bookingId);
      if (error) return friendly(`${error.code || ''} ${error.message || ''}`);
      await db.from('meeting_booking_participants').delete().eq('booking_id', bookingId);
    } else {
      const { data, error } = await db.from('meeting_bookings').insert({ ...row, booked_by: o.profileId, company_id: o.companyId }).select('id').single();
      if (error || !data) return friendly(`${error?.code || ''} ${error?.message || ''}`);
      bookingId = data.id;
    }
    const people = [...new Set(o.participants.filter((p) => p && p !== o.profileId))];
    if (people.length) await db.from('meeting_booking_participants').insert(people.map((p) => ({ booking_id: bookingId, profile_id: p })));
    location = o.roomName || null;
  } else if (bookingId) {
    await db.from('meeting_bookings').delete().eq('id', bookingId);
    bookingId = null;
  }
  if (w.mode === 'local') location = w.place.trim().slice(0, 300) || null;
  const { error } = await db.from('calendar_events').update({
    video_room: w.mode === 'ewvon' ? 'ewvon' : null,
    meeting_link: w.mode === 'link' ? w.link.trim() : null,
    location, booking_id: bookingId,
  }).eq('id', eventId);
  return error ? 'A reunião foi salva, mas o local não pôde ser gravado.' : null;
}
