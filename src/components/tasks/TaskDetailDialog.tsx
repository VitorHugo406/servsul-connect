import { useState, useRef, useCallback } from 'react';
import {
  ArrowRight, Calendar as CalendarIcon, CheckCircle2, CheckSquare, ChevronDown, ChevronRight,
  Eye, EyeOff, Loader2, MessageSquare, Plus, Tag, Trash2, Users, X, Zap, Bell, Move, Copy, Layout,
  Bold, Italic, Strikethrough, List, Type, Minus, Search, Pencil
} from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { BoardTask } from '@/hooks/useBoardTasks';
import { useTaskComments } from '@/hooks/useTasks';
import { useSubtasks } from '@/hooks/useSubtasks';
import { useSubtaskGroups } from '@/hooks/useSubtaskGroups';
import { useTaskActivities, TaskActivity } from '@/hooks/useTaskActivities';
import { TaskLabel } from '@/hooks/useTaskLabels';
import { useIsMobile } from '@/hooks/use-mobile';
import { PRIORITIES, getInitials, getCoverDisplay } from './taskConstants';
import { cn } from '@/lib/utils';

// Colorblind patterns as SVG data URIs
const COLORBLIND_PATTERNS: Record<string, string> = {
  '#22c55e': 'url("data:image/svg+xml,%3Csvg width=\'8\' height=\'8\' viewBox=\'0 0 8 8\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0L4 4L0 8M4 0L8 4L4 8\' stroke=\'rgba(255,255,255,0.5)\' stroke-width=\'1\' fill=\'none\'/%3E%3C/svg%3E")',
  '#a3a306': 'url("data:image/svg+xml,%3Csvg width=\'8\' height=\'8\' viewBox=\'0 0 8 8\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'2\' cy=\'2\' r=\'1.5\' fill=\'rgba(255,255,255,0.5)\'/%3E%3Ccircle cx=\'6\' cy=\'6\' r=\'1.5\' fill=\'rgba(255,255,255,0.5)\'/%3E%3C/svg%3E")',
  '#f97316': 'url("data:image/svg+xml,%3Csvg width=\'8\' height=\'8\' viewBox=\'0 0 8 8\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cline x1=\'0\' y1=\'0\' x2=\'8\' y2=\'8\' stroke=\'rgba(255,255,255,0.5)\' stroke-width=\'1.5\'/%3E%3C/svg%3E")',
  '#ef4444': 'url("data:image/svg+xml,%3Csvg width=\'8\' height=\'8\' viewBox=\'0 0 8 8\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Crect x=\'1\' y=\'1\' width=\'2\' height=\'6\' fill=\'rgba(255,255,255,0.5)\'/%3E%3Crect x=\'5\' y=\'1\' width=\'2\' height=\'6\' fill=\'rgba(255,255,255,0.5)\'/%3E%3C/svg%3E")',
  '#8b5cf6': 'url("data:image/svg+xml,%3Csvg width=\'8\' height=\'8\' viewBox=\'0 0 8 8\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cline x1=\'0\' y1=\'4\' x2=\'8\' y2=\'4\' stroke=\'rgba(255,255,255,0.5)\' stroke-width=\'1.5\'/%3E%3C/svg%3E")',
  '#3b82f6': 'url("data:image/svg+xml,%3Csvg width=\'8\' height=\'8\' viewBox=\'0 0 8 8\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cline x1=\'0\' y1=\'8\' x2=\'8\' y2=\'0\' stroke=\'rgba(255,255,255,0.5)\' stroke-width=\'1.5\'/%3E%3Cline x1=\'0\' y1=\'0\' x2=\'8\' y2=\'8\' stroke=\'rgba(255,255,255,0.5)\' stroke-width=\'1.5\'/%3E%3C/svg%3E")',
  '#6366f1': 'url("data:image/svg+xml,%3Csvg width=\'6\' height=\'6\' viewBox=\'0 0 6 6\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'1\' fill=\'rgba(255,255,255,0.5)\'/%3E%3C/svg%3E")',
};

