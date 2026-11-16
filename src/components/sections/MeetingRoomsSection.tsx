import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { addDays, format, isSameDay, parseISO, startOfDay, startOfWeek } from 'date-fns';
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
import { Sel } from '@/components/ui/Sel';

type Room = { id: string; name: string; capacity: number; opens_at: string; closes_at: string; image_url?: string | null };
type Person = { id: string; user_id: string; name: string; display_name: string | null };
type Booking = { id: string; room_id: string; title: string; starts_at: string; ends_at: string; booked_by: string; notes: string | null };
type Participant = { booking_id: string; profile_id: string };

const timeLabel = (value: string) => value.slice(0, 5);
const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map(v => v[0]).join('').toUpperCase();

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
  const [pick, setPick] = useState('');
  const [tab, setTab] = useState<'all' | 'free' | 'busy'>('all');
  const [roomQuery, setRoomQuery] = useState('');

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

  const nameOfPerson = (id: string) => { const x = people.find(pp => pp.id === id); return x ? (x.display_name || x.name) : '—'; };
  const Av = ({ id }: { id: string }) => { const n = nameOfPerson(id); const admin = false; return <span className={`mr-mav${admin ? ' mr-sa' : ''}`}>{initials(n) || '?'}</span>; };
  const Door = ({ size = 30 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 21V4a1 1 0 0 1 1-1h8v18M14 21h6V8l-6-2M3 21h18M11 12h.01" /></svg>;
  const PencilIc = ({ size = 16 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z" /></svg>;
  const PlusIc = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
  const now0 = new Date();
  const activeOf = (roomId: string) => bookings.find(b => b.room_id === roomId && now0 >= new Date(b.starts_at) && now0 < new Date(b.ends_at));
  const nextOf = (roomId: string) => bookings.find(b => b.room_id === roomId && new Date(b.starts_at) > now0);
  const freeCount = rooms.filter(r => !activeOf(r.id)).length;
  const busyCount = rooms.length - freeCount;
  const shownRooms = rooms.filter(r => (tab === 'all' || (tab === 'free' ? !activeOf(r.id) : !!activeOf(r.id))) && (!roomQuery.trim() || r.name.toLowerCase().includes(roomQuery.toLowerCase())));
  const lowerFirst = (t: string) => t.replace('.', '');

  // seleção de horário (grade de 30 min): o início escolhido + 1h, limitado aos horários livres seguidos
  const pickIdx = slots.findIndex(sl => sl.time === pick);
  const pickRange = pickIdx < 0 ? [] : slots.slice(pickIdx, pickIdx + 2).filter((sl, i, arr) => sl.available && arr.slice(0, i).every(x => x.available));
  const pickEnd = pickRange.length ? (() => { const [h, m] = pickRange[pickRange.length - 1].time.split(':').map(Number); const t = h * 60 + m + 30; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; })() : '';
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayStart = startOfDay(new Date());

  return <div className={`dk-pg ${selectedRoom ? 'mx-pg' : 'mr-pg'}`}>
    <style>{`
      .mr-pg .fixed input,.mx-pg .fixed input,.mr-pg .fixed textarea,.mx-pg .fixed textarea{border-color:hsl(var(--border));border-radius:12px;box-shadow:none}
      .mr-pg .fixed label,.mx-pg .fixed label{font-size:13px;color:hsl(var(--muted-foreground))}
    `}</style>

    {selectedRoom ? <>
      <button type="button" className="mx-back" onClick={() => setSelectedRoom(null)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>Todas as salas</button>
      <header className="mx-panel mx-top">
        <div className="mx-tile"><Door /></div>
        <div><h1>{selectedRoom.name}</h1><div className="mx-sub">Até {selectedRoom.capacity} pessoas · {timeLabel(selectedRoom.opens_at)} às {timeLabel(selectedRoom.closes_at)}</div></div>
        <div className="mx-acts">
          <span className="mx-live" style={currentBooking ? { color: '#8A4B00', background: '#FEF5E4', borderColor: '#E3C48F' } : undefined}>{currentBooking ? 'Em reunião' : 'Livre agora'}</span>
          {isAdmin && <button type="button" className="mx-btn" onClick={() => openRoomEditor(selectedRoom)}><PencilIc /> Configurar sala</button>}
          <button type="button" className="mx-btn mx-pri" onClick={() => beginBooking()}><PlusIc />Agendar</button>
        </div>
      </header>

      <div className="mx-main">
        <div className="mx-col">
          <section className="mx-panel">
            <div className="mx-ph">
              {selectedRoom.image_url ? <img src={selectedRoom.image_url} alt={`Sala ${selectedRoom.name}`} /> : <div className="mx-pe"><Door /><span>Adicione uma foto desta sala</span></div>}
              <span className="mx-ls">{currentPeople}/{selectedRoom.capacity} lugares</span>
            </div>
            <div className="mx-vs">
              <div><b>Visão da sala</b><span>Capacidade para {selectedRoom.capacity} pessoas</span>{currentBooking && <span style={{ display: 'block', marginTop: 4 }}>{currentBooking.title} · até {format(new Date(currentBooking.ends_at), 'HH:mm')}</span>}</div>
              <div className="mx-oc"><strong>{currentPeople}<small>/{selectedRoom.capacity}</small></strong><div style={{ color: '#4A5563', fontSize: 12.5 }}>pessoas na reunião atual</div>
                <div className="mx-seats">{Array.from({ length: Math.min(selectedRoom.capacity, 24) }, (_, i) => <i key={i} className={i < currentPeople ? 'mx-f' : ''} />)}</div></div>
            </div>
          </section>

          <section className="mx-panel">
            <div className="mx-sh">Reuniões do dia<span className="mx-shs">{format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}</span></div>
            {roomBookings.length === 0 && <div className="mr-empty" style={{ padding: '24px' }}>Nenhuma reunião nesta data.</div>}
            {roomBookings.map(b => (
              <div key={b.id} className="mx-mr">
                <div className="mx-hh">{format(new Date(b.starts_at), 'HH:mm')} – {format(new Date(b.ends_at), 'HH:mm')}</div>
                <div><div className="mx-tt">{b.title}</div><div className="mx-sa">{participants.filter(pp => pp.booking_id === b.id).length} pessoas</div></div>
                <div className="mx-og"><span className="mx-mav">{initials(nameOfPerson(b.booked_by)) || '?'}</span>{nameOfPerson(b.booked_by)}</div>
                <div className="mx-ia">{canManageBooking(b) && <><button type="button" className="mx-ic" aria-label="Editar reunião" onClick={() => openBookingEditor(b)}><PencilIc /></button><button type="button" className="mx-tx" onClick={() => void deleteBooking(b)}>Cancelar</button></>}</div>
              </div>
            ))}
          </section>
        </div>

        <section className="mx-panel mx-av" aria-label="Disponibilidade">
          <div><h2>Disponibilidade</h2><p>Selecione uma data para ver os horários</p></div>
          <div className="mx-nav">
            <button type="button" aria-label="Dia anterior" onClick={() => { setSelectedDate(d => addDays(d, -1)); setPick(''); }}><ChevronLeft size={16} /></button>
            <div><b style={{ textTransform: 'capitalize' }}>{format(selectedDate, 'EEEE', { locale: ptBR }).replace('-feira', '')}</b><span>{format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</span></div>
            <button type="button" aria-label="Próximo dia" onClick={() => { setSelectedDate(d => addDays(d, 1)); setPick(''); }}><ChevronRight size={16} /></button>
          </div>
          <div className="mx-wk">{weekDays.map(day => {
            const has = bookings.some(b => b.room_id === selectedRoom.id && isSameDay(parseISO(b.starts_at), day));
            const past = day < todayStart;
            return <button key={day.toISOString()} type="button" className={`mx-dy${isSameDay(day, selectedDate) ? ' mx-on' : ''}${past ? ' mx-pst' : ''}`} onClick={() => { setSelectedDate(day); setPick(''); }}>
              <span>{format(day, 'EEEE', { locale: ptBR }).replace('-feira', '')}</span><b>{format(day, 'dd')}</b>{has && <i />}</button>;
          })}</div>
          <div className="mx-lg"><span><i style={{ background: '#0A6B3D' }} />Livre</span><span><i style={{ background: '#C77700' }} />Reservado</span><span><i style={{ background: '#171A21' }} />Selecionado</span><em>Intervalos de 30 min</em></div>
          <div className="mx-gr">{slots.map(slot => {
            const sel = pickRange.some(x => x.time === slot.time);
            return <button key={slot.time} type="button" disabled={!slot.available} aria-pressed={sel} aria-label={`${slot.time} ${slot.booking ? 'reservado' : slot.available ? 'livre' : 'indisponível'}`}
              title={slot.booking?.title} className={`mx-sl${slot.booking ? ' mx-rs' : ''}${sel ? ' mx-sel' : ''}`} onClick={() => setPick(slot.time)}>{slot.time}</button>;
          })}</div>
          {!slots.length && <p style={{ textAlign: 'center' }}>Não há horários configurados.</p>}
          <div className="mx-sm">
            <span>{pickRange.length ? <><b>Selecionado:</b> {pickRange[0].time} – {pickEnd} ({pickRange.length * 30 >= 60 ? `${pickRange.length / 2}h`.replace('.5', 'h30') : '30min'})</> : 'Escolha um horário livre'}</span>
            <button type="button" className="mx-btn mx-pri" disabled={!pickRange.length} onClick={() => { beginBooking(pickRange[0].time); setDuration(String(pickRange.length * 30)); }}>Agendar horário</button>
          </div>
          <div className="mx-ft"><span>Funcionamento: {timeLabel(selectedRoom.opens_at)} às {timeLabel(selectedRoom.closes_at)}</span></div>
        </section>
      </div>
    </> : <>
      <div className="mr-bar">
        <div className="mr-tabs">
          <button type="button" className={`mr-tab${tab === 'all' ? ' mr-on' : ''}`} onClick={() => setTab('all')}>Todas<b>{rooms.length}</b></button>
          <button type="button" className={`mr-tab${tab === 'free' ? ' mr-on' : ''}`} onClick={() => setTab('free')}>Livres agora<b>{freeCount}</b></button>
          <button type="button" className={`mr-tab${tab === 'busy' ? ' mr-on' : ''}`} onClick={() => setTab('busy')}>Em uso<b>{busyCount}</b></button>
        </div>
        <div className="mr-rt">
          <input className="mr-srch" type="text" placeholder="Buscar sala" aria-label="Buscar sala" value={roomQuery} onChange={e => setRoomQuery(e.target.value)} />
          {isAdmin && <button type="button" className="mr-btn mr-pri" onClick={() => openRoomEditor()}><PlusIc />Nova sala</button>}
        </div>
      </div>
      <div className="mr-panel mr-kp">
        {([['Salas ativas', rooms.length], ['Reservas futuras', bookings.length], ['Pessoas na equipe', people.length]] as const).map(([label, value]) => <div key={label} className="mr-k"><span>{label}</span><b>{value}</b></div>)}
      </div>
      {loading ? <div className="mr-empty">Carregando salas...</div> : shownRooms.length ? <div className="mr-gd">{shownRooms.map(room => {
        const active = activeOf(room.id); const next = nextOf(room.id);
        const count = active ? participants.filter(pp => pp.booking_id === active.id).length : 0;
        return <article key={room.id} className="mr-rm" onClick={() => { setSelectedRoom(room); setSelectedDate(startOfDay(new Date())); setPick(''); }}>
          <div className="mr-ph">
            {room.image_url && <img src={room.image_url} alt={`Sala ${room.name}`} loading="lazy" />}
            <span className={`mr-sp ${active ? 'mr-us' : 'mr-fr'}`}>{active ? 'Em uso' : 'Livre'}</span>
            {isAdmin && <button type="button" className="mr-ed" aria-label="Editar sala" onClick={e => { e.stopPropagation(); openRoomEditor(room); }}><PencilIc /></button>}
            {!room.image_url && <div className="mr-pe"><Door /><span>Adicione uma foto desta sala</span></div>}
            <span className="mr-ls">{count}/{room.capacity} lugares</span>
          </div>
          <div className="mr-bd">
            <div className="mr-r1"><div><div className="mr-nm">{room.name}</div><div className="mr-su">Até {room.capacity} pessoas</div></div><div className="mr-hr">{timeLabel(room.opens_at)} - {timeLabel(room.closes_at)}</div></div>
            <div className="mr-r2"><span className="mr-in">{active ? `${active.title} · livre às ${format(new Date(active.ends_at), 'HH:mm')}` : next ? `Próxima reunião: ${lowerFirst(format(new Date(next.starts_at), 'EEE dd/MM, HH:mm', { locale: ptBR }))}` : 'Sem reuniões agendadas'}</span><span className="mr-vs">Ver sala →</span></div>
          </div>
        </article>;
      })}</div> : <div className="mr-panel mr-empty">
        <b style={{ display: 'block', color: '#1C2430', marginBottom: 4 }}>{rooms.length ? 'Nenhuma sala encontrada' : 'Nenhuma sala cadastrada'}</b>
        {rooms.length ? 'Ajuste o filtro ou a busca.' : 'Adicione uma sala para começar a organizar as reuniões.'}
      </div>}
      <section className="mr-panel"><div className="mr-sh">Próximas reuniões</div>
        {bookings.length === 0 && <div className="mr-empty" style={{ padding: 24 }}>Nenhuma reunião agendada.</div>}
        {bookings.slice(0, 6).map(b => {
          const st = new Date(b.starts_at);
          return <div key={b.id} className="mr-mr" onClick={() => { const r = rooms.find(x => x.id === b.room_id); if (r) { setSelectedRoom(r); setSelectedDate(startOfDay(st)); setPick(''); } }}>
            <div className="mr-dd"><b>{format(st, 'dd')}</b><span>{format(st, 'EEE', { locale: ptBR }).replace('.', '')}</span></div>
            <div className="mr-hh">{format(st, 'HH:mm')} – {format(new Date(b.ends_at), 'HH:mm')}</div>
            <div className="mr-tt">{b.title}</div>
            <div className="mr-sa">{rooms.find(r => r.id === b.room_id)?.name || 'Sala'}</div>
            <div className="mr-og"><Av id={b.booked_by} />{nameOfPerson(b.booked_by)}</div>
            <div className="mr-pt">{participants.filter(pp => pp.booking_id === b.id).length} pessoas</div>
            <span className="mr-cf">Confirmada</span>
          </div>;
        })}
      </section>
    </>}

    {roomDialog&&<div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/35 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setRoomDialog(false);}}><div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-lg font-semibold text-foreground">{editing?'Configurar sala':'Adicionar sala'}</h2><p className="mt-1 text-sm text-muted-foreground">Capacidade e horário de funcionamento</p></div><button onClick={()=>setRoomDialog(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={18}/></button></div><div className="space-y-4"><div><Label>Nome da sala</Label><Input value={roomName} onChange={e=>setRoomName(e.target.value)} maxLength={100}/></div><div><Label>Imagem da sala (opcional)</Label><input type="file" accept="image/jpeg,image/png,image/webp" className="block w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-2 text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-medium" onChange={e=>{const f=e.target.files?.[0]||null;if(f && f.size>5*1024*1024){toast.error('A imagem deve ter no máximo 5 MB.');e.target.value='';return;}setRoomImage(f);setRoomImagePreview(f?URL.createObjectURL(f):editing?.image_url||null);}}/><p className="mt-1 text-[11px] text-muted-foreground">JPG, PNG ou WebP. Até 5 MB.</p>{roomImagePreview&&<div className="relative mt-2 overflow-hidden rounded-xl"><img src={roomImagePreview} alt="Prévia da imagem da sala" className="h-36 w-full object-cover"/><button type="button" onClick={()=>{setRoomImage(null);setRoomImagePreview(null);}} className="absolute right-2 top-2 rounded-full bg-white/90 px-3 py-1 text-xs text-foreground">Remover</button></div>}</div><div><Label>Capacidade máxima</Label><Input type="number" min="1" value={capacity} onChange={e=>setCapacity(e.target.value)}/></div><div className="grid grid-cols-2 gap-3"><div><Label>Horário de abertura</Label><Input type="time" value={opensAt} onChange={e=>setOpensAt(e.target.value)}/></div><div><Label>Horário de fechamento</Label><Input type="time" value={closesAt} onChange={e=>setClosesAt(e.target.value)}/></div></div></div><div className="mt-6 flex justify-end gap-2">{editing&&<Button variant="ghost" className="mr-auto text-red-600" onClick={()=>void deleteRoom()} disabled={saving}><Trash2 size={15} className="mr-1"/>Excluir sala</Button>}<Button variant="ghost" onClick={()=>setRoomDialog(false)}>Cancelar</Button><Button onClick={saveRoom} disabled={saving}>{saving?'Salvando...':'Salvar alterações'}</Button></div></div></div>}

    {bookingDialog&&selectedRoom&&<div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/35 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setBookingDialog(false);}}><div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-lg font-semibold text-foreground">{editingBooking?'Editar reunião':'Agendar reunião'}</h2><p className="mt-1 text-sm text-muted-foreground">{selectedRoom.name} · {format(selectedDate,"dd 'de' MMMM",{locale:ptBR})}</p></div><button onClick={()=>setBookingDialog(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={18}/></button></div><div className="space-y-4"><div><Label>Assunto da reunião</Label><Input value={title} onChange={e=>setTitle(e.target.value)} maxLength={160} placeholder="Ex.: Alinhamento semanal"/></div><div className="grid grid-cols-2 gap-3"><div><Label>Horário</Label><Input type="time" value={selectedTime} onChange={e=>setSelectedTime(e.target.value)}/></div><div><Label>Duração</Label><Sel className="h-10 w-full border bg-white px-3 text-sm" value={duration} onChange={e=>setDuration(e.target.value)}><option value="30">30 minutos</option><option value="60">1 hora</option><option value="90">1h30</option><option value="120">2 horas</option><option value="180">3 horas</option></Sel></div></div><div><Label>Participantes</Label><div className="mt-2 max-h-44 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3">{people.filter(p=>p.id!==profile?.id).map(p=><label key={p.id} className="flex items-center gap-2"><Checkbox checked={selectedPeople.includes(p.id)} onCheckedChange={v=>setSelectedPeople(old=>v?[...old,p.id]:old.filter(id=>id!==p.id))}/><span>{p.display_name||p.name}</span></label>)}</div><p className="mt-1 text-xs text-muted-foreground">Você também será incluído como participante. Limite: {selectedRoom.capacity} pessoas.</p></div><div><Label>Observações</Label><Textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="Informações adicionais (opcional)"/></div></div><div className="mt-6 flex justify-end gap-2">{editingBooking&&<Button variant="ghost" className="mr-auto text-red-600" onClick={()=>void deleteBooking(editingBooking)}><Trash2 size={15} className="mr-1"/>Cancelar reunião</Button>}<Button variant="ghost" onClick={()=>setBookingDialog(false)}>Cancelar</Button><Button onClick={saveBooking} disabled={saving}>{saving?'Salvando...':editingBooking?'Salvar alterações':'Confirmar agendamento'}</Button></div></div></div>}
  </div>;
}
