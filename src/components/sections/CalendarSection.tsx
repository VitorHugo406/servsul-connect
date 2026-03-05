import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, Plus, Trash2, Clock, Bell, ListTodo, Edit, X, Users, Link2, ChevronLeft, ChevronRight, Video, ArrowLeft, Check, FileDown } from 'lucide-react';
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
  status: string;
  completed_at: string | null;
}

interface UserProfile {
  id: string;
  name: string;
  display_name: string | null;
  avatar_url: string | null;
  user_id: string;
}

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
const WORK_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

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

  const [showCreatePage, setShowCreatePage] = useState<'event' | 'meeting' | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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
  const [meetingScheduleDate, setMeetingScheduleDate] = useState<Date>(new Date());

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase.from('profiles').select('id, name, display_name, avatar_url, user_id').eq('is_active', true);
      setAllUsers((data || []) as UserProfile[]);
    };
    fetchUsers();
  }, []);

  const fetchEvents = useCallback(async () => {
    if (!user) return;
    try {
      const start = startOfMonth(subMonths(currentMonth, 1));
      const end = endOfMonth(addMonths(currentMonth, 1));
      
      // Fetch events created by current user OR where user is a participant
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

      // Filter to only show events created by or involving the current user
      const allEventsWithParticipants = (data || []).map(e => ({ ...e, participants: participantsMap[e.id] || [] })) as CalendarEvent[];
      const myEvents = allEventsWithParticipants.filter(e => 
        e.created_by === user?.id || 
        e.participants?.some(p => p.profile_id === profile?.id)
      );
      setEvents(myEvents);
    } catch (e) {
      console.error('Error fetching events:', e);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, user, profile]);

  const fetchTaskDeadlines = useCallback(async () => {
    if (!profile) return;
    try {
      const start = startOfMonth(subMonths(currentMonth, 1));
      const end = endOfMonth(addMonths(currentMonth, 1));
      
      // Fetch tasks assigned to current user OR created by current user
      const { data } = await supabase
        .from('tasks')
        .select('id, title, due_date, priority, task_number, status, completed_at, assigned_to, created_by')
        .not('due_date', 'is', null)
        .gte('due_date', start.toISOString())
        .lte('due_date', end.toISOString())
        .or(`assigned_to.eq.${profile.id},created_by.eq.${profile.id}`)
        .order('due_date', { ascending: true });
      setTaskDeadlines((data || []) as TaskDeadline[]);
    } catch (e) {
      console.error('Error fetching task deadlines:', e);
    }
  }, [currentMonth, profile]);

  useEffect(() => { fetchEvents(); fetchTaskDeadlines(); }, [fetchEvents, fetchTaskDeadlines]);

  const resetForm = () => {
    setTitle(''); setDescription(''); setEventType('reminder');
    setStartDate(''); setStartTime('09:00'); setEndDate(''); setEndTime('10:00');
    setAllDay(false); setColor('#F59E0B'); setReminderMinutes(''); setMeetingLink('');
    setSelectedParticipants([]); setEditingEvent(null); setHasUnsavedChanges(false);
    setMeetingScheduleDate(new Date());
  };

  const openCreateEvent = (date?: Date) => {
    resetForm();
    setEventType('reminder'); setColor('#F59E0B');
    if (date) { setStartDate(format(date, 'yyyy-MM-dd')); setEndDate(format(date, 'yyyy-MM-dd')); }
    setShowCreatePage('event');
  };

  const openCreateMeeting = (date?: Date) => {
    resetForm();
    setEventType('meeting'); setColor('#3B82F6');
    if (date) { setStartDate(format(date, 'yyyy-MM-dd')); setEndDate(format(date, 'yyyy-MM-dd')); setMeetingScheduleDate(date); }
    setShowCreatePage('meeting');
  };

  const openEdit = (event: CalendarEvent) => {
    setTitle(event.title); setDescription(event.description || '');
    setEventType(event.event_type);
    setStartDate(format(new Date(event.start_date), 'yyyy-MM-dd'));
    setStartTime(format(new Date(event.start_date), 'HH:mm'));
    setEndDate(event.end_date ? format(new Date(event.end_date), 'yyyy-MM-dd') : '');
    setEndTime(event.end_date ? format(new Date(event.end_date), 'HH:mm') : '10:00');
    setAllDay(event.all_day); setColor(event.color);
    setReminderMinutes(event.reminder_minutes?.toString() || '');
    setMeetingLink(event.meeting_link || '');
    setSelectedParticipants(event.participants?.map(p => p.profile_id) || []);
    setEditingEvent(event);
    setShowCreatePage(event.event_type === 'meeting' ? 'meeting' : 'event');
  };

  const handleBack = () => {
    if (hasUnsavedChanges) { if (!confirm('Descartar alterações?')) return; }
    resetForm(); setShowCreatePage(null);
  };

  const handleSave = async () => {
    if (!title.trim() || !startDate) { toast.error('Título e data são obrigatórios'); return; }
    const startDateTime = allDay ? new Date(`${startDate}T00:00:00`).toISOString() : new Date(`${startDate}T${startTime}:00`).toISOString();
    const endDateTime = endDate ? (allDay ? new Date(`${endDate}T23:59:59`).toISOString() : new Date(`${endDate}T${endTime}:00`).toISOString()) : null;

    const eventData: any = {
      title: title.trim(), description: description.trim() || null,
      event_type: eventType, start_date: startDateTime, end_date: endDateTime,
      all_day: allDay, color, reminder_minutes: reminderMinutes ? parseInt(reminderMinutes) : null,
      meeting_link: meetingLink.trim() || null, created_by: user!.id,
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
        await supabase.from('meeting_participants').insert(selectedParticipants.map(pid => ({ event_id: eventId, profile_id: pid })));
      }
      toast.success(editingEvent ? 'Evento atualizado!' : 'Evento criado!');
      resetForm(); setShowCreatePage(null); fetchEvents();
    } catch (e) { toast.error('Erro ao salvar evento'); console.error(e); }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Excluir este evento?')) return;
    try {
      await supabase.from('calendar_events').delete().eq('id', eventId);
      toast.success('Evento excluído'); fetchEvents();
    } catch (e) { toast.error('Erro ao excluir'); }
  };

  const handleRespondInvite = async (eventId: string, status: 'accepted' | 'declined') => {
    if (!profile) return;
    try {
      await supabase.from('meeting_participants').update({ status, responded_at: new Date().toISOString() })
        .eq('event_id', eventId).eq('profile_id', profile.id);
      toast.success(status === 'accepted' ? 'Convite aceito!' : 'Convite recusado'); fetchEvents();
    } catch (e) { toast.error('Erro ao responder'); }
  };

  const toggleParticipant = (profileId: string) => {
    setSelectedParticipants(prev => prev.includes(profileId) ? prev.filter(p => p !== profileId) : [...prev, profileId]);
    setHasUnsavedChanges(true);
  };

  const goToToday = () => {
    const today = new Date();
    setSelectedDate(today); setCurrentMonth(today); setWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
  };

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) }), [weekStart]);

  const getEventsForDate = (date: Date) => events.filter(e => isSameDay(new Date(e.start_date), date));
  // Filter out completed tasks from calendar display
  const getTasksForDate = (date: Date) => taskDeadlines.filter(t => isSameDay(new Date(t.due_date), date) && !t.completed_at);
  const getAllDayEventsForDate = (date: Date) => events.filter(e => e.all_day && isSameDay(new Date(e.start_date), date));
  const getTimedEventsForDate = (date: Date) => events.filter(e => !e.all_day && isSameDay(new Date(e.start_date), date));
  const getEventHour = (event: CalendarEvent) => new Date(event.start_date).getHours();

  const priorityColors: Record<string, string> = { urgent: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-blue-500', low: 'bg-gray-500' };
  const myInvites = events.filter(e => e.participants?.some(p => p.profile_id === profile?.id && p.status === 'pending'));
  const navigateMonth = (dir: number) => setCurrentMonth(prev => dir > 0 ? addMonths(prev, 1) : subMonths(prev, 1));
  const navigateWeek = (dir: number) => setWeekStart(prev => dir > 0 ? addWeeks(prev, 1) : subWeeks(prev, 1));
  const selectedDateEvents = getEventsForDate(selectedDate);
  const selectedDateTasks = getTasksForDate(selectedDate);
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  const generateDailyReport = async (date: Date) => {
    try {
      const dateStr = format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      const dayEvents = getEventsForDate(date);
      const dayTasks = getTasksForDate(date);

      let html = `<html><head><meta charset="utf-8"><title>Relatório do Dia - ${dateStr}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 40px; background: #fff; color: #1a1a1a; }
        .header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; border-bottom: 3px solid #3b82f6; padding-bottom: 16px; }
        .header h1 { font-size: 24px; margin: 0; color: #1e293b; }
        .header .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
        .stats { display: flex; gap: 16px; margin-bottom: 24px; }
        .stat-card { background: #f1f5f9; border-radius: 8px; padding: 12px 16px; flex: 1; text-align: center; }
        .stat-card .number { font-size: 24px; font-weight: 700; color: #3b82f6; }
        .stat-card .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
        table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 16px; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        th { background: #1e293b; color: white; padding: 12px 14px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
        td { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
        tr:nth-child(even) { background: #f8fafc; }
        tr:last-child td { border-bottom: none; }
        .section-title { font-size: 16px; font-weight: 600; color: #1e293b; margin: 24px 0 12px; display: flex; align-items: center; gap: 8px; }
        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 10px; text-align: center; }
        @media print { body { padding: 20px; } }
      </style></head><body>`;

      html += `<div class="header"><div><h1>📅 Relatório do Dia</h1><div class="subtitle">${dateStr} • Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</div></div></div>`;

      html += `<div class="stats">`;
      html += `<div class="stat-card"><div class="number">${dayEvents.length}</div><div class="label">Eventos/Reuniões</div></div>`;
      html += `<div class="stat-card"><div class="number" style="color:#f59e0b">${dayTasks.length}</div><div class="label">Tarefas com Prazo</div></div>`;
      html += `<div class="stat-card"><div class="number" style="color:#22c55e">${dayEvents.length + dayTasks.length}</div><div class="label">Total de Itens</div></div>`;
      html += `</div>`;

      if (dayEvents.length > 0) {
        const typeLabel = (t: string) => ALL_EVENT_TYPES.find(et => et.id === t)?.label || t;
        html += `<div class="section-title">📋 Eventos e Reuniões</div>`;
        html += '<table><thead><tr><th>Tipo</th><th>Título</th><th>Horário</th><th>Participantes</th></tr></thead><tbody>';
        for (const e of dayEvents) {
          const timeStr = e.all_day ? 'Dia inteiro' : `${format(new Date(e.start_date), 'HH:mm')}${e.end_date ? ' - ' + format(new Date(e.end_date), 'HH:mm') : ''}`;
          const names = e.participants?.map(p => p.profile?.display_name || p.profile?.name || '-').join(', ') || '-';
          html += `<tr><td>${typeLabel(e.event_type)}</td><td>${e.title}${e.description ? '<br><small style="color:#64748b">' + e.description + '</small>' : ''}</td><td>${timeStr}</td><td>${names}</td></tr>`;
        }
        html += '</tbody></table>';
      }

      if (dayTasks.length > 0) {
        html += `<div class="section-title">✅ Tarefas com Prazo</div>`;
        html += '<table><thead><tr><th>#</th><th>Título</th><th>Prioridade</th><th>Horário</th></tr></thead><tbody>';
        for (const t of dayTasks) {
          const prioLabel = t.priority === 'urgent' ? 'Urgente' : t.priority === 'high' ? 'Alta' : t.priority === 'medium' ? 'Média' : 'Baixa';
          const timeStr = format(new Date(t.due_date), 'HH:mm');
          html += `<tr><td>${t.task_number}</td><td>${t.title}</td><td>${prioLabel}</td><td>${timeStr}</td></tr>`;
        }
        html += '</tbody></table>';
      }

      if (dayEvents.length === 0 && dayTasks.length === 0) {
        html += '<p style="text-align:center;color:#94a3b8;padding:40px 0;font-size:14px;">Nenhum evento ou tarefa para este dia.</p>';
      }

      html += `<div class="footer">Relatório gerado automaticamente pelo ServChat • ${new Date().toLocaleDateString('pt-BR')}</div></body></html>`;

      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); w.print(); }
      toast.success('Relatório gerado!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar relatório');
    }
  };

  // Check if a specific user is busy at a given hour - uses all events (not filtered)
  const [allEventsForSchedule, setAllEventsForSchedule] = useState<CalendarEvent[]>([]);
  const [allTasksForSchedule, setAllTasksForSchedule] = useState<TaskDeadline[]>([]);

  // Fetch ALL events/tasks for meeting schedule availability (not just the user's)
  useEffect(() => {
    const fetchAll = async () => {
      const start = startOfMonth(subMonths(currentMonth, 1));
      const end = endOfMonth(addMonths(currentMonth, 1));
      const { data: evData } = await supabase.from('calendar_events').select('*')
        .gte('start_date', start.toISOString()).lte('start_date', end.toISOString());
      
      const eventIds = (evData || []).map(e => e.id);
      let pMap: Record<string, Participant[]> = {};
      if (eventIds.length > 0) {
        const { data: parts } = await supabase.from('meeting_participants').select('*').in('event_id', eventIds);
        if (parts) {
          const pIds = [...new Set(parts.map(p => p.profile_id))];
          const { data: profiles } = pIds.length > 0 ? await supabase.from('profiles').select('id, name, display_name, avatar_url').in('id', pIds) : { data: [] };
          const profMap = new Map((profiles || []).map(p => [p.id, p]));
          for (const p of parts) {
            if (!pMap[p.event_id]) pMap[p.event_id] = [];
            pMap[p.event_id].push({ ...p, profile: profMap.get(p.profile_id) } as Participant);
          }
        }
      }
      setAllEventsForSchedule((evData || []).map(e => ({ ...e, participants: pMap[e.id] || [] })) as CalendarEvent[]);
      
      const { data: taskData } = await supabase.from('tasks')
        .select('id, title, due_date, priority, task_number, status, completed_at, assigned_to')
        .not('due_date', 'is', null)
        .gte('due_date', start.toISOString()).lte('due_date', end.toISOString());
      setAllTasksForSchedule((taskData || []) as any[]);
    };
    if (showCreatePage === 'meeting') fetchAll();
  }, [showCreatePage, currentMonth]);

  const isUserBusyAtHour = (userId: string | undefined, profileId: string | undefined, date: string, hour: number) => {
    const dateObj = new Date(`${date}T${hour.toString().padStart(2, '0')}:00:00`);
    // Check calendar events from ALL events
    const eventBusy = allEventsForSchedule.some(e => {
      const isParticipant = e.participants?.some(p => p.profile_id === profileId);
      const isCreator = allUsers.find(u => u.id === profileId)?.user_id === e.created_by;
      const isMyEvent = e.created_by === userId;
      if (!isParticipant && !isCreator && !isMyEvent) return false;
      const eStart = new Date(e.start_date);
      const eEnd = e.end_date ? new Date(e.end_date) : new Date(eStart.getTime() + 60 * 60 * 1000);
      return dateObj >= eStart && dateObj < eEnd;
    });
    if (eventBusy) return true;
    // Check tasks assigned to THIS specific user
    const taskBusy = allTasksForSchedule.some(t => {
      if ((t as any).completed_at) return false;
      if ((t as any).assigned_to !== profileId) return false;
      const tDate = new Date(t.due_date);
      if (!isSameDay(tDate, dateObj) || tDate.getHours() !== hour) return false;
      return true;
    });
    return taskBusy;
  };

  // Meeting schedule navigation
  const scheduleWeekStart = useMemo(() => startOfWeek(meetingScheduleDate, { weekStartsOn: 1 }), [meetingScheduleDate]);
  const scheduleWeekDays = useMemo(() => eachDayOfInterval({ start: scheduleWeekStart, end: addDays(scheduleWeekStart, 6) }), [scheduleWeekStart]);
  // Filter to only weekdays (Mon-Fri) for meeting scheduling
  const scheduleBusinessDays = scheduleWeekDays.filter(d => d.getDay() !== 0 && d.getDay() !== 6);

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
            {editingEvent ? 'Salvar' : isMeeting ? 'Agendar' : 'Criar'}
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {isMeeting ? (
            /* =================== MEETING FORM - FULL WIDTH LAYOUT =================== */
            <div className="h-full">
              {/* Title - full width */}
              <div className="px-4 md:px-6 pt-4 md:pt-6 pb-2">
                <Input
                  value={title}
                  onChange={e => { setTitle(e.target.value); setHasUnsavedChanges(true); }}
                  placeholder="Adicionar título da reunião"
                  className="text-xl md:text-2xl font-semibold border-0 border-b-2 border-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary h-auto py-2"
                />
              </div>

              <div className={cn('gap-0', isMobile ? 'flex flex-col' : 'flex h-[calc(100vh-180px)]')}>
                {/* Left side - Form */}
                <div className={cn('space-y-5 overflow-y-auto p-4 md:p-6', isMobile ? 'w-full' : 'w-[420px] flex-shrink-0 border-r border-border')}>
                  {/* Date and time */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Horário</span>
                    </div>
                    <div className="pl-6 space-y-3">
                      <div className="flex items-center gap-2">
                        <Checkbox id="allDay" checked={allDay} onCheckedChange={(c) => { setAllDay(!!c); setHasUnsavedChanges(true); }} />
                        <Label htmlFor="allDay" className="text-sm cursor-pointer">Dia inteiro</Label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Data Início</Label>
                          <Input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value); setHasUnsavedChanges(true); }} className="h-9" />
                        </div>
                        {!allDay && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Hora</Label>
                            <Input type="time" value={startTime} onChange={e => { setStartTime(e.target.value); setHasUnsavedChanges(true); }} className="h-9" />
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Data Fim</Label>
                          <Input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setHasUnsavedChanges(true); }} className="h-9" />
                        </div>
                        {!allDay && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Hora</Label>
                            <Input type="time" value={endTime} onChange={e => { setEndTime(e.target.value); setHasUnsavedChanges(true); }} className="h-9" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Meeting link */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Link2 className="h-4 w-4" />
                      <span>Link da reunião</span>
                    </div>
                    <div className="pl-6">
                      <Input value={meetingLink} onChange={e => { setMeetingLink(e.target.value); setHasUnsavedChanges(true); }} placeholder="https://meet.google.com/..." className="h-9" />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Edit className="h-4 w-4" />
                      <span>Descrição</span>
                    </div>
                    <div className="pl-6">
                      <Textarea value={description} onChange={e => { setDescription(e.target.value); setHasUnsavedChanges(true); }} placeholder="Pauta da reunião..." rows={3} />
                    </div>
                  </div>

                  {/* Participants */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>Participantes</span>
                      {selectedParticipants.length > 0 && (
                        <Badge variant="secondary" className="text-[10px]">{selectedParticipants.length}</Badge>
                      )}
                    </div>
                    <div className="pl-6">
                      <div className="border border-border rounded-lg max-h-[200px] overflow-y-auto">
                        {allUsers.filter(u => u.user_id !== user?.id).map(u => (
                          <label key={u.id} className={cn(
                            'flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors border-b border-border last:border-0',
                            selectedParticipants.includes(u.id) ? 'bg-primary/5' : 'hover:bg-muted/50'
                          )}>
                            <Checkbox checked={selectedParticipants.includes(u.id)} onCheckedChange={() => toggleParticipant(u.id)} />
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={u.avatar_url || ''} />
                              <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">{getInitials(u.display_name || u.name)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm truncate">{u.display_name || u.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Color */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarIcon className="h-4 w-4" />
                      <span>Cor</span>
                    </div>
                    <div className="pl-6 flex gap-2 flex-wrap">
                      {EVENT_COLORS.map(c => (
                        <button key={c} onClick={() => { setColor(c); setHasUnsavedChanges(true); }}
                          className={cn('w-7 h-7 rounded-full border-2 transition-all', color === c ? 'border-foreground ring-2 ring-primary/30' : 'border-transparent')}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right side - Availability Grid (always visible) */}
                <div className={cn('flex-1 overflow-hidden flex flex-col', isMobile ? 'border-t border-border' : '')}>
                  <div className="bg-muted/30 px-4 py-3 border-b border-border">
                    <h3 className="text-sm font-semibold">Disponibilidade de Horários</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {selectedParticipants.length > 0 
                        ? `${selectedParticipants.length} participante(s) selecionado(s)` 
                        : 'Selecione participantes para verificar disponibilidade'}
                    </p>
                  </div>
                  
                  <div className="flex-1 overflow-auto p-3">
                    <div className="flex items-center justify-between mb-3">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMeetingScheduleDate(prev => addDays(prev, -7))}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs font-medium">
                        {format(scheduleWeekStart, 'dd MMM', { locale: ptBR })} - {format(addDays(scheduleWeekStart, 6), 'dd MMM', { locale: ptBR })}
                      </span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMeetingScheduleDate(prev => addDays(prev, 7))}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Day headers */}
                    <div className="overflow-x-auto">
                      <div className="grid gap-1" style={{ gridTemplateColumns: `50px repeat(${scheduleBusinessDays.length}, minmax(70px, 1fr))` }}>
                        <div />
                        {scheduleBusinessDays.map(day => (
                          <div key={day.toISOString()} className="text-center">
                            <p className="text-[9px] text-muted-foreground uppercase">{format(day, 'EEE', { locale: ptBR })}</p>
                            <p className={cn(
                              'text-sm font-bold mx-auto w-7 h-7 rounded-full flex items-center justify-center',
                              isToday(day) ? 'bg-primary text-primary-foreground' : ''
                            )}>
                              {format(day, 'd')}
                            </p>
                          </div>
                        ))}

                        {/* Time slots */}
                        {WORK_HOURS.map(hour => {
                          const timeStr = `${hour.toString().padStart(2, '0')}:00`;
                          return (
                            <React.Fragment key={hour}>
                              <div className="text-[10px] text-muted-foreground py-1 text-right pr-1">{timeStr}</div>
                              {scheduleBusinessDays.map(day => {
                                const dateStr = format(day, 'yyyy-MM-dd');
                                const myBusy = isUserBusyAtHour(user?.id, profile?.id, dateStr, hour);
                                // Only show busy for participants that are currently selected
                                const anyParticipantBusy = selectedParticipants.some(pid => {
                                  const u = allUsers.find(u => u.id === pid);
                                  return isUserBusyAtHour(u?.user_id, pid, dateStr, hour);
                                });
                                const isBusy = myBusy || anyParticipantBusy;
                                const isSelected = startDate === dateStr && startTime === timeStr;

                                return (
                                  <div key={day.toISOString()} className="flex justify-center py-0.5">
                                    {isBusy ? (
                                      <div className="w-full text-center text-[10px] text-destructive/60 bg-destructive/5 rounded py-1 font-medium">
                                        Ocupado
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          setStartDate(dateStr);
                                          setStartTime(timeStr);
                                          setEndDate(dateStr);
                                          setEndTime(`${(hour + 1).toString().padStart(2, '0')}:00`);
                                          setHasUnsavedChanges(true);
                                        }}
                                        className={cn(
                                          'text-[10px] font-medium px-2 py-1 rounded-md transition-all w-full',
                                          isSelected
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-primary/10 text-primary hover:bg-primary/20'
                                        )}
                                      >
                                        {timeStr}
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* =================== EVENT FORM (unchanged) =================== */
            <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-5">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input value={title} onChange={e => { setTitle(e.target.value); setHasUnsavedChanges(true); }} placeholder="Título do evento" className="text-lg" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={description} onChange={e => { setDescription(e.target.value); setHasUnsavedChanges(true); }} placeholder="Descrição opcional" rows={3} />
              </div>
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
              <div className="flex items-center gap-2">
                <Checkbox id="allDay2" checked={allDay} onCheckedChange={(c) => { setAllDay(!!c); setHasUnsavedChanges(true); }} />
                <Label htmlFor="allDay2" className="text-sm cursor-pointer">Dia inteiro</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Data Início *</Label>
                  <Input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value); setHasUnsavedChanges(true); }} />
                </div>
                {!allDay && <div className="space-y-2"><Label>Hora Início</Label><Input type="time" value={startTime} onChange={e => { setStartTime(e.target.value); setHasUnsavedChanges(true); }} /></div>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Data Fim</Label><Input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setHasUnsavedChanges(true); }} /></div>
                {!allDay && <div className="space-y-2"><Label>Hora Fim</Label><Input type="time" value={endTime} onChange={e => { setEndTime(e.target.value); setHasUnsavedChanges(true); }} /></div>}
              </div>
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
          )}
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
            <Badge variant="destructive" className="gap-1"><Bell className="h-3 w-3" /> {myInvites.length} convite(s)</Badge>
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

        {/* MONTH VIEW */}
        <TabsContent value="month" className="flex-1 overflow-hidden mt-0 p-4">
          <div className={cn('h-full', isMobile ? 'overflow-y-auto space-y-3' : 'flex gap-4')}>
            <div className={cn(isMobile ? 'w-full' : 'flex-1 flex flex-col')}>
              <div className="flex items-center justify-between mb-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                <button onClick={goToToday} className="text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer capitalize">
                  {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                </button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
              <div className="grid grid-cols-7 gap-px mb-px">
                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
                  <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
                ))}
              </div>
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
                    <button key={day.toISOString()} onClick={() => setSelectedDate(day)}
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
                      )}>{format(day, 'd')}</span>
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

            {/* Right panel */}
            <div className={cn(isMobile ? 'w-full' : 'w-[320px] flex-shrink-0 overflow-y-auto')}>
              <Card className="h-full">
                <CardHeader className="pb-2 pt-3 px-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                      {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                    </CardTitle>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Relatório do dia" onClick={() => generateDailyReport(selectedDate)}>
                      <FileDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
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
                              <Badge variant="outline" className="text-[9px] h-4">{ALL_EVENT_TYPES.find(t => t.id === event.event_type)?.label}</Badge>
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
                                      <AvatarFallback className="text-[6px] bg-primary text-primary-foreground">{getInitials(p.profile?.display_name || p.profile?.name || 'U')}</AvatarFallback>
                                    </Avatar>
                                  ))}
                                </div>
                                {event.participants.length > 3 && <span className="text-[9px] text-muted-foreground">+{event.participants.length - 3}</span>}
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
                                <Clock className="h-2.5 w-2.5" /> {format(new Date(task.due_date), 'HH:mm')}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {myInvites.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Bell className="h-3 w-3 text-orange-500" /> Convites Pendentes
                      </p>
                      <div className="space-y-1.5">
                        {myInvites.map(event => (
                          <div key={event.id} className="p-2 rounded-lg border border-border">
                            <p className="font-medium text-xs">{event.title}</p>
                            <p className="text-[9px] text-muted-foreground">{format(new Date(event.start_date), "dd/MM 'às' HH:mm", { locale: ptBR })}</p>
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
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateWeek(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <button onClick={goToToday} className="text-sm font-semibold text-foreground hover:text-primary cursor-pointer">
                {format(weekStart, 'dd MMM', { locale: ptBR })} - {format(addDays(weekStart, 6), 'dd MMM yyyy', { locale: ptBR })}
              </button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateWeek(1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <div className={cn('flex-1 overflow-y-auto', isMobile ? 'space-y-2' : '')}>
              {isMobile ? (
                weekDays.map(day => {
                  const dayEvents = getEventsForDate(day);
                  const dayTasks = getTasksForDate(day);
                  const isTodayDate = isToday(day);
                  return (
                    <div key={day.toISOString()} className={cn('rounded-lg border border-border p-3', isTodayDate && 'bg-primary/5 border-primary')}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn('text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center', isTodayDate ? 'bg-primary text-primary-foreground' : '')}>
                          {format(day, 'd')}
                        </span>
                        <span className="text-xs text-muted-foreground capitalize">{format(day, 'EEEE', { locale: ptBR })}</span>
                        <div className="flex-1" />
                        <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => { setSelectedDate(day); setViewMode('day'); }}>Ver dia</Button>
                      </div>
                      {dayEvents.length === 0 && dayTasks.length === 0 ? (
                        <p className="text-xs text-muted-foreground pl-9">Nenhum evento</p>
                      ) : (
                        <div className="space-y-1.5 pl-9">
                          {dayEvents.map(e => (
                            <button key={e.id} onClick={() => openEdit(e)}
                              className="w-full text-left text-xs p-2.5 rounded-lg text-white font-medium flex items-center gap-2"
                              style={{ backgroundColor: e.color }}>
                              <div className="flex-1 min-w-0">
                                <p className="truncate">{e.title}</p>
                                {!e.all_day && <p className="text-[10px] opacity-80">{format(new Date(e.start_date), 'HH:mm')}{e.end_date && ` - ${format(new Date(e.end_date), 'HH:mm')}`}</p>}
                              </div>
                              {e.meeting_link && <Link2 className="h-3 w-3 flex-shrink-0" />}
                            </button>
                          ))}
                          {dayTasks.map(t => (
                            <div key={t.id} className="text-xs p-2.5 rounded-lg bg-muted flex items-center gap-2">
                              <ListTodo className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                              <div className="flex-1 min-w-0">
                                <p className="truncate">#{t.task_number} {t.title}</p>
                                <p className="text-[10px] text-muted-foreground">{format(new Date(t.due_date), 'HH:mm')}</p>
                              </div>
                              <Badge className={cn('text-[9px] h-4 text-white flex-shrink-0', priorityColors[t.priority])}>
                                {t.priority === 'urgent' ? 'Urg' : t.priority === 'high' ? 'Alta' : t.priority === 'medium' ? 'Méd' : 'Bx'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="grid grid-cols-7 gap-2 h-full">
                  {weekDays.map(day => {
                    const dayEvents = getEventsForDate(day);
                    const dayTasks = getTasksForDate(day);
                    const isTodayDate = isToday(day);
                    return (
                      <div key={day.toISOString()} className={cn('rounded-lg border border-border p-2 overflow-y-auto', isTodayDate && 'bg-primary/5 border-primary')}>
                        <div className="text-center mb-1.5">
                          <p className="text-[10px] text-muted-foreground uppercase">{format(day, 'EEE', { locale: ptBR })}</p>
                          <button onClick={() => { setSelectedDate(day); setViewMode('day'); }}
                            className={cn('text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center mx-auto', isTodayDate ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
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
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(prev => addDays(prev, -1))}><ChevronLeft className="h-4 w-4" /></Button>
              <button onClick={goToToday} className="text-sm font-semibold text-foreground hover:text-primary cursor-pointer capitalize">
                {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(prev => addDays(prev, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>

            {getAllDayEventsForDate(selectedDate).length > 0 && (
              <div className="mb-2 space-y-1 flex-shrink-0">
                <p className="text-[10px] font-medium text-muted-foreground">Dia inteiro</p>
                {getAllDayEventsForDate(selectedDate).map(e => (
                  <button key={e.id} onClick={() => openEdit(e)}
                    className="w-full text-left text-sm p-2.5 rounded-lg text-white font-medium flex items-center gap-2"
                    style={{ backgroundColor: e.color }}>
                    {e.title}
                    {e.participants && e.participants.length > 0 && (
                      <Badge variant="secondary" className="text-[9px] bg-white/20 text-white ml-auto">{e.participants.length}</Badge>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              <div className="relative">
                {HOURS.map(hour => {
                  const hourEvents = getTimedEventsForDate(selectedDate).filter(e => getEventHour(e) === hour);
                  const hourTasks = taskDeadlines.filter(t => !t.completed_at && isSameDay(new Date(t.due_date), selectedDate) && new Date(t.due_date).getHours() === hour);
                  return (
                    <div key={hour} className="flex border-t border-border min-h-[52px]">
                      <div className={cn('flex-shrink-0 text-xs text-muted-foreground py-1 text-right pr-2', isMobile ? 'w-12' : 'w-14')}>
                        {`${hour.toString().padStart(2, '0')}:00`}
                      </div>
                      <div className="flex-1 relative py-0.5 space-y-0.5">
                        {hourEvents.map(e => (
                          <button key={e.id} onClick={() => openEdit(e)}
                            className="w-full text-left p-2 rounded-lg text-white font-medium flex items-center gap-2 text-sm"
                            style={{ backgroundColor: e.color }}>
                            <div className="flex-1 min-w-0">
                              <p className="truncate">{e.title}</p>
                              <p className="text-[10px] opacity-80">
                                {format(new Date(e.start_date), 'HH:mm')}{e.end_date && ` - ${format(new Date(e.end_date), 'HH:mm')}`}
                              </p>
                            </div>
                            {e.meeting_link && <Link2 className="h-3.5 w-3.5 flex-shrink-0" />}
                            {e.participants && e.participants.length > 0 && (
                              <Badge variant="secondary" className="text-[9px] bg-white/20 text-white flex-shrink-0">{e.participants.length}</Badge>
                            )}
                          </button>
                        ))}
                        {hourTasks.map(t => (
                          <div key={t.id} className="text-sm p-2 rounded-lg bg-muted flex items-center gap-2">
                            <ListTodo className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate flex-1">#{t.task_number} {t.title}</span>
                            <span className="text-xs text-muted-foreground flex-shrink-0">{format(new Date(t.due_date), 'HH:mm')}</span>
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
