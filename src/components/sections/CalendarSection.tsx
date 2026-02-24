import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Calendar as CalendarIcon, Plus, Trash2, Clock, Bell, ListTodo, Edit, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, isSameDay, addMonths, subMonths } from 'date-fns';
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
  task_id: string | null;
  created_by: string;
  created_at: string;
}

interface TaskDeadline {
  id: string;
  title: string;
  due_date: string;
  priority: string;
  task_number: number;
}

const EVENT_TYPES = [
  { id: 'meeting', label: 'Reunião', color: '#3B82F6' },
  { id: 'reminder', label: 'Lembrete', color: '#F59E0B' },
  { id: 'event', label: 'Evento', color: '#10B981' },
  { id: 'deadline', label: 'Prazo', color: '#EF4444' },
];

const EVENT_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

export function CalendarSection() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [taskDeadlines, setTaskDeadlines] = useState<TaskDeadline[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [showCreate, setShowCreate] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState('meeting');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:00');
  const [allDay, setAllDay] = useState(false);
  const [color, setColor] = useState('#3B82F6');
  const [reminderMinutes, setReminderMinutes] = useState('');

  const fetchEvents = useCallback(async () => {
    try {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .gte('start_date', start.toISOString())
        .lte('start_date', end.toISOString())
        .order('start_date', { ascending: true });
      if (error) throw error;
      setEvents((data || []) as CalendarEvent[]);
    } catch (e) {
      console.error('Error fetching events:', e);
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  const fetchTaskDeadlines = useCallback(async () => {
    try {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
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

  useEffect(() => {
    fetchEvents();
    fetchTaskDeadlines();
  }, [fetchEvents, fetchTaskDeadlines]);

  const resetForm = () => {
    setTitle(''); setDescription(''); setEventType('meeting');
    setStartDate(''); setStartTime('09:00'); setEndDate(''); setEndTime('10:00');
    setAllDay(false); setColor('#3B82F6'); setReminderMinutes('');
    setEditingEvent(null);
  };

  const openCreate = (date?: Date) => {
    resetForm();
    if (date) {
      setStartDate(format(date, 'yyyy-MM-dd'));
      setEndDate(format(date, 'yyyy-MM-dd'));
    }
    setShowCreate(true);
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
    setEditingEvent(event);
    setShowCreate(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !startDate) { toast.error('Título e data são obrigatórios'); return; }
    
    const startDateTime = allDay 
      ? new Date(`${startDate}T00:00:00`).toISOString()
      : new Date(`${startDate}T${startTime}:00`).toISOString();
    
    const endDateTime = endDate
      ? (allDay ? new Date(`${endDate}T23:59:59`).toISOString() : new Date(`${endDate}T${endTime}:00`).toISOString())
      : null;

    const eventData = {
      title: title.trim(),
      description: description.trim() || null,
      event_type: eventType,
      start_date: startDateTime,
      end_date: endDateTime,
      all_day: allDay,
      color,
      reminder_minutes: reminderMinutes ? parseInt(reminderMinutes) : null,
      created_by: user!.id,
    };

    try {
      if (editingEvent) {
        const { error } = await supabase.from('calendar_events').update(eventData).eq('id', editingEvent.id);
        if (error) throw error;
        toast.success('Evento atualizado!');
      } else {
        const { error } = await supabase.from('calendar_events').insert(eventData);
        if (error) throw error;
        toast.success('Evento criado!');
      }
      resetForm();
      setShowCreate(false);
      fetchEvents();
    } catch (e) {
      toast.error('Erro ao salvar evento');
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

  // Get events for selected date
  const selectedDateEvents = events.filter(e => isSameDay(new Date(e.start_date), selectedDate));
  const selectedDateTasks = taskDeadlines.filter(t => isSameDay(new Date(t.due_date), selectedDate));

  // Get dates with events for calendar highlighting
  const eventDates = events.map(e => new Date(e.start_date));
  const taskDates = taskDeadlines.map(t => new Date(t.due_date));
  const allEventDates = [...eventDates, ...taskDates];

  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-blue-500',
    low: 'bg-gray-500',
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-2xl font-bold text-foreground">Calendário</h3>
          <p className="text-muted-foreground">Reuniões, lembretes e prazos de tarefas</p>
        </div>
        <Button onClick={() => openCreate()} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Evento
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Calendar */}
        <Card>
          <CardContent className="p-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              locale={ptBR}
              className="p-3 pointer-events-auto w-full"
              classNames={{
                day_today: 'bg-primary/10 text-primary font-bold',
                day_selected: 'bg-primary text-primary-foreground',
                months: 'w-full',
                month: 'w-full',
                table: 'w-full',
                head_row: 'w-full',
                row: 'w-full',
              }}
              modifiers={{
                hasEvent: (date) => allEventDates.some(d => isSameDay(d, date)),
              }}
              modifiersStyles={{
                hasEvent: { fontWeight: 'bold', textDecoration: 'underline', textDecorationColor: 'hsl(var(--primary))' },
              }}
            />
          </CardContent>
        </Card>

        {/* Selected day events */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" />
                {format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[400px]">
                {selectedDateEvents.length === 0 && selectedDateTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum evento neste dia</p>
                    <Button variant="link" size="sm" onClick={() => openCreate(selectedDate)} className="mt-2">
                      Criar evento
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Calendar events */}
                    {selectedDateEvents.map(event => (
                      <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                        <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: event.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{event.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px]">
                              {EVENT_TYPES.find(t => t.id === event.event_type)?.label || event.event_type}
                            </Badge>
                            {!event.all_day && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Clock className="h-3 w-3" />
                                {format(new Date(event.start_date), 'HH:mm')}
                                {event.end_date && ` - ${format(new Date(event.end_date), 'HH:mm')}`}
                              </span>
                            )}
                            {event.all_day && <Badge variant="secondary" className="text-[10px]">Dia inteiro</Badge>}
                          </div>
                          {event.description && <p className="text-xs text-muted-foreground mt-1">{event.description}</p>}
                          {event.reminder_minutes && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-1">
                              <Bell className="h-3 w-3" /> Lembrete: {event.reminder_minutes}min antes
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(event)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(event.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {/* Task deadlines */}
                    {selectedDateTasks.map(task => (
                      <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
                        <ListTodo className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">#{task.task_number} {task.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={cn('text-[10px] text-white', priorityColors[task.priority])}>
                              {task.priority === 'urgent' ? 'Urgente' : task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">Prazo de Tarefa</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <Button variant="outline" className="w-full gap-2" onClick={() => openCreate(selectedDate)}>
            <Plus className="h-4 w-4" /> Evento em {format(selectedDate, 'dd/MM')}
          </Button>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={(o) => { if (!o) { resetForm(); setShowCreate(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              {editingEvent ? 'Editar Evento' : 'Novo Evento'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do evento" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição opcional" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Lembrete (min)</Label>
                <Input type="number" value={reminderMinutes} onChange={(e) => setReminderMinutes(e.target.value)} placeholder="Ex: 15" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data Início *</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              {!allDay && (
                <div className="space-y-2">
                  <Label>Hora Início</Label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              {!allDay && (
                <div className="space-y-2">
                  <Label>Hora Fim</Label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="allDay" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="rounded" />
              <Label htmlFor="allDay" className="text-sm cursor-pointer">Dia inteiro</Label>
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2">
                {EVENT_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn('w-7 h-7 rounded-full border-2 transition-all', color === c ? 'border-foreground ring-2 ring-primary/30' : 'border-transparent')}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowCreate(false); }}>Cancelar</Button>
            <Button onClick={handleSave}>{editingEvent ? 'Salvar' : 'Criar Evento'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
