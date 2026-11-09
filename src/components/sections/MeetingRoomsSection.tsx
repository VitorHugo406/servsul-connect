import { PageHeader } from '@/components/common/PageHeader';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, DoorOpen, Pencil, Trash2, Plus, ChevronLeft, ChevronRight, X } from 'lucide-react';
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
import { appConfirm } from '@/lib/appDialog';

type Room = { id: string; name: string; capacity: number; opens_at: string; closes_at: string; image_url?: string | null };
type Person = { id: string; user_id: string; name: string; display_name: string | null };
type Booking = { id: string; room_id: string; title: string; starts_at: string; ends_at: string; booked_by: string; notes: string | null };
type Participant = { booking_id: string; profile_id: string };

const timeLabel = (value: string) => value.slice(0, 5);
const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map(v => v[0]).join('').toUpperCase();

function RoomIllustration({ capacity, people, imageUrl, roomName }: { capacity: number; people: number; imageUrl?: string | null; roomName?: string }) {
  return <div className="relative h-[220px] overflow-hidden bg-slate-100 sm:h-[220px]" aria-label={`Imagem da sala ${roomName || ''}; capacidade para ${capacity} pessoas`}>
    {imageUrl ? <img src={imageUrl} alt={roomName ? `Sala ${roomName}` : 'Imagem da sala'} className="h-full w-full object-cover" loading="lazy" />
      : <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 text-slate-400">
          <DoorOpen size={34} strokeWidth={1.3} />
          <span className="text-xs font-medium">Adicione uma foto desta sala</span>
        </div>}
    <span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm">{people}/{capacity} lugares</span>
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
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [roomName, setRoomName] = useState('');
  const [roomImage, setRoomImage] = useState<File | null>(null);
  const [roomImagePreview, setRoomImagePreview] = useState<string | null>(null);
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
    const [roomWithImages, b, p, part] = await Promise.all([
      db.from('meeting_rooms').select('id,name,capacity,opens_at,closes_at,image_url').eq('company_id', profile.company_id).eq('is_active', true).order('name'),
      db.from('meeting_bookings').select('id,room_id,title,starts_at,ends_at,booked_by,notes').eq('company_id', profile.company_id).gte('ends_at', new Date().toISOString()).order('starts_at'),
      db.from('profiles').select('id,user_id,name,display_name').eq('company_id', profile.company_id).eq('is_active', true).order('name'),
      db.from('meeting_booking_participants').select('booking_id,profile_id'),
    ]);
    // Keep existing rooms available while an environment is awaiting the image migration.
    const r = roomWithImages.error
      ? await db.from('meeting_rooms').select('id,name,capacity,opens_at,closes_at').eq('company_id', profile.company_id).eq('is_active', true).order('name')
      : roomWithImages;
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_booking_participants' }, () => void load())
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
    setEditing(room || null); setRoomName(room?.name || ''); setRoomImage(null); setRoomImagePreview(room?.image_url || null); setCapacity(String(room?.capacity || 8));
    setOpensAt(room ? timeLabel(room.opens_at) : '08:00'); setClosesAt(room ? timeLabel(room.closes_at) : '18:00'); setRoomDialog(true);
  };
  const saveRoom = async () => {
    if (!profile?.company_id || !user || !roomName.trim()) return;
    if (!Number.isInteger(Number(capacity)) || Number(capacity) < 1 || opensAt >= closesAt) { toast.error('Confira a capacidade e os horários.'); return; }
    setSaving(true);
    const payload = { name: roomName.trim(), capacity: Number(capacity), opens_at: opensAt, closes_at: closesAt, company_id: profile.company_id, updated_at: new Date().toISOString() };
    const db = supabase as any;
    const result = editing
      ? await db.from('meeting_rooms').update(payload).eq('id', editing.id).select('id').single()
      : await db.from('meeting_rooms').insert({ ...payload, created_by: user.id }).select('id').single();
    if (result.error || !result.data?.id) { setSaving(false); toast.error('Não foi possível salvar a sala.'); return; }
    let savedImageUrl = editing?.image_url || null;
    if (roomImage) {
      const extension = roomImage.type === 'image/png' ? 'png' : roomImage.type === 'image/webp' ? 'webp' : 'jpg';
      const imagePath = `${profile.company_id}/${result.data.id}/cover-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('meeting-room-images').upload(imagePath, roomImage, { upsert: false, contentType: roomImage.type, cacheControl: '31536000' });
      if (uploadError) { setSaving(false); toast.error(`Sala salva, mas a imagem não foi armazenada: ${uploadError.message}`); return; }
      const { data: publicData } = supabase.storage.from('meeting-room-images').getPublicUrl(imagePath);
      savedImageUrl = publicData.publicUrl;
      const { data: updatedRoom, error: imageError } = await db.from('meeting_rooms').update({ image_url: savedImageUrl }).eq('id', result.data.id).select('id').maybeSingle();
      if (imageError || !updatedRoom) { setSaving(false); toast.error(imageError?.message || 'A imagem foi enviada, mas não foi vinculada à sala.'); return; }
    }
    setSaving(false);
    toast.success(editing ? 'Sala atualizada.' : 'Sala criada.'); setRoomDialog(false); setRoomImage(null); setRoomImagePreview(null);
    await load();
    if (editing) setSelectedRoom(current => current?.id === result.data.id ? { ...current, ...payload, image_url: savedImageUrl } : current);
  };

  const deleteRoom = async () => {
    if (!editing || !(await appConfirm({ title: `Excluir a sala "${editing.name}"?`, message: 'As reuniões futuras dela serão canceladas.', confirmText: 'Excluir sala', danger: true }))) return;
    setSaving(true);
    const db = supabase as any;
    await db.from('meeting_bookings').delete().eq('room_id', editing.id).gte('starts_at', new Date().toISOString());
    const { error } = await db.from('meeting_rooms').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', editing.id);
    setSaving(false);
    if (error) { toast.error('Não foi possível excluir a sala.'); return; }
    toast.success('Sala excluída.'); setRoomDialog(false); setSelectedRoom(null); void load();
  };
  const canManageBooking = (b: Booking) => isAdmin || b.booked_by === profile?.id;
  const deleteBooking = async (b: Booking) => {
    if (!(await appConfirm({ title: `Cancelar a reunião "${b.title}"?`, confirmText: 'Cancelar reunião', cancelText: 'Voltar', danger: true }))) return;
    const { error } = await (supabase as any).from('meeting_bookings').delete().eq('id', b.id);
    if (error) { toast.error('Não foi possível cancelar a reunião.'); return; }
    toast.success('Reunião cancelada.'); setBookingDialog(false); void load();
  };
  const openBookingEditor = (b: Booking) => {
    const room = rooms.find(r => r.id === b.room_id); if (!room) return;
    const start = new Date(b.starts_at);
    setSelectedRoom(room); setSelectedDate(startOfDay(start)); setEditingBooking(b);
    setTitle(b.title); setNotes(b.notes || ''); setSelectedTime(format(start, 'HH:mm'));
    setDuration(String(Math.round((new Date(b.ends_at).getTime() - start.getTime()) / 60000)));
    setSelectedPeople(participants.filter(p => p.booking_id === b.id && p.profile_id !== profile?.id).map(p => p.profile_id));
    setBookingDialog(true);
  };
  const beginBooking = (time?: string) => {
    if (!selectedRoom) return;
    setEditingBooking(null); setTitle(''); setSelectedPeople([]); setNotes(''); setDuration('60');
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
    if (bookings.some(b => b.id !== editingBooking?.id && b.room_id === selectedRoom.id && start < new Date(b.ends_at) && end > new Date(b.starts_at))) { toast.error('Este horário já está reservado.'); return; }
    setSaving(true);
    const db = supabase as any;
    if (editingBooking) {
      const { error: upErr } = await db.from('meeting_bookings').update({ title: title.trim(), starts_at: start.toISOString(), ends_at: end.toISOString(), notes: notes.trim() || null }).eq('id', editingBooking.id);
      if (upErr) { setSaving(false); toast.error(upErr.message || 'Não foi possível atualizar a reunião.'); return; }
      const owner = editingBooking.booked_by;
      await db.from('meeting_booking_participants').delete().eq('booking_id', editingBooking.id);
      const ids = [...new Set([owner, ...selectedPeople])];
      const { error: pErr } = await db.from('meeting_booking_participants').insert(ids.map(profile_id => ({ booking_id: editingBooking.id, profile_id })));
      setSaving(false);
      if (pErr) { toast.error('Reunião atualizada, mas houve falha nos participantes.'); return; }
      setBookingDialog(false); setEditingBooking(null); toast.success('Reunião atualizada.'); void load(); return;
    }
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
      .ew-meetings{padding:clamp(10px,1.4vw,18px);color:#202938;background:#fff}
      .ew-meetings button{transition:background .16s ease,color .16s ease,transform .16s ease}
      .ew-meetings .ew-muted{color:#87909d}
      .ew-meetings .ew-room-card{border:0;background:#f7f8fa;border-radius:18px;overflow:hidden;transition:transform .2s ease,background .2s ease;cursor:pointer}
      .ew-meetings .ew-room-card:hover{transform:translateY(-3px);background:#f1f3f6}
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

    {selectedRoom ? <div className="mx-auto max-w-[1400px] space-y-6">
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
          <RoomIllustration capacity={selectedRoom.capacity} people={currentPeople} imageUrl={selectedRoom.image_url} roomName={selectedRoom.name}/>
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
      <section><h2 className="mb-3 font-semibold text-slate-900">Reuniões do dia</h2>{roomBookings.length ? <div className="divide-y divide-slate-100">{roomBookings.map(b=><div key={b.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium text-slate-800">{b.title}</p><p className="mt-1 text-xs text-slate-500">{format(new Date(b.starts_at),'HH:mm')} - {format(new Date(b.ends_at),'HH:mm')}</p></div><span className="flex items-center gap-2 text-xs text-slate-500">{participants.filter(p=>p.booking_id===b.id).length} participantes{canManageBooking(b)&&<span className="flex gap-1"><button aria-label="Editar reunião" onClick={()=>openBookingEditor(b)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><Pencil size={14}/></button><button aria-label="Cancelar reunião" onClick={()=>void deleteBooking(b)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={14}/></button></span>}</span></div>)}</div>:<p className="py-5 text-sm text-slate-500">Nenhuma reunião nesta data.</p>}</section>
    </div> : <div className="mx-auto max-w-[1400px] space-y-7">
      <PageHeader eyebrow="Espaços da equipe" icon={<DoorOpen />} title="Salas de reunião" subtitle="Consulte a disponibilidade e reserve um espaço." actions={isAdmin ? <Button onClick={()=>openRoomEditor()}><Plus size={16} className="mr-2"/> Nova sala</Button> : null} />
      <div className="flex flex-wrap gap-6 border-b border-slate-100 pb-5"><div><p className="text-2xl font-semibold text-slate-900">{rooms.length}</p><p className="text-xs text-slate-500">Salas ativas</p></div><div><p className="text-2xl font-semibold text-slate-900">{bookings.length}</p><p className="text-xs text-slate-500">Reservas futuras</p></div><div><p className="text-2xl font-semibold text-slate-900">{people.length}</p><p className="text-xs text-slate-500">Pessoas na equipe</p></div></div>
      {loading ? <p className="py-12 text-center text-sm text-slate-500">Carregando salas...</p> : rooms.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{rooms.map(room=>{
        const active=bookings.find(b=>b.room_id===room.id&&new Date()>=new Date(b.starts_at)&&new Date()<new Date(b.ends_at));
        const count=active?participants.filter(p=>p.booking_id===active.id).length:0;
        return <article key={room.id} className="ew-room-card" onClick={()=>{setSelectedRoom(room);setSelectedDate(startOfDay(new Date()));}}>
          <div className="relative"><RoomIllustration capacity={room.capacity} people={count} imageUrl={room.image_url} roomName={room.name}/><span className={`ew-status absolute left-4 top-4 ${active?'busy':'free'}`}><i className="ew-dot"/>{active?'Ocupada':'Livre'}</span><button aria-label="Editar sala" onClick={e=>{e.stopPropagation();openRoomEditor(room);}} className={`absolute right-3 top-3 rounded-full bg-white/90 p-2 text-slate-600 hover:bg-white ${isAdmin?'':'hidden'}`}><Pencil size={14}/></button></div>
          <div className="p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-900">{room.name}</h2><p className="mt-1 text-xs text-slate-500">Até {room.capacity} pessoas</p></div><span className="text-xs text-slate-500">{timeLabel(room.opens_at)} - {timeLabel(room.closes_at)}</span></div><div className="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-3"><span className="text-xs text-slate-500">{active?active.title:'Consulte os horários'}</span><span className="text-xs font-semibold text-slate-700">Ver sala <span aria-hidden>→</span></span></div></div>
        </article>;
      })}</div>:<div className="rounded-2xl bg-slate-50 px-6 py-14 text-center"><DoorOpen className="mx-auto mb-3 text-slate-400" size={28}/><p className="font-medium text-slate-800">Nenhuma sala cadastrada</p><p className="mt-1 text-sm text-slate-500">Adicione uma sala para começar a organizar as reuniões.</p>{isAdmin&&<Button className="mt-4" onClick={()=>openRoomEditor()}><Plus size={16} className="mr-2"/> Cadastrar sala</Button>}</div>}
      <section><h2 className="mb-3 font-semibold text-slate-900">Próximas reuniões</h2>{bookings.length?<div className="divide-y divide-slate-100">{bookings.slice(0,6).map(b=><div key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium text-slate-800">{b.title}</p><p className="mt-1 text-xs text-slate-500">{rooms.find(r=>r.id===b.room_id)?.name||'Sala'} · {format(new Date(b.starts_at),"dd 'de' MMM, HH:mm",{locale:ptBR})}</p></div><span className="flex items-center gap-2 text-xs text-slate-500">{participants.filter(p=>p.booking_id===b.id).length} participantes{canManageBooking(b)&&<span className="flex gap-1"><button aria-label="Editar reunião" onClick={()=>openBookingEditor(b)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><Pencil size={14}/></button><button aria-label="Cancelar reunião" onClick={()=>void deleteBooking(b)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={14}/></button></span>}</span></div>)}</div>:<p className="py-4 text-sm text-slate-500">Nenhuma reunião agendada.</p>}</section>
    </div>}

    {roomDialog&&<div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/35 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setRoomDialog(false);}}><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-lg font-semibold text-slate-900">{editing?'Configurar sala':'Adicionar sala'}</h2><p className="mt-1 text-sm text-slate-500">Capacidade e horário de funcionamento</p></div><button onClick={()=>setRoomDialog(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18}/></button></div><div className="space-y-4"><div><Label>Nome da sala</Label><Input value={roomName} onChange={e=>setRoomName(e.target.value)} maxLength={100}/></div><div><Label>Imagem da sala (opcional)</Label><input type="file" accept="image/jpeg,image/png,image/webp" className="block w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-medium" onChange={e=>{const f=e.target.files?.[0]||null;if(f && f.size>5*1024*1024){toast.error('A imagem deve ter no máximo 5 MB.');e.target.value='';return;}setRoomImage(f);setRoomImagePreview(f?URL.createObjectURL(f):editing?.image_url||null);}}/><p className="mt-1 text-[11px] text-slate-400">JPG, PNG ou WebP. Até 5 MB.</p>{roomImagePreview&&<div className="relative mt-2 overflow-hidden rounded-xl"><img src={roomImagePreview} alt="Prévia da imagem da sala" className="h-36 w-full object-cover"/><button type="button" onClick={()=>{setRoomImage(null);setRoomImagePreview(null);}} className="absolute right-2 top-2 rounded-full bg-white/90 px-3 py-1 text-xs text-slate-700">Remover</button></div>}</div><div><Label>Capacidade máxima</Label><Input type="number" min="1" value={capacity} onChange={e=>setCapacity(e.target.value)}/></div><div className="grid grid-cols-2 gap-3"><div><Label>Horário de abertura</Label><Input type="time" value={opensAt} onChange={e=>setOpensAt(e.target.value)}/></div><div><Label>Horário de fechamento</Label><Input type="time" value={closesAt} onChange={e=>setClosesAt(e.target.value)}/></div></div></div><div className="mt-6 flex justify-end gap-2">{editing&&<Button variant="ghost" className="mr-auto text-red-600" onClick={()=>void deleteRoom()} disabled={saving}><Trash2 size={15} className="mr-1"/>Excluir sala</Button>}<Button variant="ghost" onClick={()=>setRoomDialog(false)}>Cancelar</Button><Button onClick={saveRoom} disabled={saving}>{saving?'Salvando...':'Salvar alterações'}</Button></div></div></div>}

    {bookingDialog&&selectedRoom&&<div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/35 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setBookingDialog(false);}}><div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-lg font-semibold text-slate-900">{editingBooking?'Editar reunião':'Agendar reunião'}</h2><p className="mt-1 text-sm text-slate-500">{selectedRoom.name} · {format(selectedDate,"dd 'de' MMMM",{locale:ptBR})}</p></div><button onClick={()=>setBookingDialog(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18}/></button></div><div className="space-y-4"><div><Label>Assunto da reunião</Label><Input value={title} onChange={e=>setTitle(e.target.value)} maxLength={160} placeholder="Ex.: Alinhamento semanal"/></div><div className="grid grid-cols-2 gap-3"><div><Label>Horário</Label><Input type="time" value={selectedTime} onChange={e=>setSelectedTime(e.target.value)}/></div><div><Label>Duração</Label><select className="h-10 w-full border bg-white px-3 text-sm" value={duration} onChange={e=>setDuration(e.target.value)}><option value="30">30 minutos</option><option value="60">1 hora</option><option value="90">1h30</option><option value="120">2 horas</option><option value="180">3 horas</option></select></div></div><div><Label>Participantes</Label><div className="mt-2 max-h-44 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3">{people.filter(p=>p.id!==profile?.id).map(p=><label key={p.id} className="flex items-center gap-2"><Checkbox checked={selectedPeople.includes(p.id)} onCheckedChange={v=>setSelectedPeople(old=>v?[...old,p.id]:old.filter(id=>id!==p.id))}/><span>{p.display_name||p.name}</span></label>)}</div><p className="mt-1 text-xs text-slate-500">Você também será incluído como participante. Limite: {selectedRoom.capacity} pessoas.</p></div><div><Label>Observações</Label><Textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="Informações adicionais (opcional)"/></div></div><div className="mt-6 flex justify-end gap-2">{editingBooking&&<Button variant="ghost" className="mr-auto text-red-600" onClick={()=>void deleteBooking(editingBooking)}><Trash2 size={15} className="mr-1"/>Cancelar reunião</Button>}<Button variant="ghost" onClick={()=>setBookingDialog(false)}>Cancelar</Button><Button onClick={saveBooking} disabled={saving}>{saving?'Salvando...':editingBooking?'Salvar alterações':'Confirmar agendamento'}</Button></div></div></div>}
  </div>;
}
