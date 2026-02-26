import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, Plus, Trash2, Clock, Bell, ListTodo, Edit, X, Users, Link2, ChevronLeft, ChevronRight, Video, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, eachDayOfInterval, addDays, isSameMonth, addWeeks, subWeeks, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string | null;
  all_day: boolean;
  color: string;
  reminder_minutes: number | null;
  meeting_link: string | null;
  task_id: string | null;
  created_by: string;
  created_at: string;
  participants?: Participant[];
}

interface Participant {
  id: string;
  profile_id: string;
  status: string;
  profile?: { id: string; name: string; display_name: string | null; avatar_url: string | null };
}

interface TaskDeadline {
  id: string;
  title: string;
  due_date: string;
  priority: string;
  task_number: number;
}

interface UserProfile {
  id: string;
  name: string;
  display_name: string | null;
  avatar_url: string | null;
  user_id: string;
}

// No "meeting" in reminder create - meetings only via dedicated button
const EVENT_TYPES_FOR_CREATE = [
  { id: 'reminder', label: 'Lembrete', color: '#F59E0B' },
  { id: 'event', label: 'Evento', color: '#10B981' },
  { id: 'deadline', label: 'Prazo', color: '#EF4444' },
];

const ALL_EVENT_TYPES = [
  { id: 'meeting', label: 'Reunião', color: '#3B82F6' },
  ...EVENT_TYPES_FOR_CREATE,
];