function getPatternForColor(color: string): string | undefined {
  const lc = color.toLowerCase();
  return COLORBLIND_PATTERNS[lc] || Object.values(COLORBLIND_PATTERNS)[Math.abs(hashCode(lc)) % Object.values(COLORBLIND_PATTERNS).length];
}
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

const LABEL_COLORS = [
  '#22c55e', '#a3a306', '#f97316', '#ef4444', '#8b5cf6', '#3b82f6',
  '#ec4899', '#14b8a6', '#64748b', '#000000',
];

const REMINDER_OPTIONS = [
  { value: 'none', label: 'Sem lembrete' },
  { value: '5', label: '5 minutos antes' },
  { value: '15', label: '15 minutos antes' },
  { value: '30', label: '30 minutos antes' },
  { value: '60', label: '1 hora antes' },
  { value: '120', label: '2 horas antes' },
  { value: '1440', label: '1 dia antes' },
  { value: '2880', label: '2 dias antes' },
];

const ACTIVITY_ICONS: Record<string, any> = {
  move: Move,
  complete: CheckCircle2,
  label: Tag,
  assign: Users,
  create: Plus,
  automation: Zap,
};

// Simple rich text renderer for descriptions
function RichDescription({ text }: { text: string }) {
  const processLine = (line: string, idx: number) => {
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;
    
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|`(.+?)`)/g;
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(remaining)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={key++}>{remaining.slice(lastIndex, match.index)}</span>);
      }
      if (match[2]) parts.push(<strong key={key++} className="font-bold">{match[2]}</strong>);
      else if (match[3]) parts.push(<em key={key++} className="italic">{match[3]}</em>);
      else if (match[4]) parts.push(<span key={key++} className="line-through text-muted-foreground">{match[4]}</span>);
      else if (match[5]) parts.push(<code key={key++} className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{match[5]}</code>);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < remaining.length) {
      parts.push(<span key={key++}>{remaining.slice(lastIndex)}</span>);
    }
    
    return <p key={idx} className="min-h-[1.5em]">{parts.length > 0 ? parts : line || '\u00A0'}</p>;
  };

  return (
    <div className="text-foreground text-[15px] leading-relaxed space-y-1.5">
      {text.split('\n').map((line, idx) => processLine(line, idx))}
    </div>
  );
}

