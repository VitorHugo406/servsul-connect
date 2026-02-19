import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, Calendar, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

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

export function CardMentionCard({ taskNumber, title, description, labels, priority, dueDate, boardName, isOwnMessage }: CardMentionCardProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [fullTask, setFullTask] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadFullTask = async () => {
    setLoading(true);
    setShowPreview(true);
    const { data } = await supabase
      .from('tasks')
      .select('*, assignee:profiles!tasks_assigned_to_fkey(id, name, display_name, avatar_url)')
      .eq('task_number', taskNumber)
      .maybeSingle();
    setFullTask(data);
    setLoading(false);
  };

  return (
    <>
      <div className={cn(
        'rounded-lg border overflow-hidden my-1 max-w-[280px]',
        isOwnMessage ? 'bg-white/10 border-white/20' : 'bg-card border-border'
      )}>
        {/* Colored top bar */}
        <div className={cn('h-1.5', PRIORITY_COLORS[priority] || 'bg-blue-500')} />
        <div className="p-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={cn('text-[9px] flex-shrink-0', isOwnMessage && 'border-white/30 text-white/80')}>
              #{taskNumber}
            </Badge>
            <span className={cn('text-xs font-medium truncate', isOwnMessage ? 'text-white' : 'text-foreground')}>
              {title}
            </span>
          </div>

          {/* Labels */}
          {labels && (
            <div className="flex flex-wrap gap-1">
              {labels.split(', ').map((l, i) => (
                <span key={i} className={cn('text-[9px] px-1.5 py-0.5 rounded-sm', isOwnMessage ? 'bg-white/15 text-white/80' : 'bg-muted text-muted-foreground')}>
                  🏷️ {l}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn('text-[9px] text-white', PRIORITY_COLORS[priority])}>
              {PRIORITY_LABELS[priority]}
            </Badge>
            {dueDate && (
              <span className={cn('text-[10px] flex items-center gap-0.5', isOwnMessage ? 'text-white/70' : 'text-muted-foreground')}>
                <Calendar className="h-3 w-3" /> {dueDate}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className={cn('text-[9px]', isOwnMessage ? 'text-white/50' : 'text-muted-foreground')}>
              📌 {boardName}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-5 text-[10px] px-1.5 gap-0.5', isOwnMessage ? 'text-white/70 hover:text-white hover:bg-white/10' : '')}
              onClick={(e) => { e.stopPropagation(); loadFullTask(); }}
            >
              <Eye className="h-3 w-3" /> Ver
            </Button>
          </div>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>📋</span> Card #{taskNumber}
            </DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : fullTask ? (
            <div className="space-y-4">
              <div className={cn('h-2 rounded', PRIORITY_COLORS[fullTask.priority])} />
              <h3 className="font-semibold text-lg">{fullTask.title}</h3>
              {fullTask.description && <p className="text-sm text-muted-foreground">{fullTask.description}</p>}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Prioridade:</span> <Badge className={cn('text-white ml-1', PRIORITY_COLORS[fullTask.priority])}>{PRIORITY_LABELS[fullTask.priority]}</Badge></div>
                <div><span className="text-muted-foreground">Status:</span> <span className="ml-1 font-medium">{fullTask.status}</span></div>
                {fullTask.due_date && <div><span className="text-muted-foreground">Prazo:</span> <span className="ml-1">{new Date(fullTask.due_date).toLocaleDateString('pt-BR')}</span></div>}
                {fullTask.assignee && <div><span className="text-muted-foreground">Responsável:</span> <span className="ml-1">{fullTask.assignee.display_name || fullTask.assignee.name}</span></div>}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Card não encontrado ou sem acesso</div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