const EVENT_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function CalendarSection() {
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [taskDeadlines, setTaskDeadlines] = useState<TaskDeadline[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  // Full-page create state
  const [showCreatePage, setShowCreatePage] = useState<'event' | 'meeting' | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState('reminder');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:00');
  const [allDay, setAllDay] = useState(false);
  const [color, setColor] = useState('#F59E0B');
  const [reminderMinutes, setReminderMinutes] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase.from('profiles').select('id, name, display_name, avatar_url, user_id').eq('is_active', true);
      setAllUsers((data || []) as UserProfile[]);
    };
    fetchUsers();
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const start = startOfMonth(subMonths(currentMonth, 1));
      const end = endOfMonth(addMonths(currentMonth, 1));
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .gte('start_date', start.toISOString())
        .lte('start_date', end.toISOString())
        .order('start_date', { ascending: true });
      if (error) throw error;

      const eventIds = (data || []).map(e => e.id);
      let participantsMap: Record<string, Participant[]> = {};
      if (eventIds.length > 0) {
        const { data: parts } = await supabase
          .from('meeting_participants')
          .select('*')
          .in('event_id', eventIds);
        if (parts && parts.length > 0) {
          const profileIds = [...new Set(parts.map(p => p.profile_id))];
          const { data: profiles } = await supabase.from('profiles').select('id, name, display_name, avatar_url').in('id', profileIds);
          const profileMap = new Map((profiles || []).map(p => [p.id, p]));
          for (const p of parts) {
            if (!participantsMap[p.event_id]) participantsMap[p.event_id] = [];
            participantsMap[p.event_id].push({ ...p, profile: profileMap.get(p.profile_id) } as Participant);
          }
        }
      }

      setEvents((data || []).map(e => ({ ...e, participants: participantsMap[e.id] || [] })) as CalendarEvent[]);
    } catch (e) {
      console.error('Error fetching events:', e);
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  const fetchTaskDeadlines = useCallback(async () => {
    try {
      const start = startOfMonth(subMonths(currentMonth, 1));
      const end = endOfMonth(addMonths(currentMonth, 1));
      const { data } = await supabase
        .from('tasks')
        .select('id, title, due_date, priority, task_number')
        .not('due_date', 'is', null)
        .gte('due_date', start.toISOString())
        .lte('due_date', end.toISOString())
        .eq('is_archived', false)
        .order('due_date', { ascending: true });
      setTaskDeadlines((data || []) as TaskDeadline[]);
    } catch (e) {
      console.error('Error fetching task deadlines:', e);
    }
  }, [currentMonth]);

  useEffect(() => { fetchEvents(); fetchTaskDeadlines(); }, [fetchEvents, fetchTaskDeadlines]);

  const resetForm = () => {
    setTitle(''); setDescription(''); setEventType('reminder');
    setStartDate(''); setStartTime('09:00'); setEndDate(''); setEndTime('10:00');
    setAllDay(false); setColor('#F59E0B'); setReminderMinutes(''); setMeetingLink('');
    setSelectedParticipants([]); setEditingEvent(null); setHasUnsavedChanges(false);
  };

  const openCreateEvent = (date?: Date) => {
    resetForm();
    setEventType('reminder');
    setColor('#F59E0B');
    if (date) {
      setStartDate(format(date, 'yyyy-MM-dd'));
      setEndDate(format(date, 'yyyy-MM-dd'));
    }
    setShowCreatePage('event');
  };

  const openCreateMeeting = (date?: Date) => {
    resetForm();
    setEventType('meeting');
    setColor('#3B82F6');
    if (date) {
      setStartDate(format(date, 'yyyy-MM-dd'));
      setEndDate(format(date, 'yyyy-MM-dd'));
    }
    setShowCreatePage('meeting');
  };

  const openEdit = (event: CalendarEvent) => {
    setTitle(event.title);
    setDescription(event.description || '');
    setEventType(event.event_type);
    setStartDate(format(new Date(event.start_date), 'yyyy-MM-dd'));
    setStartTime(format(new Date(event.start_date), 'HH:mm'));
    setEndDate(event.end_date ? format(new Date(event.end_date), 'yyyy-MM-dd') : '');
    setEndTime(event.end_date ? format(new Date(event.end_date), 'HH:mm') : '10:00');
    setAllDay(event.all_day);
    setColor(event.color);
    setReminderMinutes(event.reminder_minutes?.toString() || '');
    setMeetingLink(event.meeting_link || '');
    setSelectedParticipants(event.participants?.map(p => p.profile_id) || []);
    setEditingEvent(event);
    setShowCreatePage(event.event_type === 'meeting' ? 'meeting' : 'event');
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      if (!confirm('Descartar alterações?')) return;
    }
    resetForm();
    setShowCreatePage(null);
  };

  const handleSave = async () => {
    if (!title.trim() || !startDate) { toast.error('Título e data são obrigatórios'); return; }

    const startDateTime = allDay
      ? new Date(`${startDate}T00:00:00`).toISOString()
      : new Date(`${startDate}T${startTime}:00`).toISOString();

    const endDateTime = endDate
      ? (allDay ? new Date(`${endDate}T23:59:59`).toISOString() : new Date(`${endDate}T${endTime}:00`).toISOString())
      : null;

    const eventData: any = {
      title: title.trim(),
      description: description.trim() || null,
      event_type: eventType,
      start_date: startDateTime,
      end_date: endDateTime,
      all_day: allDay,
      color,
      reminder_minutes: reminderMinutes ? parseInt(reminderMinutes) : null,
      meeting_link: meetingLink.trim() || null,
      created_by: user!.id,
    };

    try {
      let eventId: string;
      if (editingEvent) {
        const { error } = await supabase.from('calendar_events').update(eventData).eq('id', editingEvent.id);
        if (error) throw error;
        eventId = editingEvent.id;
        await supabase.from('meeting_participants').delete().eq('event_id', eventId);
      } else {
        const { data, error } = await supabase.from('calendar_events').insert(eventData).select().single();
        if (error) throw error;
        eventId = data.id;
      }

      if (selectedParticipants.length > 0) {
        const parts = selectedParticipants.map(pid => ({ event_id: eventId, profile_id: pid }));
        await supabase.from('meeting_participants').insert(parts);
      }

      toast.success(editingEvent ? 'Evento atualizado!' : 'Evento criado!');
      resetForm();
      setShowCreatePage(null);
      fetchEvents();
    } catch (e) {
      toast.error('Erro ao salvar evento');
      console.error(e);
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Excluir este evento?')) return;
    try {
      await supabase.from('calendar_events').delete().eq('id', eventId);
      toast.success('Evento excluído');
      fetchEvents();
    } catch (e) {
      toast.error('Erro ao excluir');
    }
  };

  const handleRespondInvite = async (eventId: string, status: 'accepted' | 'declined') => {
    if (!profile) return;
    try {
      await supabase.from('meeting_participants').update({ status, responded_at: new Date().toISOString() })
        .eq('event_id', eventId).eq('profile_id', profile.id);
      toast.success(status === 'accepted' ? 'Convite aceito!' : 'Convite recusado');
      fetchEvents();
    } catch (e) {
      toast.error('Erro ao responder');
    }
  };

  const toggleParticipant = (profileId: string) => {
    setSelectedParticipants(prev =>
      prev.includes(profileId) ? prev.filter(p => p !== profileId) : [...prev, profileId]
    );
    setHasUnsavedChanges(true);
  };

  const goToToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentMonth(today);
    setWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
  };

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const weekDays = useMemo(() => {
    return eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  }, [weekStart]);

  const getEventsForDate = (date: Date) => events.filter(e => isSameDay(new Date(e.start_date), date));
  const getTasksForDate = (date: Date) => taskDeadlines.filter(t => isSameDay(new Date(t.due_date), date));
  const getAllDayEventsForDate = (date: Date) => events.filter(e => e.all_day && isSameDay(new Date(e.start_date), date));
  const getTimedEventsForDate = (date: Date) => events.filter(e => !e.all_day && isSameDay(new Date(e.start_date), date));
  const getEventHour = (event: CalendarEvent) => new Date(event.start_date).getHours();

  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-blue-500', low: 'bg-gray-500',
  };

  const myInvites = events.filter(e =>
    e.participants?.some(p => p.profile_id === profile?.id && p.status === 'pending')
  );

  const navigateMonth = (dir: number) => setCurrentMonth(prev => dir > 0 ? addMonths(prev, 1) : subMonths(prev, 1));
  const navigateWeek = (dir: number) => setWeekStart(prev => dir > 0 ? addWeeks(prev, 1) : subWeeks(prev, 1));

  const selectedDateEvents = getEventsForDate(selectedDate);
  const selectedDateTasks = getTasksForDate(selectedDate);

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  // ========== FULL PAGE CREATE/EDIT ==========
  if (showCreatePage) {
    const isMeeting = showCreatePage === 'meeting';
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col h-full">
        <div className="flex items-center gap-2 p-4 border-b border-border bg-background">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h2 className="font-semibold text-foreground">
              {editingEvent ? 'Editar' : 'Novo'} {isMeeting ? 'Reunião' : 'Evento'}
            </h2>
          </div>
          <Button variant="outline" onClick={handleBack}>Cancelar</Button>
          <Button onClick={handleSave} className="gap-1">
            {isMeeting && <Video className="h-4 w-4" />}
            {editingEvent ? 'Salvar' : isMeeting ? 'Agendar Reunião' : 'Criar Evento'}
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-5">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={title} onChange={e => { setTitle(e.target.value); setHasUnsavedChanges(true); }} placeholder={isMeeting ? 'Ex: Reunião semanal' : 'Título do evento'} className="text-lg" />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={e => { setDescription(e.target.value); setHasUnsavedChanges(true); }} placeholder={isMeeting ? 'Pauta da reunião...' : 'Descrição opcional'} rows={3} />
            </div>

            {!isMeeting && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={eventType} onValueChange={v => { setEventType(v); setHasUnsavedChanges(true); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES_FOR_CREATE.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Lembrete (min)</Label>
                  <Input type="number" value={reminderMinutes} onChange={e => { setReminderMinutes(e.target.value); setHasUnsavedChanges(true); }} placeholder="Ex: 15" />
                </div>
              </div>
            )}

            {isMeeting && (
              <div className="space-y-2">
                <Label>Link da reunião (Meet, Zoom, etc.)</Label>
                <Input value={meetingLink} onChange={e => { setMeetingLink(e.target.value); setHasUnsavedChanges(true); }} placeholder="https://meet.google.com/..." />
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox id="allDay" checked={allDay} onCheckedChange={(c) => { setAllDay(!!c); setHasUnsavedChanges(true); }} />
              <Label htmlFor="allDay" className="text-sm cursor-pointer">Dia inteiro</Label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data Início *</Label>
                <Input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value); setHasUnsavedChanges(true); }} />
              </div>
              {!allDay && (
                <div className="space-y-2">
                  <Label>Hora Início</Label>
                  <Input type="time" value={startTime} onChange={e => { setStartTime(e.target.value); setHasUnsavedChanges(true); }} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setHasUnsavedChanges(true); }} />
              </div>
              {!allDay && (
                <div className="space-y-2">
                  <Label>Hora Fim</Label>
                  <Input type="time" value={endTime} onChange={e => { setEndTime(e.target.value); setHasUnsavedChanges(true); }} />
                </div>
              )}
            </div>

            {/* Participants for meetings */}
            {isMeeting && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Users className="h-4 w-4" /> Convidar Participantes</Label>
                <div className="border rounded-lg p-2 max-h-[250px] overflow-y-auto space-y-1">
                  {allUsers.filter(u => u.user_id !== user?.id).map(u => (
                    <label key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer">
                      <Checkbox checked={selectedParticipants.includes(u.id)} onCheckedChange={() => toggleParticipant(u.id)} />
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={u.avatar_url || ''} />
                        <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                          {getInitials(u.display_name || u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{u.display_name || u.name}</span>
                    </label>
                  ))}
                </div>
                {selectedParticipants.length > 0 && (
                  <p className="text-xs text-muted-foreground">{selectedParticipants.length} participante(s) selecionado(s)</p>
                )}
              </div>
            )}

            {/* Availability grid for meetings */}
            {isMeeting && selectedParticipants.length > 0 && startDate && (
              <div className="space-y-2">
                <Label>Horários dos participantes</Label>
                <div className="border rounded-lg p-3 overflow-x-auto">
                  <div className="grid gap-1" style={{ gridTemplateColumns: `60px repeat(${selectedParticipants.length + 1}, minmax(60px, 1fr))` }}>
                    <div className="text-xs font-medium text-muted-foreground">Hora</div>
                    <div className="text-xs font-medium text-center truncate">Você</div>
                    {selectedParticipants.map(pid => {
                      const u = allUsers.find(u => u.id === pid);
                      return <div key={pid} className="text-xs font-medium text-center truncate">{u?.display_name || u?.name || '?'}</div>;
                    })}
                    {[8, 9, 10, 11, 13, 14, 15, 16, 17, 18].map(hour => {
                      const timeStr = `${hour.toString().padStart(2, '0')}:00`;
                      const dateObj = new Date(`${startDate}T${timeStr}:00`);
                      const myBusy = events.some(e => {
                        if (e.created_by !== user?.id && !e.participants?.some(p => p.profile_id === profile?.id)) return false;
                        return isSameDay(new Date(e.start_date), dateObj) && new Date(e.start_date).getHours() === hour;
                      });
                      return (
                        <React.Fragment key={hour}>
                          <div className="text-xs text-muted-foreground py-1">{timeStr}</div>
                          <div className="text-center">
                            {myBusy
                              ? <span className="text-[10px] text-red-500 font-medium">Ocupado</span>
                              : <Button variant="outline" size="sm" className="h-6 text-[10px] w-full"
                                  onClick={() => { setStartTime(timeStr); setEndTime(`${(hour + 1).toString().padStart(2, '0')}:00`); setHasUnsavedChanges(true); }}>
                                  Livre
                                </Button>
                            }
                          </div>
                          {selectedParticipants.map(pid => {
                            const pBusy = events.some(e => {
                              const isParticipant = e.participants?.some(p => p.profile_id === pid);
                              const isCreator = allUsers.find(u => u.id === pid)?.user_id === e.created_by;
                              if (!isParticipant && !isCreator) return false;
                              return isSameDay(new Date(e.start_date), dateObj) && new Date(e.start_date).getHours() === hour;
                            });
                            return (
                              <div key={pid} className="text-center">
                                {pBusy
                                  ? <span className="text-[10px] text-red-500 font-medium">Ocupado</span>
                                  : <span className="text-[10px] text-green-600 font-medium">Livre</span>
                                }
                              </div>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {EVENT_COLORS.map(c => (
                  <button key={c} onClick={() => { setColor(c); setHasUnsavedChanges(true); }}
                    className={cn('w-7 h-7 rounded-full border-2 transition-all', color === c ? 'border-foreground ring-2 ring-primary/30' : 'border-transparent')}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </motion.div>
    );
  }

  // ========== MAIN CALENDAR VIEW ==========
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-4 border-b border-border flex-shrink-0">
        <div>
          <h3 className="font-display text-xl font-bold text-foreground">Calendário</h3>
          <p className="text-muted-foreground text-xs">Reuniões, lembretes e prazos</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {myInvites.length > 0 && (
            <Badge variant="destructive" className="gap-1">
              <Bell className="h-3 w-3" /> {myInvites.length} convite(s)
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={goToToday}>Hoje</Button>
          <Button variant="outline" size="sm" onClick={() => openCreateMeeting(selectedDate)} className="gap-1">
            <Video className="h-3.5 w-3.5" /> Reunião
          </Button>
          <Button size="sm" onClick={() => openCreateEvent(selectedDate)} className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Evento
          </Button>
        </div>
      </div>

      {/* View mode tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="flex flex-col flex-1 overflow-hidden">
        <div className="px-4 pt-2 flex-shrink-0">
          <TabsList>
            <TabsTrigger value="month">Mês</TabsTrigger>
            <TabsTrigger value="week">Semana</TabsTrigger>
            <TabsTrigger value="day">Dia</TabsTrigger>
          </TabsList>
        </div>

        {/* MONTH VIEW - Desktop: calendar + right panel, Mobile: full width */}
        <TabsContent value="month" className="flex-1 overflow-hidden mt-0 p-4">
          <div className={cn('h-full', isMobile ? 'overflow-y-auto space-y-3' : 'flex gap-4')}>
            {/* Calendar grid */}
            <div className={cn(isMobile ? 'w-full' : 'flex-1 flex flex-col')}>
              <div className="flex items-center justify-between mb-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <button onClick={goToToday} className="text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer capitalize">
                  {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                </button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {/* Day names */}
              <div className="grid grid-cols-7 gap-px mb-px">
                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
                  <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
                ))}
              </div>
              {/* Day grid - compact to fit without scroll */}
              <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden flex-1">
                {monthDays.map(day => {
                  const dayEvents = getEventsForDate(day);
                  const dayTasks = getTasksForDate(day);
                  const allDayEvents = getAllDayEventsForDate(day);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelected = isSameDay(day, selectedDate);
                  const isTodayDate = isToday(day);
                  const hasItems = dayEvents.length > 0 || dayTasks.length > 0;

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        'p-0.5 flex flex-col items-center relative transition-colors',
                        isMobile ? 'min-h-[44px]' : 'min-h-[48px]',
                        isCurrentMonth ? 'bg-background' : 'bg-muted/30',
                        isSelected && 'ring-2 ring-primary ring-inset',
                        isTodayDate && 'bg-primary/5',
                      )}
                      style={allDayEvents.length > 0 ? { boxShadow: `inset 0 0 0 2px ${allDayEvents[0].color}` } : undefined}
                    >
                      <span className={cn(
                        'text-[10px] md:text-xs font-medium w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full',
                        isTodayDate && 'bg-primary text-primary-foreground',
                        !isCurrentMonth && 'text-muted-foreground/50',
                      )}>
                        {format(day, 'd')}
                      </span>
                      <div className="flex gap-0.5 flex-wrap justify-center mt-px">
                        {dayEvents.slice(0, 3).map((e, i) => (
                          <span key={i} className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full" style={{ backgroundColor: e.color }} />
                        ))}
                        {dayTasks.slice(0, 2).map((t, i) => (
                          <span key={`t${i}`} className={cn('w-1 h-1 md:w-1.5 md:h-1.5 rounded-full', priorityColors[t.priority])} />
                        ))}
                      </div>
                      {hasItems && dayEvents.length + dayTasks.length > 3 && (
                        <span className="text-[7px] text-muted-foreground leading-none">+{dayEvents.length + dayTasks.length - 3}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right panel - selected day details */}
            <div className={cn(isMobile ? 'w-full' : 'w-[320px] flex-shrink-0 overflow-y-auto')}>
              <Card className="h-full">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                    {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  {selectedDateEvents.length === 0 && selectedDateTasks.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <CalendarIcon className="h-6 w-6 mx-auto mb-1.5 opacity-50" />
                      <p className="text-xs">Nenhum evento</p>
                      <Button variant="link" size="sm" onClick={() => openCreateEvent(selectedDate)} className="mt-1 text-xs h-auto p-0">Criar evento</Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedDateEvents.map(event => (
                        <div key={event.id} className="flex items-start gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                          <div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: event.color }} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-xs">{event.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <Badge variant="outline" className="text-[9px] h-4">
                                {ALL_EVENT_TYPES.find(t => t.id === event.event_type)?.label}
                              </Badge>
                              {!event.all_day && (
                                <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                                  <Clock className="h-2.5 w-2.5" />
                                  {format(new Date(event.start_date), 'HH:mm')}
                                  {event.end_date && ` - ${format(new Date(event.end_date), 'HH:mm')}`}
                                </span>
                              )}
                              {event.all_day && <Badge variant="secondary" className="text-[9px] h-4">Dia inteiro</Badge>}
                              {event.meeting_link && (
                                <a href={event.meeting_link} target="_blank" rel="noopener noreferrer"
                                  className="text-[9px] text-primary flex items-center gap-0.5 hover:underline" onClick={e => e.stopPropagation()}>
                                  <Link2 className="h-2.5 w-2.5" /> Link
                                </a>
                              )}
                            </div>
                            {event.participants && event.participants.length > 0 && (
                              <div className="flex items-center gap-1 mt-1">
                                <Users className="h-2.5 w-2.5 text-muted-foreground" />
                                <div className="flex -space-x-1">
                                  {event.participants.slice(0, 3).map(p => (
                                    <Avatar key={p.id} className="h-4 w-4 ring-1 ring-background">
                                      <AvatarImage src={p.profile?.avatar_url || ''} />
                                      <AvatarFallback className="text-[6px] bg-primary text-primary-foreground">
                                        {getInitials(p.profile?.display_name || p.profile?.name || 'U')}
                                      </AvatarFallback>
                                    </Avatar>
                                  ))}
                                </div>
                                {event.participants.length > 3 && (
                                  <span className="text-[9px] text-muted-foreground">+{event.participants.length - 3}</span>
                                )}
                              </div>
                            )}
                            {event.participants?.some(p => p.profile_id === profile?.id && p.status === 'pending') && (
                              <div className="flex gap-1 mt-1.5">
                                <Button size="sm" className="h-5 text-[10px] px-2" onClick={() => handleRespondInvite(event.id, 'accepted')}>Aceitar</Button>
                                <Button size="sm" variant="outline" className="h-5 text-[10px] px-2" onClick={() => handleRespondInvite(event.id, 'declined')}>Recusar</Button>
                              </div>
                            )}
                          </div>
                          {event.created_by === user?.id && (
                            <div className="flex gap-0.5">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(event)}><Edit className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(event.id)}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          )}
                        </div>
                      ))}
                      {selectedDateTasks.map(task => (
                        <div key={task.id} className="flex items-start gap-2 p-2 rounded-lg border border-border bg-muted/30">
                          <ListTodo className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-xs">#{task.task_number} {task.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge className={cn('text-[9px] h-4 text-white', priorityColors[task.priority])}>
                                {task.priority === 'urgent' ? 'Urgente' : task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}
                              </Badge>
                              <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                {format(new Date(task.due_date), 'HH:mm')}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pending invites */}
                  {myInvites.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Bell className="h-3 w-3 text-orange-500" /> Convites Pendentes
                      </p>
                      <div className="space-y-1.5">
                        {myInvites.map(event => (
                          <div key={event.id} className="p-2 rounded-lg border border-border">
                            <p className="font-medium text-xs">{event.title}</p>
                            <p className="text-[9px] text-muted-foreground">
                              {format(new Date(event.start_date), "dd/MM 'às' HH:mm", { locale: ptBR })}
                            </p>
                            <div className="flex gap-1 mt-1">
                              <Button size="sm" className="h-5 text-[10px] px-2" onClick={() => handleRespondInvite(event.id, 'accepted')}>Aceitar</Button>
                              <Button size="sm" variant="outline" className="h-5 text-[10px] px-2" onClick={() => handleRespondInvite(event.id, 'declined')}>Recusar</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* WEEK VIEW */}
        <TabsContent value="week" className="flex-1 overflow-hidden mt-0 p-4">
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateWeek(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <button onClick={goToToday} className="text-sm font-semibold text-foreground hover:text-primary cursor-pointer">
                {format(weekStart, 'dd MMM', { locale: ptBR })} - {format(addDays(weekStart, 6), 'dd MMM yyyy', { locale: ptBR })}
              </button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateWeek(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className={cn('flex-1 overflow-y-auto', isMobile ? 'space-y-2' : '')}>
              {isMobile ? (
                /* Mobile week: vertical list */
                weekDays.map(day => {
                  const dayEvents = getEventsForDate(day);
                  const dayTasks = getTasksForDate(day);
                  const isTodayDate = isToday(day);
                  return (
                    <div key={day.toISOString()} className={cn('rounded-lg border border-border p-3', isTodayDate && 'bg-primary/5 border-primary')}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn('text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center',
                          isTodayDate ? 'bg-primary text-primary-foreground' : ''
                        )}>
                          {format(day, 'd')}
                        </span>
                        <span className="text-xs text-muted-foreground capitalize">{format(day, 'EEEE', { locale: ptBR })}</span>
                        <div className="flex-1" />
                        <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => { setSelectedDate(day); setViewMode('day'); }}>
                          Ver dia
                        </Button>
                      </div>
                      {dayEvents.length === 0 && dayTasks.length === 0 ? (
                        <p className="text-xs text-muted-foreground pl-9">Nenhum evento</p>
                      ) : (
                        <div className="space-y-1 pl-9">
                          {dayEvents.map(e => (
                            <button key={e.id} onClick={() => openEdit(e)}
                              className="w-full text-left text-xs p-2 rounded text-white font-medium flex items-center gap-1"
                              style={{ backgroundColor: e.color }}>
                              {!e.all_day && format(new Date(e.start_date), 'HH:mm') + ' '}
                              {e.title}
                              {e.meeting_link && <Link2 className="h-3 w-3 ml-auto" />}
                            </button>
                          ))}
                          {dayTasks.map(t => (
                            <div key={t.id} className="text-xs p-2 rounded bg-muted">
                              <ListTodo className="h-3 w-3 inline mr-1" />
                              #{t.task_number} {t.title}
                              <span className="text-muted-foreground ml-1">{format(new Date(t.due_date), 'HH:mm')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                /* Desktop week: 7-column grid */
                <div className="grid grid-cols-7 gap-2 h-full">
                  {weekDays.map(day => {
                    const dayEvents = getEventsForDate(day);
                    const dayTasks = getTasksForDate(day);
                    const isTodayDate = isToday(day);
                    return (
                      <div key={day.toISOString()} className={cn('rounded-lg border border-border p-2 overflow-y-auto', isTodayDate && 'bg-primary/5 border-primary')}>
                        <div className="text-center mb-1.5">
                          <p className="text-[10px] text-muted-foreground uppercase">{format(day, 'EEE', { locale: ptBR })}</p>
                          <button
                            onClick={() => { setSelectedDate(day); setViewMode('day'); }}
                            className={cn('text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center mx-auto',
                              isTodayDate ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                            )}>
                            {format(day, 'd')}
                          </button>
                        </div>
                        <div className="space-y-1">
                          {dayEvents.map(e => (
                            <button key={e.id} onClick={() => openEdit(e)}
                              className="w-full text-left text-[10px] p-1 rounded truncate text-white font-medium"
                              style={{ backgroundColor: e.color }}>
                              {!e.all_day && format(new Date(e.start_date), 'HH:mm') + ' '}{e.title}
                            </button>
                          ))}
                          {dayTasks.map(t => (
                            <div key={t.id} className="text-[10px] p-1 rounded bg-muted truncate">
                              <ListTodo className="h-2.5 w-2.5 inline mr-0.5" />#{t.task_number} {t.title}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* DAY VIEW */}
        <TabsContent value="day" className="flex-1 overflow-hidden mt-0 p-4">
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(prev => addDays(prev, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <button onClick={goToToday} className="text-sm font-semibold text-foreground hover:text-primary cursor-pointer capitalize">
                {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(prev => addDays(prev, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* All day events */}
            {getAllDayEventsForDate(selectedDate).length > 0 && (
              <div className="mb-2 space-y-1 flex-shrink-0">
                <p className="text-[10px] font-medium text-muted-foreground">Dia inteiro</p>
                {getAllDayEventsForDate(selectedDate).map(e => (
                  <button key={e.id} onClick={() => openEdit(e)}
                    className="w-full text-left text-sm p-2 rounded text-white font-medium flex items-center gap-2"
                    style={{ backgroundColor: e.color }}>
                    {e.title}
                    {e.participants && e.participants.length > 0 && (
                      <Badge variant="secondary" className="text-[9px] bg-white/20 text-white ml-auto">{e.participants.length}</Badge>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Hour grid */}
            <div className="flex-1 overflow-y-auto">
              <div className="relative">
                {HOURS.map(hour => {
                  const hourEvents = getTimedEventsForDate(selectedDate).filter(e => getEventHour(e) === hour);
                  const hourTasks = taskDeadlines.filter(t => isSameDay(new Date(t.due_date), selectedDate) && new Date(t.due_date).getHours() === hour);
                  return (
                    <div key={hour} className={cn('flex border-t border-border', isMobile ? 'min-h-[44px]' : 'min-h-[48px]')}>
                      <div className={cn('flex-shrink-0 text-xs text-muted-foreground py-1 text-right pr-2', isMobile ? 'w-10' : 'w-14')}>
                        {`${hour.toString().padStart(2, '0')}:00`}
                      </div>
                      <div className="flex-1 relative py-0.5 space-y-0.5">
                        {hourEvents.map(e => (
                          <button key={e.id} onClick={() => openEdit(e)}
                            className={cn('w-full text-left p-1.5 rounded text-white font-medium flex items-center gap-1', isMobile ? 'text-xs' : 'text-xs')}
                            style={{ backgroundColor: e.color }}>
                            {format(new Date(e.start_date), 'HH:mm')}
                            {e.end_date && ` - ${format(new Date(e.end_date), 'HH:mm')}`}
                            {' '}{e.title}
                            {e.meeting_link && <Link2 className="h-3 w-3 ml-auto flex-shrink-0" />}
                          </button>
                        ))}
                        {hourTasks.map(t => (
                          <div key={t.id} className="text-xs p-1.5 rounded bg-muted flex items-center gap-1">
                            <ListTodo className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">#{t.task_number} {t.title}</span>
                            <span className="text-muted-foreground ml-auto flex-shrink-0">{format(new Date(t.due_date), 'HH:mm')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
