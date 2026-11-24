// PC chat composer "+" › "Marcar evento ou reunião" and "Enviar localização".
import { useEffect, useMemo, useState } from 'react';
import { BusFront, CalendarPlus, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useActiveUsers } from '@/hooks/useDirectMessages';
import { useAuth } from '@/contexts/AuthContext';
import { type ChatLoc, type ChatTransit, type EventDraft, convMembers, createEvent, emptyEvent, emptyTransit, eventContent, eventProblem, locContent, transitContent } from '@/lib/chatShare';
import { EventForm, LocationPicker, TransitForm, type SharePerson } from './ChatShare';

export function CreateEventDialog({ open, onOpenChange, convKey, onSend }: { open: boolean; onOpenChange: (o: boolean) => void; convKey: string | null; onSend: (content: string) => unknown }) {
  const { profile } = useAuth();
  const { users } = useActiveUsers();
  const [d, setD] = useState<EventDraft>(() => emptyEvent());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setD(emptyEvent());
    void convMembers(convKey).then((ids) => setD((x) => ({ ...x, participants: ids.filter((id) => id !== profile?.id) })));
  }, [open, convKey, profile?.id]);
  const people: SharePerson[] = useMemo(() => users.map((u) => ({ id: u.id, name: u.display_name || u.name, photo: u.avatar_url })), [users]);
  const send = async () => {
    const p = eventProblem(d); if (p) { toast.error(p); return; }
    setBusy(true);
    try { const id = await createEvent(d); await onSend(eventContent(id)); toast.success(d.kind === 'meeting' ? 'Reunião marcada e convite enviado' : 'Evento criado e convite enviado'); onOpenChange(false); }
    catch { toast.error('Não foi possível criar o evento.'); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Marcar evento ou reunião</DialogTitle><DialogDescription>Vai para a agenda de cada convidado e o convite aparece na conversa para responderem.</DialogDescription></DialogHeader>
        <EventForm value={d} onChange={setD} people={people} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={() => void send()} disabled={busy || !!eventProblem(d)}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarPlus className="mr-2 h-4 w-4" />}Criar e enviar convite</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ShareLocationDialog({ open, onOpenChange, onSend }: { open: boolean; onOpenChange: (o: boolean) => void; onSend: (content: string) => unknown }) {
  const [loc, setLoc] = useState<ChatLoc | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setLoc(null); }, [open]);
  const send = async () => {
    if (!loc) return;
    setBusy(true);
    try { await onSend(locContent(loc)); onOpenChange(false); }
    catch { toast.error('Não foi possível enviar a localização.'); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Enviar localização</DialogTitle><DialogDescription>Mostra um minimapa na conversa; ao tocar, o celular oferece os apps de mapa instalados.</DialogDescription></DialogHeader>
        <LocationPicker value={loc} onChange={setLoc} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={() => void send()} disabled={busy || !loc}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}Enviar localização</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ShareTransitDialog({ open, onOpenChange, onSend }: { open: boolean; onOpenChange: (o: boolean) => void; onSend: (content: string) => unknown }) {
  const [x, setX] = useState<ChatTransit>(emptyTransit);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setX(emptyTransit()); }, [open]);
  const ok = !!(x.line.trim() || x.name.trim());
  const send = async () => {
    if (!ok) return;
    setBusy(true);
    try { await onSend(transitContent(x)); onOpenChange(false); }
    catch { toast.error('Não foi possível enviar.'); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Linha de ônibus ou trem</DialogTitle><DialogDescription>Avise sobre uma linha de qualquer cidade do mundo, com situação e legenda.</DialogDescription></DialogHeader>
        <TransitForm value={x} onChange={setX} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={() => void send()} disabled={busy || !ok}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BusFront className="mr-2 h-4 w-4" />}Enviar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
