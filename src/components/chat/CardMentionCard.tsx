import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, Calendar, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const PRIORITY_LABELS: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' };
const PRIORITY_COLORS: Record<string, string> = { low: 'bg-gray-500', medium: 'bg-blue-500', high: 'bg-orange-500', urgent: 'bg-red-500' };

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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editDescription, setEditDescription] = useState(description || '');
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin, canAccess } = useAuth();
  const isMobile = useIsMobile();
  const canEditCard = isAdmin || canAccess('can_access_management');

  const openTaskInBoard = async () => {
    setLoading(true);
    const { data } = await supabase.from('tasks').select('id, board_id').eq('task_number', taskNumber).maybeSingle();
    setLoading(false);
    const taskId = (data as any)?.id as string | undefined;
    const boardId = (data as any)?.board_id as string | null | undefined;
    if (!taskId || !boardId) return;
    const next = new URLSearchParams(searchParams);
    next.set('section', 'tasks'); next.set('board', boardId); next.set('task', taskId);
    setSearchParams(next, { replace: false });
  };

  const openCard = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isMobile) setPreviewOpen(true); else void openTaskInBoard();
  };

  const saveEdit = async () => {
    if (!canEditCard || !editTitle.trim()) return;
    setEditLoading(true);
    const { error } = await supabase.from('tasks').update({ title: editTitle.trim(), description: editDescription.trim() }).eq('task_number', taskNumber);
    setEditLoading(false);
    if (error) return;
    setEditOpen(false);
    setPreviewOpen(false);
    window.location.reload();
  };

  const cardWidth = isMobile ? 'max-w-[280px]' : 'max-w-[380px]';
  const foreground = isOwnMessage ? 'text-white' : 'text-foreground';
  const muted = isOwnMessage ? 'text-white/70' : 'text-muted-foreground';

  return (
    <>
      <div className={cn('rounded-lg border overflow-hidden my-1', cardWidth, isOwnMessage ? 'bg-white/10 border-white/20' : 'bg-card border-border')}>
        <div className={cn('h-2', PRIORITY_COLORS[priority] || 'bg-blue-500')} />
        <div className={cn('space-y-2', isMobile ? 'p-2.5' : 'p-3')}>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn('text-[10px] flex-shrink-0', isOwnMessage && 'border-white/30 text-white/80')}>#{taskNumber}</Badge>
            <span className={cn('font-medium truncate', isMobile ? 'text-xs' : 'text-sm', foreground)}>{title}</span>
          </div>
          {labels && <div className="flex flex-wrap gap-1">{labels.split(', ').map((l, i) => <span key={i} className={cn('px-2 py-0.5 rounded-sm', isMobile ? 'text-[9px]' : 'text-[10px]', isOwnMessage ? 'bg-white/15 text-white/80' : 'bg-muted text-muted-foreground')}>🏷️ {l}</span>)}</div>}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn('text-white', isMobile ? 'text-[9px]' : 'text-[10px]', PRIORITY_COLORS[priority])}>{PRIORITY_LABELS[priority]}</Badge>
            {dueDate && <span className={cn('flex items-center gap-0.5', isMobile ? 'text-[10px]' : 'text-xs', muted)}><Calendar className="h-3 w-3" /> {dueDate}</span>}
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className={cn(muted, isMobile ? 'text-[9px]' : 'text-[10px]')}>📌 {boardName}</span>
            <Button variant="ghost" size="sm" disabled={loading} className={cn('gap-1', isMobile ? 'h-5 text-[10px] px-1.5' : 'h-6 text-xs px-2', isOwnMessage ? 'text-white/70 hover:text-white hover:bg-white/10' : '')} onClick={openCard}>
              <Eye className={cn(isMobile ? 'h-3 w-3' : 'h-3.5 w-3.5')} /> Abrir
            </Button>
          </div>
        </div>
      </div>

      {isMobile && <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[88vh] w-[calc(100%-24px)] max-w-md overflow-y-auto rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="pr-6 text-left">#{taskNumber} · {title}</DialogTitle>
            <DialogDescription className="text-left">Prévia completa do card</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className={cn('rounded-xl p-3', isOwnMessage ? 'bg-white/10' : 'bg-muted/50')}>
              <p className={cn('text-xs font-medium uppercase tracking-wide', muted)}>Quadro</p>
              <p className={cn('mt-1 text-sm font-semibold', foreground)}>{boardName}</p>
            </div>
            <div>
              <p className={cn('text-xs font-medium uppercase tracking-wide', muted)}>Título</p>
              <p className={cn('mt-1 whitespace-pre-wrap text-sm', foreground)}>{title}</p>
            </div>
            {description && <div><p className={cn('text-xs font-medium uppercase tracking-wide', muted)}>Descrição</p><p className={cn('mt-1 whitespace-pre-wrap text-sm leading-6', foreground)}>{description}</p></div>}
            {labels && <div><p className={cn('text-xs font-medium uppercase tracking-wide', muted)}>Etiquetas</p><div className="mt-2 flex flex-wrap gap-1.5">{labels.split(', ').map((l, i) => <Badge key={i} variant="secondary">🏷️ {l}</Badge>)}</div></div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Prioridade</p><Badge className={cn('mt-2 text-white', PRIORITY_COLORS[priority])}>{PRIORITY_LABELS[priority]}</Badge></div>
              <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Prazo</p><p className="mt-2 text-sm font-medium">{dueDate || 'Não informado'}</p></div>
            </div>
            <div className="flex gap-2 pt-1">
              {canEditCard && <Button variant="outline" className="flex-1 gap-2" onClick={() => { setEditTitle(title); setEditDescription(description || ''); setEditOpen(true); }}><Pencil className="h-4 w-4" /> Editar</Button>}
              <Button className="flex-1" onClick={() => setPreviewOpen(false)}>Fechar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>}

      {isMobile && <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="w-[calc(100%-24px)] max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>Editar card #{taskNumber}</DialogTitle><DialogDescription>Altere as informações permitidas e salve.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><label className="text-sm font-medium">Título</label><Input value={editTitle} onChange={e => setEditTitle(e.target.value)} /></div>
            <div className="space-y-2"><label className="text-sm font-medium">Descrição</label><Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} className="min-h-[120px]" /></div>
            <Button className="w-full" disabled={editLoading || !editTitle.trim()} onClick={saveEdit}>{editLoading ? 'Salvando...' : 'Salvar alterações'}</Button>
          </div>
        </DialogContent>
      </Dialog>}
    </>
  );
}
