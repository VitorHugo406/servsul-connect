import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Calendar } from 'lucide-react';
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

export function CardMentionCard({ taskNumber, title, description, labels, priority, dueDate, boardName, isOwnMessage }: CardMentionCardProps) {
  const [loading, setLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();

  const openTaskInBoard = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tasks')
      .select('id, board_id')
      .eq('task_number', taskNumber)
      .maybeSingle();
    setLoading(false);

    const taskId = (data as any)?.id as string | undefined;
    const boardId = (data as any)?.board_id as string | null | undefined;

    if (!taskId || !boardId) return;

    const next = new URLSearchParams(searchParams);
    next.set('section', 'tasks');
    next.set('board', boardId);
    next.set('task', taskId);
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
              <Eye className={cn(isMobile ? 'h-3 w-3' : 'h-3.5 w-3.5')} /> Abrir
            </Button>
          </div>
        </div>
      </div>

    </>
  );
}
