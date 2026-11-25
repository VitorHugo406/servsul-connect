// Mobile app: "+" › Evento (calendar event/meeting with the conversation as invitees, posted as an invitation card),
// "+" › Localização (mini-map + caption) and the side-menu Agenda page.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EventCard, EventForm, LocationPicker, TransitForm, type SharePerson } from '@/components/chat/extras/ChatShare';
import { type ChatLoc, type ChatTransit, type EventDraft, createEvent, emptyEvent, emptyTransit, eventContent, eventProblem, locContent, transitContent } from '@/lib/chatShare';
import type { Person } from './data';
import { I } from './icons';
import { AI_SENDER_ID } from '@/lib/systemSender';

const sharePeople = (people: Record<string, Person>, meId: string): SharePerson[] =>
  Object.values(people).filter((p) => !p.sys && p.id !== meId && p.id !== AI_SENDER_ID).map((p) => ({ id: p.id, name: p.n, photo: p.photo })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

export function EventSheet({ people, meId, invite, post, close, toast }: { people: Record<string, Person>; meId: string; invite: string[]; post?: (content: string) => void; close: () => void; toast: (m: string) => void }) {
  const [d, setD] = useState<EventDraft>(() => emptyEvent('meeting', invite.filter((id) => id !== meId && people[id] && !people[id].sys)));
  const [busy, setBusy] = useState(false);
  const list = useMemo(() => sharePeople(people, meId), [people, meId]);
  const problem = eventProblem(d);
  const send = async () => {
    if (problem || busy) { if (problem) toast(problem); return; }
    setBusy(true);
    try {
      const id = await createEvent(d);
      if (post) post(eventContent(id));
      window.dispatchEvent(new Event('ewvon:events-changed'));
      toast(d.kind === 'meeting' ? 'Reunião marcada' : 'Evento criado');
      close();
    } catch { toast('Não foi possível criar o evento.'); }
    finally { setBusy(false); }
  };
  return (
    <>
      <div className="gp" />
      <div className="shh"><div><b>{d.kind === 'meeting' ? 'Marcar reunião' : 'Novo evento'}</b><small>{post ? 'Vai para a agenda de cada convidado e o convite aparece na conversa' : 'Vai para a agenda de cada convidado'}</small></div></div>
      <EventForm value={d} onChange={setD} people={list} mobile />
      <div className="ewx-sheetfoot"><button className="btn full" disabled={busy || !!problem} onClick={() => void send()}>{busy ? 'Criando…' : post ? 'Criar e enviar convite' : 'Criar'}</button></div>
    </>
  );
}

export function LocSheet({ post, close, toast }: { post: (content: string) => void; close: () => void; toast: (m: string) => void }) {
  const [loc, setLoc] = useState<ChatLoc | null>(null);
  return (
    <>
      <div className="gp" />
      <div className="shh"><div><b>Enviar localização</b><small>Aparece com um minimapa; quem tocar escolhe o app de mapas</small></div></div>
      <LocationPicker value={loc} onChange={setLoc} mobile />
      <div className="ewx-sheetfoot"><button className="btn full" disabled={!loc} onClick={() => { if (!loc) return; post(locContent(loc)); toast('Localização enviada'); close(); }}>Enviar localização</button></div>
    </>
  );
}

/** Side menu › Agenda: my upcoming events and meetings (created by me or where I am invited), with the same invitation card. */
export function AgendaPage({ meId, userId, onNew }: { meId: string; userId: string; onNew: () => void }) {
  const [ids, setIds] = useState<string[] | null>(null);
  const load = async () => {
    const from = new Date(Date.now() - 12 * 3600_000).toISOString();
    const to = new Date(Date.now() + 90 * 86400_000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const [{ data: own }, { data: inv }] = await Promise.all([
      db.from('calendar_events').select('id,start_date').eq('created_by', userId).gte('start_date', from).lte('start_date', to).order('start_date').limit(100),
      db.from('meeting_participants').select('event_id').eq('profile_id', meId).limit(300),
    ]);
    const invIds = (inv || []).map((r: { event_id: string }) => r.event_id);
    const { data: invEv } = invIds.length ? await db.from('calendar_events').select('id,start_date').in('id', invIds).gte('start_date', from).lte('start_date', to) : { data: [] };
    const all = new Map<string, string>();
    for (const r of [...(own || []), ...(invEv || [])] as { id: string; start_date: string }[]) all.set(r.id, r.start_date);
    setIds([...all.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id]) => id));
  };
  useEffect(() => {
    void load();
    const on = () => void load();
    window.addEventListener('ewvon:events-changed', on);
    return () => window.removeEventListener('ewvon:events-changed', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId, userId]);
  return (
    <div className="ewx-agenda">
      <button className="btn full" onClick={onNew}><I n="plus" />Novo evento ou reunião</button>
      {ids === null ? <div className="hint" style={{ padding: 30 }}>Carregando…</div>
        : !ids.length ? <div className="hint" style={{ padding: 30 }}>Nada marcado nos próximos 90 dias.</div>
        : ids.map((id) => <div key={id} className="card ewx-agenda-i"><EventCard id={id} /></div>)}
    </div>
  );
}

export function TransitSheet({ post, close, toast }: { post: (content: string) => void; close: () => void; toast: (m: string) => void }) {
  const [x, setX] = useState<ChatTransit>(emptyTransit);
  const ok = !!(x.line.trim() || x.name.trim());
  return (
    <>
      <div className="gp" />
      <div className="shh"><div><b>Linha de ônibus ou trem</b><small>Avise sobre uma linha de qualquer cidade, com situação e legenda</small></div></div>
      <TransitForm value={x} onChange={setX} mobile />
      <div className="ewx-sheetfoot"><button className="btn full" disabled={!ok} onClick={() => { if (!ok) return; post(transitContent(x)); toast('Enviado'); close(); }}>Enviar</button></div>
    </>
  );
}
