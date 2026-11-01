import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, Clock3, DoorOpen, Pencil, Plus, Users, Check, ChevronLeft, ChevronRight, Settings2, X } from 'lucide-react';
import { addDays, format, isSameDay, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

type Room = { id: string; name: string; capacity: number; opens_at: string; closes_at: string };
type Person = { id: string; user_id: string; name: string; display_name: string | null };
type Booking = { id: string; room_id: string; title: string; starts_at: string; ends_at: string; booked_by: string; notes: string | null };
type Participant = { booking_id: string; profile_id: string };

const timeLabel = (value: string) => value.slice(0, 5);
const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map(v => v[0]).join('').toUpperCase();

function RoomIllustration({ capacity, people, busy }: { capacity: number; people: number; busy: boolean }) {
  const seats = Array.from({ length: Math.min(capacity, 12) }, (_, i) => i);
  return <div className="ew-room-scene" aria-label={`Sala com capacidade para ${capacity} pessoas`}>
    <div className="ew-room-wall"><span className="ew-room-window" /><span className="ew-room-screen" /></div>
    <div className="ew-room-floor" />
    <div className="ew-room-table"><span /></div>
    {seats.map(i => {
      const angle = (Math.PI * 2 * i) / seats.length - Math.PI / 2;
      const x = 50 + Math.cos(angle) * 36;
      const y = 57 + Math.sin(angle) * 31;
      const occupied = busy && i < people;
      return <div key={i} className={`ew-room-seat ${occupied ? 'is-occupied' : ''}`} style={{ left: `${x}%`, top: `${y}%` }}>
        <span className="ew-room-seat-back" /><span className="ew-room-seat-base" />
      </div>;
    })}
    <span className="ew-room-capacity">{people}/{capacity} lugares</span>
  </div>;
}

export function MeetingRoomsSection() {
  const { profile, user, isAdmin, canAccess } = useAuth();
  const allowed = isAdmin || canAccess('can_access_meeting_rooms');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [selectedTime, setSelectedTime] = useState('');
  const [roomDialog, setRoomDialog] = useState(false);
  const [bookingDialog, setBookingDialog] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [roomName, setRoomName] = useState('');
  const [capacity, setCapacity] = useState('8');
  const [opensAt, setOpensAt] = useState('08:00');
  const [closesAt, setClosesAt] = useState('18:00');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('60');
  const [notes, setNotes] = useState('');
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!allowed || !profile?.company_id) { setLoading(false); return; }
    const db = supabase as any;
    const [r, b, p, part] = await Promise.all([
      db.from('meeting_rooms').select('id,name,capacity,opens_at,closes_at').eq('company_id', profile.company_id).eq('is_active', true).order('name'),
      db.from('meeting_bookings').select('id,room_id,title,starts_at,ends_at,booked_by,notes').eq('company_id', profile.company_id).gte('ends_at', new Date().toISOString()).order('starts_at'),
      db.from('profiles').select('id,user_id,name,display_name').eq('company_id', profile.company_id).eq('is_active', true).order('name'),
      db.from('meeting_booking_participants').select('booking_id,profile_id'),
    ]);
    if (r.error || b.error || p.error) toast.error('Não foi possível carregar os dados das salas.');
    else {
      setRooms(r.data || []); setBookings(b.data || []); setPeople(p.data || []);
      setParticipants(part.error ? [] : (part.data || []));
    }
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

  const roomBookings = useMemo(() => selectedRoom ? bookings.filter(b => b.room_id === selectedRoom.id && isSameDay(parseISO(b.starts_at), selectedDate)) : [], [bookings, selectedRoom, selectedDate]);
  const currentBooking = useMemo(() => selectedRoom ? bookings.find(b => b.room_id === selectedRoom.id && new Date() >= new Date(b.starts_at) && new Date() < new Date(b.ends_at)) : undefined, [bookings, selectedRoom]);
  const currentPeople = currentBooking ? participants.filter(p => p.booking_id === currentBooking.id).length : 0;
  const slots = useMemo(() => {
    if (!selectedRoom) return [];
    const start = timeLabel(selectedRoom.opens_at).split(':').map(Number);
    const end = timeLabel(selectedRoom.closes_at).split(':').map(Number);
    const from = start[0] * 60 + start[1], to = end[0] * 60 + end[1];
    const result: { time: string; available: boolean; booking?: Booking }[] = [];
    for (let minute = from; minute + 30 <= to; minute += 30) {
      const time = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
      const startAt = new Date(selectedDate); startAt.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
      const endAt = new Date(startAt.getTime() + 30 * 60000);
      const booking = roomBookings.find(b => startAt < new Date(b.ends_at) && endAt > new Date(b.starts_at));
      result.push({ time, available: !booking && startAt > new Date(), booking });
    }
    return result;
  }, [selectedRoom, selectedDate, roomBookings]);

  const openRoomEditor = (room?: Room) => {
    setEditing(room || null); setRoomName(room?.name || ''); setCapacity(String(room?.capacity || 8));
    setOpensAt(room ? timeLabel(room.opens_at) : '08:00'); setClosesAt(room ? timeLabel(room.closes_at) : '18:00'); setRoomDialog(true);
  };
  const saveRoom = async () => {
    if (!profile?.company_id || !user || !roomName.trim()) return;
    if (!Number.isInteger(Number(capacity)) || Number(capacity) < 1 || opensAt >= closesAt) { toast.error('Confira a capacidade e os horários.'); return; }
    setSaving(true);
    const payload = { name: roomName.trim(), capacity: Number(capacity), opens_at: opensAt, closes_at: closesAt, company_id: profile.company_id, updated_at: new Date().toISOString() };
    const db = supabase as any;
    const result = editing ? await db.from('meeting_rooms').update(payload).eq('id', editing.id) : await db.from('meeting_rooms').insert({ ...payload, created_by: user.id });
    setSaving(false);
    if (result.error) { toast.error('Não foi possível salvar a sala.'); return; }
    toast.success('Sala atualizada.'); setRoomDialog(false); void load();
  };

  const beginBooking = (time?: string) => {
    if (!selectedRoom) return;
    setTitle(''); setSelectedPeople([]); setNotes(''); setDuration('60');
    setSelectedTime(time || slots.find(s => s.available)?.time || timeLabel(selectedRoom.opens_at));
    setBookingDialog(true);
  };
  const saveBooking = async () => {
    if (!profile?.company_id || !selectedRoom || !title.trim() || !selectedTime || selectedPeople.length < 1) {
      toast.error('Preencha o assunto e selecione os participantes.'); return;
    }
    const mins = Number(duration);
    const [h, m] = selectedTime.split(':').map(Number);
    const start = new Date(selectedDate); start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + mins * 60000);
    if (!Number.isInteger(mins) || mins < 15 || mins > 720 || selectedPeople.length + 1 > selectedRoom.capacity) { toast.error('Confira duração e capacidade.'); return; }
    if (selectedTime < timeLabel(selectedRoom.opens_at) || format(end, 'HH:mm') > timeLabel(selectedRoom.closes_at) || start <= new Date()) { toast.error('Escolha um horário futuro dentro do funcionamento da sala.'); return; }
    if (bookings.some(b => b.room_id === selectedRoom.id && start < new Date(b.ends_at) && end > new Date(b.starts_at))) { toast.error('Este horário já está reservado.'); return; }
    setSaving(true);
    const db = supabase as any;
    const { data, error } = await db.from('meeting_bookings').insert({
      company_id: profile.company_id, room_id: selectedRoom.id, title: title.trim(),
      starts_at: start.toISOString(), ends_at: end.toISOString(), booked_by: profile.id, notes: notes.trim() || null,
    }).select('id').single();
    if (error || !data) { setSaving(false); toast.error('Não foi possível concluir o agendamento.'); return; }
    const ids = [...new Set([profile.id, ...selectedPeople])];
    const { error: participantError } = await db.from('meeting_booking_participants').insert(ids.map(profile_id => ({ booking_id: data.id, profile_id })));
    if (participantError) {
      await db.from('meeting_bookings').delete().eq('id', data.id);
      setSaving(false); toast.error('Falha ao adicionar participantes.'); return;
    }
    await Promise.all(selectedPeople.map(async id => {
      const person = people.find(p => p.id === id);
      if (person?.user_id) await db.rpc('create_user_notification', {
        _target_user_id: person.user_id, _type: 'meeting_room', _title: 'Reunião agendada',
        _message: `${profile.display_name || profile.name} agendou ${title.trim()} em ${selectedRoom.name}, ${format(start, 'dd/MM/yyyy HH:mm')}.`,
        _reference_id: data.id,
      });
    }));
    setSaving(false); setBookingDialog(false); toast.success('Reunião agendada.'); void load();
  };

  if (!allowed) return <div className="p-8 text-center text-sm text-muted-foreground">O administrador precisa liberar o acesso à Sala de Reunião.</div>;

  return <div className="ew-meetings min-h-full">
    <style>{`
      .ew-meetings{padding:clamp(18px,3vw,34px);color:#202938;background:#fff}
      .ew-meetings button{transition:background .16s ease,color .16s ease,transform .16s ease}
      .ew-meetings .ew-muted{color:#87909d}
      .ew-meetings .ew-room-card{border:0;background:#f7f8fa;border-radius:18px;overflow:hidden;transition:transform .2s ease,background .2s ease;cursor:pointer}
      .ew-meetings .ew-room-card:hover{transform:translateY(-3px);background:#f1f3f6}
      .ew-room-scene{height:220px;position:relative;overflow:hidden;background:linear-gradient(145deg,#f1f4f7,#e5eaf0);perspective:800px}
      .ew-room-wall{position:absolute;inset:0 9% 35%;background:linear-gradient(160deg,#fff,#e8edf2);clip-path:polygon(0 0,100% 0,100% 100%,0 75%)}
      .ew-room-window{position:absolute;left:12%;top:18%;width:24%;height:48%;border:5px solid #d8e0e8;border-radius:5px;background:linear-gradient(135deg,#d9eaf3,#f7fbff)}
      .ew-room-screen{position:absolute;right:12%;top:25%;width:20%;height:30%;border-radius:5px;background:#34445a;box-shadow:0 5px 0 #c5ced8}
      .ew-room-floor{position:absolute;left:-5%;right:-5%;bottom:-20%;height:66%;background:linear-gradient(150deg,#d9e0e7,#cbd4de);transform:rotateX(54deg);transform-origin:top}
      .ew-room-table{position:absolute;left:50%;top:54%;width:42%;height:29%;transform:translate(-50%,-50%) rotateX(58deg);border-radius:50%;background:linear-gradient(145deg,#b9c5d1,#8797a8);box-shadow:0 12px 0 #78899a,0 19px 22px #64748b55}
      .ew-room-table span{position:absolute;left:48%;top:15%;width:4%;height:70%;background:#718195;border-radius:9px}
      .ew-room-seat{position:absolute;width:22px;height:25px;transform:translate(-50%,-50%);z-index:3}
      .ew-room-seat-back{position:absolute;left:3px;top:0;width:16px;height:12px;border-radius:5px 5px 3px 3px;background:#9eabb9;box-shadow:0 2px 2px #64748b44}
      .ew-room-seat-base{position:absolute;left:0;top:10px;width:22px;height:12px;border-radius:5px;background:#c1cbd5;box-shadow:0 3px 0 #8998a8}
      .ew-room-seat.is-occupied .ew-room-seat-back,.ew-room-seat.is-occupied .ew-room-seat-base{background:#c89d63}
      .ew-room-capacity{position:absolute;right:13px;bottom:12px;font-size:11px;font-weight:600;color:#64748b;background:#ffffffd9;padding:5px 9px;border-radius:20px}
      .ew-meetings .ew-status{display:inline-flex;align-items:center;gap:6px;border-radius:20px;padding:5px 9px;font-size:11px;font-weight:600}
      .ew-meetings .ew-dot{width:7px;height:7px;border-radius:50%;background:#22a06b}
      .ew-meetings .ew-status.busy{background:#fff1e8;color:#b75b2b}.ew-meetings .ew-status.busy .ew-dot{background:#e28a4e}
      .ew-meetings .ew-status.free{background:#eaf6ef;color:#23794b}
      .ew-meetings .ew-time{border:0;border-radius:10px;background:#f3f5f7;color:#475467;padding:10px 6px;font-size:12px;text-align:center}
      .ew-meetings .ew-time:hover{background:#e8edf2}.ew-meetings .ew-time.selected{background:#26384e;color:#fff}
      .ew-meetings .ew-time:disabled{opacity:.38;cursor:not-allowed;text-decoration:line-through}
      .ew-meetings .ew-panel{background:#f7f8fa;border-radius:18px}
      .ew-meetings input,.ew-meetings textarea,.ew-meetings select{border-color:#e7eaee;border-radius:10px;box-shadow:none}
      .ew-meetings label{font-size:13px;color:#4b5563}
      @media(max-width:640px){.ew-room-scene{height:190px}}
    `}</style>

    {selectedRoom ? <div className="mx-auto max-w-6xl space-y-6">
      <button onClick={() => setSelectedRoom(null)} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft size={16}/> Todas as salas</button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-semibold tracking-tight text-slate-900">{selectedRoom.name}</h1><p className="mt-1 text-sm text-slate-500">Detalhes da sala e horários de utilização</p></div>
        <div className="flex items-center gap-2">
          <span className={`ew-status ${currentBooking ? 'busy' : 'free'}`}><i className="ew-dot"/>{currentBooking ? 'Em reunião' : 'Livre agora'}</span>
          {isAdmin && <Button variant="ghost" size="sm" onClick={() => openRoomEditor(selectedRoom)}><Pencil size={15} className="mr-2"/>Configurar sala</Button>}
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
        <div className="ew-panel overflow-hidden">
          <RoomIllustration capacity={selectedRoom.capacity} people={currentPeople} busy={!!currentBooking}/>
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div><p className="text-sm font-medium text-slate-800">Visão da sala</p><p className="mt-1 text-xs text-slate-500">Capacidade para {selectedRoom.capacity} pessoas</p></div>
            <div className="text-right"><p className="text-lg font-semibold text-slate-900">{currentPeople}<span className="text-sm font-normal text-slate-400">/{selectedRoom.capacity}</span></p><p className="text-xs text-slate-500">pessoas na reunião atual</p></div>
          </div>
          {currentBooking && <div className="mx-5 mb-5 rounded-xl bg-white px-4 py-3"><p className="text-sm font-medium text-slate-800">{currentBooking.title}</p><p className="mt-1 text-xs text-slate-500">{format(new Date(currentBooking.starts_at),'HH:mm')} até {format(new Date(currentBooking.ends_at),'HH:mm')}</p></div>}
        </div>
        <div className="space-y-5">
          <div className="flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Disponibilidade</h2><p className="mt-1 text-xs text-slate-500">Selecione uma data para ver os horários</p></div><Button size="sm" onClick={() => beginBooking()}><Plus size={15} className="mr-1"/> Agendar</Button></div>
          <div className="ew-panel p-4">
            <div className="mb-4 flex items-center justify-between"><button className="rounded-lg p-2 hover:bg-white" onClick={() => setSelectedDate(d => addDays(d,-1))}><ChevronLeft size={17}/></button><div className="text-center"><p className="text-sm font-semibold capitalize text-slate-800">{format(selectedDate,'EEEE',{locale:ptBR})}</p><p className="text-xs text-slate-500">{format(selectedDate,"dd 'de' MMMM",{locale:ptBR})}</p></div><button className="rounded-lg p-2 hover:bg-white" onClick={() => setSelectedDate(d => addDays(d,1))}><ChevronRight size={17}/></button></div>
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">{Array.from({length:7},(_,i)=>addDays(startOfDay(new Date()),i)).map(day=><button key={day.toISOString()} onClick={()=>setSelectedDate(day)} className={`min-w-11 rounded-xl px-2 py-2 text-center ${isSameDay(day,selectedDate)?'bg-slate-800 text-white':'bg-white text-slate-600 hover:bg-slate-100'}`}><span className="block text-[10px] uppercase">{format(day,'EEE',{locale:ptBR})}</span><span className="mt-1 block text-sm font-semibold">{format(day,'dd')}</span></button>)}</div>
            <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500"><span className="flex items-center gap-1"><i className="ew-dot"/> Livre</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-orange-400"/> Reservado</span><span className="ml-auto">Intervalos de 30 min</span></div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">{slots.map(slot=><button key={slot.time} disabled={!slot.available} onClick={()=>beginBooking(slot.time)} title={slot.booking?.title || (slot.available?'Disponível':'Indisponível')} className="ew-time">{slot.time}</button>)}</div>
            {!slots.length && <p className="py-5 text-center text-xs text-slate-500">Não há horários configurados.</p>}
            <p className="mt-4 text-xs text-slate-500">Funcionamento: {timeLabel(selectedRoom.opens_at)} às {timeLabel(selectedRoom.closes_at)}</p>
          </div>
        </div>
      </div>
      <section><h2 className="mb-3 font-semibold text-slate-900">Reuniões do dia</h2>{roomBookings.length ? <div className="divide-y divide-slate-100">{roomBookings.map(b=><div key={b.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium text-slate-800">{b.title}</p><p className="mt-1 text-xs text-slate-500">{format(new Date(b.starts_at),'HH:mm')} - {format(new Date(b.ends_at),'HH:mm')}</p></div><span className="text-xs text-slate-500">{participants.filter(p=>p.booking_id===b.id).length} participantes</span></div>)}</div>:<p className="py-5 text-sm text-slate-500">Nenhuma reunião nesta data.</p>}</section>
    </div> : <div className="mx-auto max-w-6xl space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-slate-400">Espaços da equipe</p><h1 className="text-2xl font-semibold tracking-tight text-slate-900">Salas de reunião</h1><p className="mt-1 text-sm text-slate-500">Consulte a disponibilidade e reserve um espaço.</p></div>{isAdmin && <Button onClick={()=>openRoomEditor()}><Plus size={16} className="mr-2"/> Nova sala</Button>}</header>
      <div className="flex flex-wrap gap-6 border-b border-slate-100 pb-5"><div><p className="text-2xl font-semibold text-slate-900">{rooms.length}</p><p className="text-xs text-slate-500">Salas ativas</p></div><div><p className="text-2xl font-semibold text-slate-900">{bookings.length}</p><p className="text-xs text-slate-500">Reservas futuras</p></div><div><p className="text-2xl font-semibold text-slate-900">{people.length}</p><p className="text-xs text-slate-500">Pessoas na equipe</p></div></div>
      {loading ? <p className="py-12 text-center text-sm text-slate-500">Carregando salas...</p> : rooms.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{rooms.map(room=>{
        const active=bookings.find(b=>b.room_id===room.id&&new Date()>=new Date(b.starts_at)&&new Date()<new Date(b.ends_at));
        const count=active?participants.filter(p=>p.booking_id===active.id).length:0;
        return <article key={room.id} className="ew-room-card" onClick={()=>{setSelectedRoom(room);setSelectedDate(startOfDay(new Date()));}}>
          <div className="relative"><RoomIllustration capacity={room.capacity} people={count} busy={!!active}/><span className={`ew-status absolute left-4 top-4 ${active?'busy':'free'}`}><i className="ew-dot"/>{active?'Ocupada':'Livre'}</span><button aria-label="Editar sala" onClick={e=>{e.stopPropagation();openRoomEditor(room);}} className={`absolute right-3 top-3 rounded-full bg-white/90 p-2 text-slate-600 hover:bg-white ${isAdmin?'':'hidden'}`}><Pencil size={14}/></button></div>
          <div className="p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-900">{room.name}</h2><p className="mt-1 text-xs text-slate-500">Até {room.capacity} pessoas</p></div><span className="text-xs text-slate-500">{timeLabel(room.opens_at)} - {timeLabel(room.closes_at)}</span></div><div className="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-3"><span className="text-xs text-slate-500">{active?active.title:'Consulte os horários'}</span><span className="text-xs font-semibold text-slate-700">Ver sala <span aria-hidden>→</span></span></div></div>
        </article>;
      })}</div>:<div className="rounded-2xl bg-slate-50 px-6 py-14 text-center"><DoorOpen className="mx-auto mb-3 text-slate-400" size={28}/><p className="font-medium text-slate-800">Nenhuma sala cadastrada</p><p className="mt-1 text-sm text-slate-500">Adicione uma sala para começar a organizar as reuniões.</p>{isAdmin&&<Button className="mt-4" onClick={()=>openRoomEditor()}><Plus size={16} className="mr-2"/> Cadastrar sala</Button>}</div>}
      <section><h2 className="mb-3 font-semibold text-slate-900">Próximas reuniões</h2>{bookings.length?<div className="divide-y divide-slate-100">{bookings.slice(0,6).map(b=><div key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium text-slate-800">{b.title}</p><p className="mt-1 text-xs text-slate-500">{rooms.find(r=>r.id===b.room_id)?.name||'Sala'} · {format(new Date(b.starts_at),"dd 'de' MMM, HH:mm",{locale:ptBR})}</p></div><span className="text-xs text-slate-500">{participants.filter(p=>p.booking_id===b.id).length} participantes</span></div>)}</div>:<p className="py-4 text-sm text-slate-500">Nenhuma reunião agendada.</p>}</section>
    </div>}

    {roomDialog&&<div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/35 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setRoomDialog(false);}}><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-lg font-semibold text-slate-900">{editing?'Configurar sala':'Adicionar sala'}</h2><p className="mt-1 text-sm text-slate-500">Capacidade e horário de funcionamento</p></div><button onClick={()=>setRoomDialog(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18}/></button></div><div className="space-y-4"><div><Label>Nome da sala</Label><Input value={roomName} onChange={e=>setRoomName(e.target.value)} maxLength={100}/></div><div><Label>Capacidade máxima</Label><Input type="number" min="1" value={capacity} onChange={e=>setCapacity(e.target.value)}/></div><div className="grid grid-cols-2 gap-3"><div><Label>Horário de abertura</Label><Input type="time" value={opensAt} onChange={e=>setOpensAt(e.target.value)}/></div><div><Label>Horário de fechamento</Label><Input type="time" value={closesAt} onChange={e=>setClosesAt(e.target.value)}/></div></div></div><div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={()=>setRoomDialog(false)}>Cancelar</Button><Button onClick={saveRoom} disabled={saving}>{saving?'Salvando...':'Salvar alterações'}</Button></div></div></div>}

    {bookingDialog&&selectedRoom&&<div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/35 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setBookingDialog(false);}}><div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-lg font-semibold text-slate-900">Agendar reunião</h2><p className="mt-1 text-sm text-slate-500">{selectedRoom.name} · {format(selectedDate,"dd 'de' MMMM",{locale:ptBR})}</p></div><button onClick={()=>setBookingDialog(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18}/></button></div><div className="space-y-4"><div><Label>Assunto da reunião</Label><Input value={title} onChange={e=>setTitle(e.target.value)} maxLength={160} placeholder="Ex.: Alinhamento semanal"/></div><div className="grid grid-cols-2 gap-3"><div><Label>Horário</Label><Input type="time" value={selectedTime} onChange={e=>setSelectedTime(e.target.value)}/></div><div><Label>Duração</Label><select className="h-10 w-full border bg-white px-3 text-sm" value={duration} onChange={e=>setDuration(e.target.value)}><option value="30">30 minutos</option><option value="60">1 hora</option><option value="90">1h30</option><option value="120">2 horas</option><option value="180">3 horas</option></select></div></div><div><Label>Participantes</Label><div className="mt-2 max-h-44 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3">{people.filter(p=>p.id!==profile?.id).map(p=><label key={p.id} className="flex items-center gap-2"><Checkbox checked={selectedPeople.includes(p.id)} onCheckedChange={v=>setSelectedPeople(old=>v?[...old,p.id]:old.filter(id=>id!==p.id))}/><span>{p.display_name||p.name}</span></label>)}</div><p className="mt-1 text-xs text-slate-500">Você também será incluído como participante. Limite: {selectedRoom.capacity} pessoas.</p></div><div><Label>Observações</Label><Textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="Informações adicionais (opcional)"/></div></div><div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={()=>setBookingDialog(false)}>Cancelar</Button><Button onClick={saveBooking} disabled={saving}>{saving?'Agendando...':'Confirmar agendamento'}</Button></div></div></div>}
  </div>;
}
