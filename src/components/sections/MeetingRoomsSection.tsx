import { useCallback, useEffect, useState } from 'react';
import { DoorOpen, CalendarDays, Clock3, Users, Plus, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

type Room = { id: string; name: string; capacity: number; opens_at: string; closes_at: string; };
type Person = { id: string; user_id: string; name: string; display_name: string | null; };
type Booking = { id: string; room_id: string; title: string; starts_at: string; ends_at: string; booked_by: string; notes: string | null; };

export function MeetingRoomsSection() {
  const { profile, user, isAdmin, canAccess } = useAuth();
  const allowed = isAdmin || canAccess('can_access_meeting_rooms');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [roomOpen, setRoomOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [roomName, setRoomName] = useState('');
  const [capacity, setCapacity] = useState('8');
  const [opensAt, setOpensAt] = useState('08:00');
  const [closesAt, setClosesAt] = useState('18:00');
  const [roomId, setRoomId] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState('60');
  const [notes, setNotes] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!allowed || !profile?.company_id) { setLoading(false); return; }
    setLoading(true);
    const db = supabase as any;
    const [r, b, p] = await Promise.all([
      db.from('meeting_rooms').select('id,name,capacity,opens_at,closes_at').eq('company_id', profile.company_id).eq('is_active', true).order('name'),
      db.from('meeting_bookings').select('id,room_id,title,starts_at,ends_at,booked_by,notes').eq('company_id', profile.company_id).gte('ends_at', new Date().toISOString()).order('starts_at'),
      db.from('profiles').select('id,user_id,name,display_name').eq('company_id', profile.company_id).eq('is_active', true).order('name'),
    ]);
    if (r.error || b.error || p.error) toast.error('Não foi possível carregar as salas e reuniões.');
    else { setRooms(r.data || []); setBookings(b.data || []); setPeople(p.data || []); }
    setLoading(false);
  }, [allowed, profile?.company_id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!allowed || !profile?.company_id) return;
    const channel = supabase.channel('meeting-rooms-live-' + profile.company_id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_rooms', filter: 'company_id=eq.' + profile.company_id }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_bookings', filter: 'company_id=eq.' + profile.company_id }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [allowed, profile?.company_id, load]);

  const openRoom = (room?: Room) => {
    setEditing(room || null); setRoomName(room?.name || ''); setCapacity(String(room?.capacity || 8));
    setOpensAt(room?.opens_at?.slice(0, 5) || '08:00'); setClosesAt(room?.closes_at?.slice(0, 5) || '18:00'); setRoomOpen(true);
  };
  const saveRoom = async () => {
    if (!profile?.company_id || !user || !roomName.trim()) return;
    if (!Number.isInteger(Number(capacity)) || Number(capacity) < 1 || opensAt >= closesAt) { toast.error('Confira a capacidade e os horários.'); return; }
    setSaving(true);
    const payload = { name: roomName.trim(), capacity: Number(capacity), opens_at: opensAt, closes_at: closesAt, company_id: profile.company_id, updated_at: new Date().toISOString() };
    const db = supabase as any;
    const result = editing ? await db.from('meeting_rooms').update(payload).eq('id', editing.id) : await db.from('meeting_rooms').insert({ ...payload, created_by: user.id });
    setSaving(false);
    if (result.error) { toast.error('Falha ao salvar sala. Verifique se a migration foi aplicada.'); return; }
    toast.success('Sala salva.'); setRoomOpen(false); void load();
  };
  const saveBooking = async () => {
    if (!profile?.company_id || !roomId || !title.trim() || !date || selected.length < 1) { toast.error('Preencha os dados e selecione participantes.'); return; }
    const room = rooms.find(r => r.id === roomId);
    const mins = Number(duration);
    const start = new Date(date + 'T' + time + ':00');
    const end = new Date(start.getTime() + mins * 60000);
    if (!room || !Number.isInteger(mins) || mins < 15 || mins > 720 || selected.length + 1 > room.capacity) { toast.error('Confira duração e capacidade da sala.'); return; }
    if (time < room.opens_at.slice(0,5) || format(end, 'HH:mm') > room.closes_at.slice(0,5) || start <= new Date()) { toast.error('A reunião precisa ocorrer no horário de funcionamento e no futuro.'); return; }
    if (bookings.some(b => b.room_id === roomId && start < new Date(b.ends_at) && end > new Date(b.starts_at))) { toast.error('Já existe uma reunião nesse horário.'); return; }
    setSaving(true);
    const db = supabase as any;
    const { data, error } = await db.from('meeting_bookings').insert({ company_id: profile.company_id, room_id: roomId, title: title.trim(), starts_at: start.toISOString(), ends_at: end.toISOString(), booked_by: profile.id, notes: notes.trim() || null }).select('id').single();
    if (error || !data) { setSaving(false); toast.error('Não foi possível agendar. Verifique a migration.'); return; }
    const participantIds = [...new Set([profile.id, ...selected])];
    const { error: participantError } = await db.from('meeting_booking_participants').insert(participantIds.map(profile_id => ({ booking_id: data.id, profile_id })));
    if (participantError) { await db.from('meeting_bookings').delete().eq('id', data.id); setSaving(false); toast.error('Falha ao registrar participantes.'); return; }
    await Promise.all(selected.map(async id => {
      const person = people.find(p => p.id === id);
      if (!person?.user_id) return;
      await db.rpc('create_user_notification', { _target_user_id: person.user_id, _type: 'meeting_room', _title: 'Sala de reunião agendada', _message: (profile.display_name || profile.name) + ' agendou ' + title.trim() + ' na sala ' + room.name + ', em ' + format(start, 'dd/MM/yyyy HH:mm') + ', duração de ' + mins + ' minutos.', _reference_id: data.id });
    }));
    setSaving(false); setBookingOpen(false); toast.success('Reunião agendada e participantes notificados.'); void load();
  };

  if (!allowed) return <div className="p-6"><Card className="mx-auto max-w-lg"><CardContent className="p-8 text-center"><DoorOpen className="mx-auto mb-3 h-8 w-8"/><h2 className="font-semibold">Acesso restrito</h2><p className="mt-2 text-sm text-muted-foreground">O administrador principal precisa liberar esta aba nas permissões do usuário.</p></CardContent></Card></div>;

  return <div className="h-full overflow-auto p-4 md:p-6"><div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-semibold"><DoorOpen className="h-6 w-6"/>Sala de Reunião</h1><p className="text-sm text-muted-foreground">Salas, disponibilidade e agendamentos da equipe.</p></div><Button onClick={() => { setRoomId(rooms[0]?.id || ''); setTitle(''); setDate(format(new Date(), 'yyyy-MM-dd')); setTime('09:00'); setDuration('60'); setNotes(''); setSelected([]); setBookingOpen(true); }} disabled={!rooms.length}><Plus className="mr-2 h-4 w-4"/>Agendar reunião</Button></header>
    <div className="grid gap-3 sm:grid-cols-3"><Card><CardContent className="flex items-center gap-3 p-4"><DoorOpen/><div><p className="text-xs text-muted-foreground">Salas ativas</p><p className="text-xl font-semibold">{rooms.length}</p></div></CardContent></Card><Card><CardContent className="flex items-center gap-3 p-4"><CalendarDays/><div><p className="text-xs text-muted-foreground">Próximas reuniões</p><p className="text-xl font-semibold">{bookings.length}</p></div></CardContent></Card><Card><CardContent className="flex items-center gap-3 p-4"><Users/><div><p className="text-xs text-muted-foreground">Participantes disponíveis</p><p className="text-xl font-semibold">{people.length}</p></div></CardContent></Card></div>
    <section className="space-y-3"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Salas cadastradas</h2><p className="text-xs text-muted-foreground">Capacidade e horário de funcionamento</p></div>{isAdmin && <Button variant="outline" size="sm" onClick={() => openRoom()}><Plus className="mr-2 h-4 w-4"/>Nova sala</Button>}</div>
      {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p> : rooms.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhuma sala cadastrada.</CardContent></Card> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{rooms.map(room => <Card key={room.id}><CardContent className="space-y-3 p-4"><div className="flex items-start justify-between"><div><h3 className="font-semibold">{room.name}</h3><p className="text-sm text-muted-foreground">Até {room.capacity} pessoas</p></div>{isAdmin && <Button variant="ghost" size="icon" onClick={() => openRoom(room)}><Pencil className="h-4 w-4"/></Button>}</div><p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-4 w-4"/>{room.opens_at.slice(0,5)} às {room.closes_at.slice(0,5)}</p><Button className="w-full" variant="outline" onClick={() => { setRoomId(room.id); setTitle(''); setDate(format(new Date(), 'yyyy-MM-dd')); setTime('09:00'); setDuration('60'); setNotes(''); setSelected([]); setBookingOpen(true); }}>Agendar nesta sala</Button></CardContent></Card>)}</div>}
    </section>
    <section className="space-y-3"><h2 className="font-semibold">Próximas reuniões</h2>{bookings.length === 0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhuma reunião agendada.</CardContent></Card> : <div className="space-y-2">{bookings.map(b => <Card key={b.id}><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium">{b.title}</p><p className="text-xs text-muted-foreground">{rooms.find(r => r.id === b.room_id)?.name || 'Sala'} · {format(new Date(b.starts_at), "dd 'de' MMMM, HH:mm", { locale: ptBR })}</p></div><span className="text-xs text-muted-foreground">{Math.round((new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000)} min</span></CardContent></Card>)}</div>}</section>
  </div>
  <Dialog open={roomOpen} onOpenChange={setRoomOpen}><DialogContent><DialogHeader><DialogTitle>{editing ? 'Editar sala' : 'Nova sala'}</DialogTitle><DialogDescription>Defina capacidade e horário de funcionamento.</DialogDescription></DialogHeader><div className="space-y-3"><div><Label>Nome da sala</Label><Input value={roomName} onChange={e=>setRoomName(e.target.value)} maxLength={100}/></div><div><Label>Capacidade máxima</Label><Input type="number" min="1" value={capacity} onChange={e=>setCapacity(e.target.value)}/></div><div className="grid grid-cols-2 gap-3"><div><Label>Abertura</Label><Input type="time" value={opensAt} onChange={e=>setOpensAt(e.target.value)}/></div><div><Label>Fechamento</Label><Input type="time" value={closesAt} onChange={e=>setClosesAt(e.target.value)}/></div></div></div><DialogFooter><Button variant="outline" onClick={()=>setRoomOpen(false)}>Cancelar</Button><Button onClick={saveRoom} disabled={saving}>{saving?'Salvando...':'Salvar sala'}</Button></DialogFooter></DialogContent></Dialog>
  <Dialog open={bookingOpen} onOpenChange={setBookingOpen}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Agendar reunião</DialogTitle><DialogDescription>Escolha sala, horário e participantes.</DialogDescription></DialogHeader><div className="space-y-3"><div><Label>Assunto</Label><Input value={title} onChange={e=>setTitle(e.target.value)} maxLength={160}/></div><div><Label>Sala</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={roomId} onChange={e=>setRoomId(e.target.value)}>{rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></div><div className="grid grid-cols-3 gap-2"><div><Label>Data</Label><Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div><div><Label>Horário</Label><Input type="time" value={time} onChange={e=>setTime(e.target.value)}/></div><div><Label>Duração (min)</Label><Input type="number" min="15" max="720" step="15" value={duration} onChange={e=>setDuration(e.target.value)}/></div></div><div><Label>Observações</Label><Textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2}/></div><div className="space-y-2"><Label>Participantes</Label><div className="max-h-44 space-y-2 overflow-y-auto rounded-md border p-3">{people.filter(p=>p.id!==profile?.id).map(p=><label key={p.id} className="flex items-center gap-2 text-sm"><Checkbox checked={selected.includes(p.id)} onCheckedChange={v=>setSelected(old=>v?[...old,p.id]:old.filter(id=>id!==p.id))}/>{p.display_name||p.name}</label>)}</div></div></div><DialogFooter><Button variant="outline" onClick={()=>setBookingOpen(false)}>Cancelar</Button><Button onClick={saveBooking} disabled={saving}>{saving?'Agendando...':'Confirmar agendamento'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
