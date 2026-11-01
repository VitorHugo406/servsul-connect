import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Clock3, DoorOpen, Users, Plus, Search, Pencil, CalendarCheck, Building2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type Room = { id: string; name: string; capacity: number; opens_at: string; closes_at: string; is_active: boolean; };
type Person = { id: string; name: string; display_name: string | null; avatar_url: string | null; is_active: boolean; };
type Booking = { id: string; room_id: string; title: string; starts_at: string; ends_at: string; booked_by: string; notes: string | null; room?: Room; organizer?: Person; participants?: Person[]; };

const timeLabel = (value: string) => value.slice(0, 5);

export function MeetingRoomsSection() {
  const { profile, user, isAdmin, canAccess } = useAuth();
  const allowed = isAdmin || canAccess('can_access_meeting_rooms');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roomDialog, setRoomDialog] = useState(false);
  const [bookingDialog, setBookingDialog] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomName, setRoomName] = useState('');
  const [capacity, setCapacity] = useState('8');
  const [opensAt, setOpensAt] = useState('08:00');
  const [closesAt, setClosesAt] = useState('18:00');
  const [roomSaving, setRoomSaving] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState('60');
  const [notes, setNotes] = useState('');
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [bookingSaving, setBookingSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!profile?.company_id || !allowed) { setLoading(false); return; }
    setLoading(true);
    const db = supabase as any;
    const [{ data: roomData, error: roomError }, { data: bookingData, error: bookingError }, { data: peopleData, error: peopleError }] = await Promise.all([
      db.from('meeting_rooms').select('*').eq('company_id', profile.company_id).eq('is_active', true).order('name'),
      db.from('meeting_bookings').select('id, room_id, title, starts_at, ends_at, booked_by, notes').eq('company_id', profile.company_id).gte('ends_at', new Date().toISOString()).order('starts_at'),
      db.from('profiles').select('id, user_id, name, display_name, avatar_url, is_active').eq('company_id', profile.company_id).eq('is_active', true).order('name'),
    ]);
    if (roomError || bookingError || peopleError) {
      console.error('Meeting rooms load error', roomError || bookingError || peopleError);
      toast.error('Não foi possível carregar as salas de reunião.');
      setLoading(false);
      return;
    }
    const roomsList = (roomData || []) as Room[];
    const bookingsList = (bookingData || []) as Booking[];
    const ids = bookingsList.map(b => b.id);
    let participants: any[] = [];
    if (ids.length) {
      const { data } = await db.from('meeting_booking_participants').select('booking_id, profile_id').in('booking_id', ids);
      participants = data || [];
    }
    const profileList = (peopleData || []) as Person[];
    const personMap = new Map(profileList.map(p => [p.id, p]));
    const roomMap = new Map(roomsList.map(r => [r.id, r]));
    setRooms(roomsList);
    setPeople(profileList);
    setBookings(bookingsList.map(b => ({
      ...b,
      room: roomMap.get(b.room_id),
      organizer: personMap.get(b.booked_by),
      participants: participants.filter(p => p.booking_id === b.id).map(p => personMap.get(p.profile_id)).filter(Boolean) as Person[],
    })));
    setLoading(false);
  }, [profile?.company_id, allowed]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!allowed || !profile?.company_id) return;
    const channel = supabase.channel(`meeting-rooms-${profile.company_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_bookings', filter: `company_id=eq.${profile.company_id}` }, () => { void fetchData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_rooms', filter: `company_id=eq.${profile.company_id}` }, () => { void fetchData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [allowed, profile?.company_id, fetchData]);

  const filteredBookings = useMemo(() => bookings.filter(b => {
    const haystack = [b.title, b.room?.name, b.organizer?.display_name, b.organizer?.name].join(' ').toLowerCase();
    return haystack.includes(search.toLowerCase());
  }), [bookings, search]);

  const openNewRoom = () => {
    setEditingRoom(null); setRoomName(''); setCapacity('8'); setOpensAt('08:00'); setClosesAt('18:00'); setRoomDialog(true);
  };
  const openEditRoom = (room: Room) => {
    setEditingRoom(room); setRoomName(room.name); setCapacity(String(room.capacity)); setOpensAt(timeLabel(room.opens_at)); setClosesAt(timeLabel(room.closes_at)); setRoomDialog(true);
  };
  const saveRoom = async () => {
    if (!profile?.company_id || !user || !roomName.trim()) return;
    const max = Number(capacity);
    if (!Number.isInteger(max) || max < 1 || max > 500 || opensAt >= closesAt) {
      toast.error('Confira a capacidade e o horário de funcionamento.'); return;
    }
    setRoomSaving(true);
    const payload = { name: roomName.trim(), capacity: max, opens_at: opensAt, closes_at: closesAt, company_id: profile.company_id, updated_at: new Date().toISOString() };
    const db = supabase as any;
    const result = editingRoom
      ? await db.from('meeting_rooms').update(payload).eq('id', editingRoom.id)
      : await db.from('meeting_rooms').insert({ ...payload, created_by: user.id });
    setRoomSaving(false);
    if (result.error) { toast.error('Não foi possível salvar a sala.'); console.error(result.error); return; }
    toast.success(editingRoom ? 'Sala atualizada.' : 'Sala criada.');
    setRoomDialog(false); void fetchData();
  };

  const openNewBooking = (roomId?: string) => {
    const now = new Date();
    setSelectedRoom(roomId || rooms[0]?.id || '');
    setMeetingTitle(''); setMeetingDate(format(now, 'yyyy-MM-dd')); setStartTime('09:00'); setDuration('60'); setNotes(''); setSelectedPeople([]); setPeopleSearch('');
    setBookingDialog(true);
  };
  const saveBooking = async () => {
    if (!profile || !profile.company_id || !selectedRoom || !meetingTitle.trim() || !meetingDate || selectedPeople.length === 0) {
      toast.error('Preencha os dados e selecione ao menos um participante.'); return;
    }
    const room = rooms.find(r => r.id === selectedRoom);
    const durationMinutes = Number(duration);
    if (!room || !Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 720) {
      toast.error('Selecione uma duração válida.'); return;
    }
    if (selectedPeople.length + 1 > room.capacity) {
      toast.error(`A sala comporta no máximo ${room.capacity} pessoas, incluindo quem agendou.`); return;
    }
    const startsAt = new Date(`${meetingDate}T${startTime}:00`);
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60000);
    const opening = new Date(`${meetingDate}T${timeLabel(room.opens_at)}:00`);
    const closing = new Date(`${meetingDate}T${timeLabel(room.closes_at)}:00`);
    if (startsAt < opening || endsAt > closing) {
      toast.error(`A sala funciona das ${timeLabel(room.opens_at)} às ${timeLabel(room.closes_at)}.`); return;
    }
    if (startsAt <= new Date()) { toast.error('O agendamento precisa ser em um horário futuro.'); return; }
    const overlap = bookings.some(b => b.room_id === selectedRoom && startsAt < new Date(b.ends_at) && endsAt > new Date(b.starts_at));
    if (overlap) { toast.error('Essa sala já possui uma reserva nesse intervalo.'); return; }

    setBookingSaving(true);
    const db = supabase as any;
    const { data: created, error } = await db.from('meeting_bookings').insert({
      company_id: profile.company_id, room_id: selectedRoom, title: meetingTitle.trim(),
      starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), booked_by: profile.id, notes: notes.trim() || null,
    }).select('id').single();
    if (error || !created) {
      setBookingSaving(false); console.error(error); toast.error('Não foi possível concluir o agendamento.'); return;
    }
    const participantIds = [...new Set([profile.id, ...selectedPeople])];
    const { error: participantsError } = await db.from('meeting_booking_participants').insert(participantIds.map(profile_id => ({ booking_id: created.id, profile_id })));
    if (participantsError) {
      console.error(participantsError);
      await db.from('meeting_bookings').delete().eq('id', created.id);
      setBookingSaving(false); toast.error('Não foi possível registrar os participantes.'); return;
    }
    const startLabel = format(startsAt, 'dd/MM/yyyy HH:mm');
    const endLabel = format(endsAt, 'HH:mm');
    await Promise.all(selectedPeople.map(targetId => {
      const target = people.find(p => p.id === targetId);
      const userId = (target as any)?.user_id;
      if (!userId) return Promise.resolve();
      return db.rpc('create_user_notification', {
        _target_user_id: userId, _type: 'meeting_room',
        _title: 'Sala de reunião agendada',
        _message: `${profile.display_name || profile.name} agendou "${meetingTitle.trim()}" na sala ${room.name}, em ${startLabel}, com duração de ${durationMinutes} minutos (até ${endLabel}).`,
        _reference_id: created.id,
      });
    }));
    setBookingSaving(false); setBookingDialog(false);
    toast.success('Reunião agendada e participantes avisados.');
    void fetchData();
  };

  if (!allowed) return <div className="flex h-full items-center justify-center p-6"><Card className="max-w-md"><CardContent className="pt-6 text-center"><DoorOpen className="mx-auto h-12 w-12 text-muted-foreground"/><h2 className="mt-4 text-lg font-semibold">Acesso restrito</h2><p className="mt-2 text-sm text-muted-foreground">O administrador principal da empresa precisa liberar esta aba nas permissões do usuário.</p></CardContent></Card></div>;

  const filteredPeople = people.filter(p => p.id !== profile?.id && (p.name.toLowerCase().includes(peopleSearch.toLowerCase()) || (p.display_name || '').toLowerCase().includes(peopleSearch.toLowerCase())));
  const grouped = new Map<string, Booking[]>();
  filteredBookings.forEach(b => { const key = format(parseISO(b.starts_at), 'yyyy-MM-dd'); grouped.set(key, [...(grouped.get(key) || []), b]); });

  return <div className="h-full overflow-auto p-4 md:p-6"><div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><div className="rounded-xl bg-primary/10 p-2 text-primary"><DoorOpen className="h-5 w-5"/></div><div><h1 className="text-xl font-bold md:text-2xl">Sala de Reunião</h1><p className="text-sm text-muted-foreground">Espaços, horários e agendamentos da equipe.</p></div></div></div><Button onClick={() => openNewBooking()} disabled={rooms.length === 0} className="gap-2"><Plus className="h-4 w-4"/>Agendar reunião</Button></div>
    <div className="grid gap-3 sm:grid-cols-3"><Card><CardContent className="flex items-center gap-3 p-4"><Building2 className="h-5 w-5 text-primary"/><div><p className="text-xs text-muted-foreground">Salas disponíveis</p><p className="text-xl font-semibold">{rooms.length}</p></div></CardContent></Card><Card><CardContent className="flex items-center gap-3 p-4"><CalendarCheck className="h-5 w-5 text-primary"/><div><p className="text-xs text-muted-foreground">Agendamentos futuros</p><p className="text-xl font-semibold">{bookings.length}</p></div></CardContent></Card><Card><CardContent className="flex items-center gap-3 p-4"><Users className="h-5 w-5 text-primary"/><div><p className="text-xs text-muted-foreground">Pessoas na equipe</p><p className="text-xl font-semibold">{people.length}</p></div></CardContent></Card></div>
    <section className="space-y-3"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Salas</h2><p className="text-xs text-muted-foreground">Capacidade e período de funcionamento</p></div>{isAdmin&&<Button variant="outline" size="sm" onClick={openNewRoom} className="gap-2"><Plus className="h-4 w-4"/>Nova sala</Button>}</div>
      {loading?<div className="py-10 text-center text-sm text-muted-foreground">Carregando salas...</div>:rooms.length===0?<Card><CardContent className="py-10 text-center"><DoorOpen className="mx-auto h-8 w-8 text-muted-foreground"/><p className="mt-3 font-medium">Nenhuma sala cadastrada</p><p className="mt-1 text-sm text-muted-foreground">O administrador pode cadastrar salas com capacidade e horário de funcionamento.</p></CardContent></Card>:<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{rooms.map(room=><Card key={room.id} className="border-border/70"><CardContent className="space-y-3 p-4"><div className="flex items-start justify-between"><div className="rounded-lg bg-muted p-2"><DoorOpen className="h-5 w-5 text-primary"/></div>{isAdmin&&<Button variant="ghost" size="icon" onClick={()=>openEditRoom(room)} aria-label="Editar sala"><Pencil className="h-4 w-4"/></Button>}</div><div><h3 className="font-semibold">{room.name}</h3><p className="text-xs text-muted-foreground">Até {room.capacity} pessoas</p></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-4 w-4"/>{timeLabel(room.opens_at)} às {timeLabel(room.closes_at)}</div><Button variant="outline" className="w-full" onClick={()=>openNewBooking(room.id)}>Agendar nesta sala</Button></CardContent></Card>)}</div>}
    </section>
    <section className="space-y-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-semibold">Agenda de reuniões</h2><p className="text-xs text-muted-foreground">Organizador, participantes, sala e duração.</p></div><div className="relative sm:w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar agendamento..." className="pl-9"/></div></div>
      {filteredBookings.length===0?<Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhuma reunião agendada no momento.</CardContent></Card>:<div className="space-y-4">{Array.from(grouped.entries()).map(([day,items])=><div key={day} className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{format(parseISO(day+'T12:00:00'), 'EEEE, dd/MM', {locale:ptBR})}</p>{items.map(b=><Card key={b.id}><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="h-5 w-5"/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{b.title}</p><Badge variant="outline">{b.room?.name || 'Sala'}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Agendado por {b.organizer?.display_name || b.organizer?.name || 'Usuário'} · {format(parseISO(b.starts_at), 'HH:mm')} às {format(parseISO(b.ends_at), 'HH:mm')}</p><p className="mt-1 text-xs text-muted-foreground">Participantes: {(b.participants||[]).map(p=>p.display_name||p.name).join(', ') || 'Não informado'}</p>{b.notes&&<p className="mt-2 text-sm text-muted-foreground">{b.notes}</p>}</div><Badge variant="secondary" className="self-start sm:self-center">{(b.participants||[]).length} pessoas</Badge></CardContent></Card>)}</div>)}</div>}
    </section>
  </div>
  <Dialog open={roomDialog} onOpenChange={setRoomDialog}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{editingRoom?'Editar sala':'Cadastrar sala'}</DialogTitle><DialogDescription>Defina o nome, a capacidade e o horário de funcionamento.</DialogDescription></DialogHeader><div className="space-y-3"><div className="space-y-1"><Label>Nome da sala</Label><Input value={roomName} onChange={e=>setRoomName(e.target.value)} placeholder="Ex.: Sala 01"/></div><div className="space-y-1"><Label>Limite de pessoas</Label><Input type="number" min="1" max="500" value={capacity} onChange={e=>setCapacity(e.target.value)}/></div><div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label>Abre às</Label><Input type="time" value={opensAt} onChange={e=>setOpensAt(e.target.value)}/></div><div className="space-y-1"><Label>Fecha às</Label><Input type="time" value={closesAt} onChange={e=>setClosesAt(e.target.value)}/></div></div></div><DialogFooter><Button variant="outline" onClick={()=>setRoomDialog(false)}>Cancelar</Button><Button onClick={saveRoom} disabled={roomSaving}>{roomSaving?'Salvando...':'Salvar sala'}</Button></DialogFooter></DialogContent></Dialog>
  <Dialog open={bookingDialog} onOpenChange={setBookingDialog}><DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col"><DialogHeader><DialogTitle>Agendar reunião</DialogTitle><DialogDescription>Escolha a sala, o período e convide os participantes.</DialogDescription></DialogHeader><div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1"><div className="space-y-1"><Label>Assunto</Label><Input value={meetingTitle} onChange={e=>setMeetingTitle(e.target.value)} placeholder="Ex.: Alinhamento semanal"/></div><div className="space-y-1"><Label>Sala</Label><select value={selectedRoom} onChange={e=>setSelectedRoom(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{rooms.map(r=><option key={r.id} value={r.id}>{r.name} · {r.capacity} pessoas</option>)}</select></div><div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label>Data</Label><Input type="date" value={meetingDate} onChange={e=>setMeetingDate(e.target.value)}/></div><div className="space-y-1"><Label>Início</Label><Input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)}/></div><div className="space-y-1"><Label>Duração (minutos)</Label><Input type="number" min="15" max="720" step="15" value={duration} onChange={e=>setDuration(e.target.value)}/></div><div className="space-y-1"><Label>Responsável</Label><Input value={profile?.display_name||profile?.name||''} disabled/></div></div><div className="space-y-1"><Label>Observações</Label><Textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Pauta ou informações adicionais..."/></div><div className="space-y-2"><Label>Participantes</Label><Input value={peopleSearch} onChange={e=>setPeopleSearch(e.target.value)} placeholder="Buscar colaborador..."/><ScrollArea className="h-40 rounded-lg border p-2"><div className="space-y-1">{filteredPeople.map(p=><label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-muted"><Checkbox checked={selectedPeople.includes(p.id)} onCheckedChange={v=>setSelectedPeople(prev=>v?[...prev,p.id]:prev.filter(id=>id!==p.id))}/><span className="text-sm">{p.display_name||p.name}</span></label>)}</div></ScrollArea><p className="text-xs text-muted-foreground">{selectedPeople.length+1} de {rooms.find(r=>r.id===selectedRoom)?.capacity||0} pessoas (incluindo você)</p></div></div><DialogFooter><Button variant="outline" onClick={()=>setBookingDialog(false)}>Cancelar</Button><Button onClick={saveBooking} disabled={bookingSaving}>{bookingSaving?'Agendando...':'Confirmar agendamento'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