// Trello-style description editor with toolbar and live preview
function DescriptionEditor({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(value);
  const [showPreview, setShowPreview] = useState(false);

  const wrapSelection = useCallback((before: string, after: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = text.slice(start, end);
    const newText = text.slice(0, start) + before + selected + after + text.slice(end);
    setText(newText);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  }, [text]);

  const insertAtCursor = useCallback((insert: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const newText = text.slice(0, start) + insert + text.slice(start);
    setText(newText);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + insert.length, start + insert.length);
    }, 0);
  }, [text]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') { e.preventDefault(); wrapSelection('**', '**'); }
      else if (e.key === 'i') { e.preventDefault(); wrapSelection('*', '*'); }
      else if (e.key === 's') { e.preventDefault(); onSave(text); }
    }
  }, [wrapSelection, text, onSave]);

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/40 flex-wrap">
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Negrito (Ctrl+B)" onClick={() => wrapSelection('**', '**')}>
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Itálico (Ctrl+I)" onClick={() => wrapSelection('*', '*')}>
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Tachado" onClick={() => wrapSelection('~~', '~~')}>
          <Strikethrough className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Lista" onClick={() => insertAtCursor('\n- ')}>
          <List className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Código" onClick={() => wrapSelection('`', '`')}>
          <Type className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Linha" onClick={() => insertAtCursor('\n---\n')}>
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button
          variant={showPreview ? "secondary" : "ghost"}
          size="sm"
          className="h-7 text-xs px-2"
          onClick={() => setShowPreview(!showPreview)}
        >
          <Eye className="h-3.5 w-3.5 mr-1" /> Pré-visualizar
        </Button>
      </div>
      {/* Editor or Preview */}
      {showPreview ? (
        <div className="w-full min-h-[160px] p-3 text-[15px] leading-relaxed bg-background">
          <RichDescription text={text || 'Nada para visualizar...'} />
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full min-h-[160px] p-3 text-[15px] leading-relaxed bg-background text-foreground resize-y outline-none placeholder:text-muted-foreground"
          placeholder="Adicione uma descrição mais detalhada..."
          autoFocus
        />
      )}
      {/* Actions */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-muted/20">
        <Button size="sm" onClick={() => onSave(text)}>Salvar</Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

interface TaskDetailDialogProps {
  task: BoardTask | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEdit: (t: BoardTask) => void;
  onUpdateTask?: (taskId: string, updates: Record<string, any>) => Promise<any>;
  taskLabels?: TaskLabel[];
  allLabels?: TaskLabel[];
  onToggleLabel?: (taskId: string, labelId: string) => void;
  onCreateLabel?: (name: string, color: string) => Promise<any>;
  onDeleteLabel?: (labelId: string) => Promise<any>;
  boardId?: string | null;
  onOpenAutomation?: (taskId: string) => void;
  columns?: { id: string; title: string; color: string }[];
  onDuplicateTemplate?: (template: BoardTask, targetColumnId: string) => void;
  onMakeTemplate?: (taskId: string) => void;
}

export function TaskDetailDialog({ task, open, onOpenChange, onEdit, onUpdateTask, taskLabels, allLabels, onToggleLabel, onCreateLabel, onDeleteLabel, boardId, onOpenAutomation, columns, onDuplicateTemplate, onMakeTemplate }: TaskDetailDialogProps) {
  const isMobile = useIsMobile();
  const { comments, addComment, loading: commentsLoading } = useTaskComments(task?.id || null);
  const { subtasks, addSubtask, toggleSubtask, deleteSubtask, completed, total, loading: subtasksLoading } = useSubtasks(task?.id || null, boardId);
  const { groups, addGroup, deleteGroup, loading: groupsLoading } = useSubtaskGroups(task?.id || null);
  const { activities, loading: activitiesLoading } = useTaskActivities(task?.id || null);

  const [newComment, setNewComment] = useState('');
  const [newGroupSubtask, setNewGroupSubtask] = useState<Record<string, string>>({});
  const [newSubtask, setNewSubtask] = useState('');
  const [sending, setSending] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [activeAddItem, setActiveAddItem] = useState<string | null>(null);
  const [showActivity, setShowActivity] = useState(true);
  const [reminderValue, setReminderValue] = useState<string>('none');
  const [editingDescription, setEditingDescription] = useState(false);

  if (!task) return null;

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setSending(true);
    await addComment(newComment.trim());
    setNewComment('');
    setSending(false);
  };

  const handleAddSubtask = async (groupId?: string | null) => {
    const text = groupId ? (newGroupSubtask[groupId] || '') : newSubtask;
    if (!text.trim()) return;
    await addSubtask(text.trim(), groupId);
    if (groupId) {
      setNewGroupSubtask(prev => ({ ...prev, [groupId]: '' }));
    } else {
      setNewSubtask('');
    }
  };

  const handleAddGroup = async () => {
    if (!newGroupTitle.trim()) return;
    await addGroup(newGroupTitle.trim());
    setNewGroupTitle('');
    setShowAddGroup(false);
  };

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleSaveReminder = async (minutes: string) => {
    setReminderValue(minutes);
    if (onUpdateTask && task) {
      await onUpdateTask(task.id, { reminder_minutes: minutes === 'none' ? null : parseInt(minutes) });
    }
  };

  const cover = getCoverDisplay(task.cover_image);
  const ungroupedSubtasks = subtasks.filter(s => !s.group_id);
  const overallProgress = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Merge comments and activities into timeline
  type TimelineItem =
    | { kind: 'comment'; id: string; content: string; created_at: string; author?: any }
    | { kind: 'activity'; id: string; description: string; created_at: string; user_name: string; action_type: string };

  const timeline: TimelineItem[] = [
    ...comments.map(c => ({ kind: 'comment' as const, ...c })),
    ...(showActivity ? activities.map(a => ({ kind: 'activity' as const, ...a })) : []),
  ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // ===== Shared render sections =====

  const renderTemplateBanner = () => task.is_template ? (
    <div className="mx-4 mt-3 mb-1 rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Layout className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">Este é um template de cartão.</p>
        <p className="text-xs text-muted-foreground">Use-o como base para criar novos cartões.</p>
      </div>
      {columns && onDuplicateTemplate && (
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" className="gap-1.5 rounded-md text-xs bg-primary text-primary-foreground hover:bg-primary/90">
              <Copy className="h-3.5 w-3.5" /> Criar cartão com base em template
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="end">
            {columns.map(c => (
              <button
                key={c.id}
                onClick={() => { onDuplicateTemplate(task, c.id); onOpenChange(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted rounded-md transition-colors"
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                {c.title}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      )}
    </div>
  ) : null;

  const renderCover = () => (
    <>
      {cover.type === 'color' && <div className={cn('h-3 rounded-t-lg', cover.value)} />}
      {cover.type === 'image' && (
        <div className={cn(isMobile ? 'h-28' : 'h-40', 'rounded-t-lg overflow-hidden')}>
          <img src={cover.value} alt="Capa" className="w-full h-full object-cover" />
        </div>
      )}
    </>
  );

  const renderHeader = () => (
    <div className="px-4 pt-3 pb-2">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <Badge variant="outline">#{task.task_number}</Badge>
        <Badge className={cn(
          task.priority === 'urgent' && 'bg-red-500',
          task.priority === 'high' && 'bg-orange-500',
          task.priority === 'medium' && 'bg-blue-500',
          task.priority === 'low' && 'bg-gray-500', 'text-white'
        )}>
          {PRIORITIES.find(p => p.id === task.priority)?.label}
        </Badge>
        {taskLabels && taskLabels.map(l => (
          <Badge key={l.id} className="text-white text-[10px]" style={{ backgroundColor: l.color }}>{l.name}</Badge>
        ))}
      </div>
      <h2 className="text-xl font-bold text-foreground">{task.title}</h2>
    </div>
  );

  const renderActionButtons = () => (
    <div className="px-4 py-2">
      <div className="flex flex-wrap gap-1.5">
        {allLabels && allLabels.length > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5 rounded-md h-8 text-xs" onClick={() => setShowLabelPicker(!showLabelPicker)}>
            <Tag className="h-3.5 w-3.5" /> Etiquetas
          </Button>
        )}
        {!task.is_template && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-md h-8 text-xs">
              <CalendarIcon className="h-3.5 w-3.5" /> Datas
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto space-y-3 p-3" align="start">
            <h4 className="font-semibold text-sm">Data de término</h4>
            <Calendar
              mode="single"
              selected={task.due_date ? new Date(task.due_date) : undefined}
              onSelect={async (date) => {
                if (onUpdateTask && task) {
                  await onUpdateTask(task.id, { due_date: date ? date.toISOString() : null });
                }
              }}
              locale={ptBR}
              className="pointer-events-auto"
              initialFocus
            />
            {task.due_date && (
              <div className="text-xs text-muted-foreground text-center">
                Selecionada: {new Date(task.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
            )}
            <div className="border-t border-border pt-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-medium">Definir lembrete</p>
              </div>
              <Select value={reminderValue} onValueChange={handleSaveReminder}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REMINDER_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Lembretes serão enviados a todos os membros deste cartão</p>
            </div>
          </PopoverContent>
        </Popover>
        )}
        <Button variant="outline" size="sm" className="gap-1.5 rounded-md h-8 text-xs" onClick={() => setShowAddGroup(true)}>
          <CheckSquare className="h-3.5 w-3.5" /> Checklist
        </Button>
        {!task.is_template && (
          <Button variant="outline" size="sm" className="gap-1.5 rounded-md h-8 text-xs" onClick={() => onEdit(task)}>
            <Users className="h-3.5 w-3.5" /> Membros
          </Button>
        )}
      </div>
      {/* Label picker */}
      {showLabelPicker && allLabels && onToggleLabel && (
        <div className="flex flex-wrap gap-1.5 pt-2">
          {allLabels.map(l => {
            const isAssigned = taskLabels?.some(tl => tl.id === l.id);
            return (
              <button
                key={l.id}
                onClick={() => onToggleLabel(task.id, l.id)}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-medium text-white border-2 transition-all',
                  isAssigned ? 'border-foreground/50 ring-1 ring-foreground/20' : 'border-transparent opacity-60 hover:opacity-100'
                )}
                style={{ backgroundColor: l.color }}
              >{l.name}</button>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderInfoRow = () => (
    <div className="px-4 py-2">
      <div className="grid grid-cols-2 gap-4">
        {task.assignee && (
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={task.assignee.avatar_url || ''} />
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">{getInitials(task.assignee.display_name || task.assignee.name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs text-muted-foreground">Responsável</p>
              <p className="text-sm font-medium">{task.assignee.display_name || task.assignee.name}</p>
            </div>
          </div>
        )}
        {task.due_date && (
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Entrega</p>
              <p className="text-sm font-medium">{new Date(task.due_date).toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const handleSaveDescription = async (newDesc: string) => {
    if (onUpdateTask && task) {
      await onUpdateTask(task.id, { description: newDesc || null });
    }
    setEditingDescription(false);
  };

  const renderDescription = () => (
    <div className="px-4 py-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Descrição</h4>
      {editingDescription ? (
        <DescriptionEditor
          value={task.description || ''}
          onSave={handleSaveDescription}
          onCancel={() => setEditingDescription(false)}
        />
      ) : (
        <div
          className="bg-muted/30 border border-border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors min-h-[60px]"
          onDoubleClick={() => setEditingDescription(true)}
        >
          {task.description ? (
            <RichDescription text={task.description} />
          ) : (
            <p className="text-[15px] text-muted-foreground">Clique duas vezes para adicionar uma descrição...</p>
          )}
        </div>
      )}
    </div>
  );

  const renderProgress = () => total > 0 ? (
    <div className="px-4 py-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">Progresso geral</span>
        <span className="text-xs font-medium">{completed}/{total} ({overallProgress}%)</span>
      </div>
      <Progress value={overallProgress} className="h-1.5" />
    </div>
  ) : null;

  const renderSubtaskGroup = (group: any) => {
    const groupSubtasks = subtasks.filter(s => s.group_id === group.id);
    const gCompleted = groupSubtasks.filter(s => s.is_completed).length;
    const gTotal = groupSubtasks.length;
    const gProgress = gTotal > 0 ? Math.round((gCompleted / gTotal) * 100) : 0;
    const isCollapsed = collapsedGroups.has(group.id);

    return (
      <div key={group.id} className="border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/50">
          <button onClick={() => toggleGroupCollapse(group.id)} className="p-0.5">
            {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          <CheckSquare className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm flex-1">{group.title}</h4>
          {gTotal > 0 && <span className="text-xs text-muted-foreground">{gCompleted}/{gTotal}</span>}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteGroup(group.id)}>
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
        {gTotal > 0 && !isCollapsed && (
          <div className="px-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-8">{gProgress}%</span>
              <Progress value={gProgress} className="h-1.5 flex-1" />
            </div>
          </div>
        )}
        {!isCollapsed && (
          <div className="px-3 py-2 space-y-1">
            {groupSubtasks.map(s => (
              <div key={s.id} className="flex items-center gap-2 group py-0.5">
                <Checkbox checked={s.is_completed} onCheckedChange={(checked) => toggleSubtask(s.id, !!checked)} />
                <span className={cn('text-sm flex-1', s.is_completed && 'line-through text-muted-foreground')}>{s.title}</span>
                <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteSubtask(s.id)}>
                  <X className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
            {activeAddItem === group.id ? (
              <div className="pt-1 space-y-2">
                <Input
                  value={newGroupSubtask[group.id] || ''}
                  onChange={(e) => setNewGroupSubtask(prev => ({ ...prev, [group.id]: e.target.value }))}
                  placeholder="Adicionar um item"
                  className="h-8 text-sm"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask(group.id)}
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => handleAddSubtask(group.id)} disabled={!(newGroupSubtask[group.id] || '').trim()}>Adicionar</Button>
                  <Button variant="ghost" size="sm" onClick={() => setActiveAddItem(null)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="w-full text-xs gap-1 mt-1 justify-start text-muted-foreground" onClick={() => setActiveAddItem(group.id)}>
                Adicionar um item
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderUngroupedSubtasks = () => ungroupedSubtasks.length > 0 ? (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/50">
        <CheckSquare className="h-4 w-4 text-primary" />
        <h4 className="font-semibold text-sm flex-1">Subtarefas</h4>
        <span className="text-xs text-muted-foreground">{ungroupedSubtasks.filter(s => s.is_completed).length}/{ungroupedSubtasks.length}</span>
      </div>
      <div className="px-3 py-2 space-y-1">
        {ungroupedSubtasks.map(s => (
          <div key={s.id} className="flex items-center gap-2 group py-0.5">
            <Checkbox checked={s.is_completed} onCheckedChange={(checked) => toggleSubtask(s.id, !!checked)} />
            <span className={cn('text-sm flex-1', s.is_completed && 'line-through text-muted-foreground')}>{s.title}</span>
            <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteSubtask(s.id)}>
              <X className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ))}
        {activeAddItem === 'ungrouped' ? (
          <div className="pt-1 space-y-2">
            <Input value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} placeholder="Adicionar um item" className="h-8 text-sm" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask(null)} />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => handleAddSubtask(null)} disabled={!newSubtask.trim()}>Adicionar</Button>
              <Button variant="ghost" size="sm" onClick={() => setActiveAddItem(null)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="w-full text-xs gap-1 mt-1 justify-start text-muted-foreground" onClick={() => setActiveAddItem('ungrouped')}>
            Adicionar um item
          </Button>
        )}
      </div>
    </div>
  ) : null;

  const renderAddChecklist = () => showAddGroup ? (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <h4 className="font-medium text-sm">Adicionar Checklist</h4>
      <Input value={newGroupTitle} onChange={(e) => setNewGroupTitle(e.target.value)} placeholder="Título" className="h-8 text-sm" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()} />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleAddGroup} disabled={!newGroupTitle.trim()}>Adicionar</Button>
        <Button variant="ghost" size="sm" onClick={() => { setShowAddGroup(false); setNewGroupTitle(''); }}>Cancelar</Button>
      </div>
    </div>
  ) : null;

  const renderSubtasks = () => (
    <div className="px-4 py-2 space-y-3">
      {!groupsLoading && groups.map(renderSubtaskGroup)}
      {!subtasksLoading && renderUngroupedSubtasks()}
      {renderAddChecklist()}
      {subtasksLoading && <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
    </div>
  );

  const renderTimeline = () => (
    <div className="py-3 space-y-3">
      {commentsLoading || activitiesLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : timeline.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum comentário</p>
      ) : timeline.map(item => {
        if (item.kind === 'comment') {
          return (
            <div key={item.id} className="flex gap-2 px-4">
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarImage src={item.author?.avatar_url || ''} />
                <AvatarFallback className="text-[9px] bg-muted">{getInitials(item.author?.display_name || item.author?.name || 'U')}</AvatarFallback>
              </Avatar>
              <div className="flex-1 bg-muted rounded-lg p-2.5">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium">{item.author?.display_name || item.author?.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(item.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm">{item.content}</p>
              </div>
            </div>
          );
        } else {
          const Icon = ACTIVITY_ICONS[item.action_type] || ArrowRight;
          return (
            <div key={item.id} className="flex items-start gap-2 px-4 py-1">
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-xs">
                  <span className="font-medium">{item.user_name}</span>{' '}
                  <span className="text-muted-foreground">{item.description}</span>
                </p>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(item.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        }
      })}
    </div>
  );

  const renderCommentInput = () => (
    <div className="p-3 border-t border-border">
      <div className="flex gap-2">
        <Input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Escrever um comentário..."
          className="text-sm"
          onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
        />
        <Button onClick={handleAddComment} disabled={sending || !newComment.trim()} size="sm" className="rounded-md">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar'}
        </Button>
      </div>
    </div>
  );

  const renderFooter = () => (
    <DialogFooter className="border-t border-border p-4 gap-2">
      {onOpenAutomation && (
        <Button variant="outline" className="gap-2 rounded-md" onClick={() => onOpenAutomation(task.id)}>
          <Zap className="h-4 w-4" /> Automações
        </Button>
      )}
      {!task.is_template && onMakeTemplate && (
        <Button variant="outline" className="gap-2 rounded-md" onClick={() => { onMakeTemplate(task.id); onOpenChange(false); }}>
          <Copy className="h-4 w-4" /> Tornar Template
        </Button>
      )}
      <div className="flex-1" />
      <Button variant="outline" className="rounded-md" onClick={() => onOpenChange(false)}>Fechar</Button>
    </DialogFooter>
  );

  const commentsHeader = (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        <h4 className="font-semibold text-sm">Comentários e atividade</h4>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1 rounded-md"
        onClick={() => setShowActivity(!showActivity)}
      >
        {showActivity ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        {showActivity ? 'Ocultar detalhes' : 'Mostrar detalhes'}
      </Button>
    </div>
  );

  // ===== MOBILE LAYOUT =====
  if (isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-full w-full h-[95vh] max-h-[95vh] overflow-hidden flex flex-col p-0 gap-0">
          {renderCover()}
          {renderTemplateBanner()}
          <ScrollArea className="flex-1">
            {renderHeader()}
            <div className="h-px bg-border mx-4" />
            {renderActionButtons()}
            <div className="h-px bg-border mx-4" />
            {!task.is_template && renderInfoRow()}
            {renderDescription()}
            <div className="h-px bg-border mx-4" />
            {renderProgress()}
            {renderSubtasks()}
            <div className="h-px bg-border mx-4 my-2" />
            {commentsHeader}
            {renderTimeline()}
            {renderCommentInput()}
          </ScrollArea>
          {renderFooter()}
        </DialogContent>
      </Dialog>
    );
  }

  // ===== DESKTOP LAYOUT =====
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        {renderCover()}
        {renderTemplateBanner()}
        {renderHeader()}
        <div className="h-px bg-border mx-4" />
        {renderActionButtons()}
        <div className="h-px bg-border mx-4" />

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Details & Subtasks */}
          <ScrollArea className="flex-1 border-r border-border">
            <div className="pb-6">
              {!task.is_template && renderInfoRow()}
              {renderDescription()}
              {renderProgress()}
              {renderSubtasks()}
            </div>
          </ScrollArea>

          {/* Right: Comments & Activity */}
          <div className="w-[320px] flex-shrink-0 flex flex-col max-h-full">
            {commentsHeader}
            <ScrollArea className="flex-1">
              {renderTimeline()}
            </ScrollArea>
            {renderCommentInput()}
          </div>
        </div>

        {renderFooter()}
      </DialogContent>
    </Dialog>
  );
}
