import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, Calendar, User, ListTodo } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente',
};
const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-500', medium: 'bg-blue-500', high: 'bg-orange-500', urgent: 'bg-red-500',
};

interface CardMentionCardProps {
  taskNumber: number;
  title: string;
  description?: string;
  labels?: string;
  priority: string;
  dueDate?: string;
  boardName: string;
  isOwnMessage: boolean;
}

interface TaskSummary {
  title: string;
  description: string | null;
  priority: string;
  due_date: string | null;
  column_name: string | null;
  assignee_name: string | null;
}

export function CardMentionCard({ taskNumber, title, description, labels, priority, dueDate, boardName, isOwnMessage }: CardMentionCardProps) {
  const [loading, setLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [summary, setSummary] = useState<TaskSummary | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const openTaskInBoard = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tasks')
      .select('id, board_id, title, description, priority, due_date, assigned_to, column_id, profiles:assigned_to(name, display_name), task_columns:column_id(name)')
      .eq('task_number', taskNumber)
      .maybeSingle();
    setLoading(false);

    const task = data as any;
    if (!task?.id) return;

    if (isMobile) {
      setSummary({
        title: task.title || title,
        description: task.description || null,
        priority: task.priority || priority,
        due_date: task.due_date || null,
        column_name: task.task_columns?.name || null,
        assignee_name: task.profiles?.display_name || task.profiles?.name || null,
      });
      setSummaryOpen(true);
      return;
    }

    if (!task.board_id) return;
    const next = new URLSearchParams(searchParams);
    next.set('section', 'tasks');
    next.set('board', task.board_id);
    next.set('task', task.id);
    setSearchParams(next, { replace: false });
  };

  const cardWidth = isMobile ? 'max-w-[280px]' : 'max-w-[380px]';

  return (
    <>
      <div className={cn(
        'rounded-lg border overflow-hidden my-1',
        cardWidth,
        isOwnMessage ? 'bg-white/10 border-white/20' : 'bg-card border-border'
      )}>
        {/* Colored top bar */}
        <div className={cn('h-2', PRIORITY_COLORS[priority] || 'bg-blue-500')} />
        <div className={cn('space-y-2', isMobile ? 'p-2.5' : 'p-3')}>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn('text-[10px] flex-shrink-0', isOwnMessage && 'border-white/30 text-white/80')}>
              #{taskNumber}
            </Badge>
            <span className={cn('font-medium truncate', isMobile ? 'text-xs' : 'text-sm', isOwnMessage ? 'text-white' : 'text-foreground')}>
              {title}
            </span>
          </div>

          {/* Labels */}
          {labels && (
            <div className="flex flex-wrap gap-1">
              {labels.split(', ').map((l, i) => (
                <span key={i} className={cn('px-2 py-0.5 rounded-sm', isMobile ? 'text-[9px]' : 'text-[10px]', isOwnMessage ? 'bg-white/15 text-white/80' : 'bg-muted text-muted-foreground')}>
                  🏷️ {l}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn('text-white', isMobile ? 'text-[9px]' : 'text-[10px]', PRIORITY_COLORS[priority])}>
              {PRIORITY_LABELS[priority]}
            </Badge>
            {dueDate && (
              <span className={cn('flex items-center gap-0.5', isMobile ? 'text-[10px]' : 'text-xs', isOwnMessage ? 'text-white/70' : 'text-muted-foreground')}>
                <Calendar className="h-3 w-3" /> {dueDate}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className={cn(isOwnMessage ? 'text-white/50' : 'text-muted-foreground', isMobile ? 'text-[9px]' : 'text-[10px]')}>
              📌 {boardName}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={loading}
              className={cn(
                'gap-1',
                isMobile ? 'h-5 text-[10px] px-1.5' : 'h-6 text-xs px-2',
                isOwnMessage ? 'text-white/70 hover:text-white hover:bg-white/10' : '',
              )}
              onClick={(e) => { e.stopPropagation(); openTaskInBoard(); }}
            >
              <Eye className={cn(isMobile ? 'h-3 w-3' : 'h-3.5 w-3.5')} /> {isMobile ? 'Resumo' : 'Abrir'}
            </Button>
          </div>
        </div>
      </div>

      {/* Resumo da tarefa (mobile) */}
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-[92vw] rounded-2xl p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Badge variant="outline" className="text-[10px]">#{taskNumber}</Badge>
              <span className="truncate">{summary?.title || title}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn('text-white text-[10px]', PRIORITY_COLORS[summary?.priority || priority])}>
                {PRIORITY_LABELS[summary?.priority || priority]}
              </Badge>
              {summary?.column_name && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ListTodo className="h-3 w-3" /> {summary.column_name}
                </span>
              )}
              {summary?.due_date && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" /> {new Date(summary.due_date).toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>
            {summary?.assignee_name && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="h-3 w-3" /> Responsável: <span className="font-medium text-foreground">{summary.assignee_name}</span>
              </div>
            )}
            {summary?.description ? (
              <p className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-2.5 text-xs text-foreground/90">
                {summary.description}
              </p>
            ) : (
              <p className="text-xs italic text-muted-foreground">Sem descrição.</p>
            )}
            <p className="text-[10px] text-muted-foreground">📌 {boardName}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
