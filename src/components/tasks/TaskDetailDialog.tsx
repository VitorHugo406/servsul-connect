import { useState } from 'react';
import { Calendar, CheckSquare, Edit, Loader2, MessageSquare, Plus, Tag, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { BoardTask } from '@/hooks/useBoardTasks';
import { useTaskComments } from '@/hooks/useTasks';
import { useSubtasks } from '@/hooks/useSubtasks';
import { TaskLabel } from '@/hooks/useTaskLabels';
import { PRIORITIES, getInitials, getCoverDisplay } from './taskConstants';
import { cn } from '@/lib/utils';

export function TaskDetailDialog({ task, open, onOpenChange, onEdit, taskLabels, allLabels, onToggleLabel }: {
  task: BoardTask | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEdit: (t: BoardTask) => void;
  taskLabels?: TaskLabel[];
  allLabels?: TaskLabel[];
  onToggleLabel?: (taskId: string, labelId: string) => void;
}) {
  const { comments, addComment, loading: commentsLoading } = useTaskComments(task?.id || null);
  const { subtasks, addSubtask, toggleSubtask, deleteSubtask, completed, total, loading: subtasksLoading } = useSubtasks(task?.id || null);
  const [newComment, setNewComment] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [sending, setSending] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  if (!task) return null;

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setSending(true);
    await addComment(newComment.trim());
    setNewComment('');
    setSending(false);
  };

  const handleAddSubtask = async () => {
    if (!newSubtask.trim()) return;
    await addSubtask(newSubtask.trim());
    setNewSubtask('');
  };

  const cover = getCoverDisplay(task.cover_image);
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {cover.type === 'color' && <div className={cn('h-3 -mx-6 -mt-6 mb-2 rounded-t-lg', cover.value)} />}
        {cover.type === 'image' && (
          <div className="-mx-6 -mt-6 mb-2 h-40 rounded-t-lg overflow-hidden">
            <img src={cover.value} alt="Capa" className="w-full h-full object-cover" />
          </div>
        )}
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">#{task.task_number}</Badge>
            <Badge className={cn(
              task.priority === 'urgent' && 'bg-red-500',
              task.priority === 'high' && 'bg-orange-500',
              task.priority === 'medium' && 'bg-blue-500',
              task.priority === 'low' && 'bg-gray-500', 'text-white'
            )}>
              {PRIORITIES.find(p => p.id === task.priority)?.label}
            </Badge>
            {/* Labels on card detail */}
            {taskLabels && taskLabels.length > 0 && taskLabels.map(l => (
              <Badge key={l.id} className="text-white text-[10px]" style={{ backgroundColor: l.color }}>
                {l.name}
              </Badge>
            ))}
            {allLabels && allLabels.length > 0 && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowLabelPicker(!showLabelPicker)}>
                <Tag className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          {/* Inline label picker */}
          {showLabelPicker && allLabels && onToggleLabel && (
            <div className="flex flex-wrap gap-1.5 pt-1">
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
                  >
                    {l.name}
                  </button>
                );
              })}
            </div>
          )}
          <DialogTitle className="text-xl">{task.title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pb-4">
            {task.description && <p className="text-foreground">{task.description}</p>}
            <div className="grid grid-cols-2 gap-4">
              {task.assignee && (
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={task.assignee.avatar_url || ''} />
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {getInitials(task.assignee.display_name || task.assignee.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs text-muted-foreground">Responsável</p>
                    <p className="text-sm font-medium">{task.assignee.display_name || task.assignee.name}</p>
                  </div>
                </div>
              )}
              {task.due_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Entrega</p>
                    <p className="text-sm font-medium">{new Date(task.due_date).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Subtasks / Checklist */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckSquare className="h-4 w-4" />
                <h4 className="font-medium">Subtarefas</h4>
                {total > 0 && (
                  <span className="text-xs text-muted-foreground ml-auto">{completed}/{total}</span>
                )}
              </div>
              {total > 0 && (
                <Progress value={progress} className="h-1.5 mb-3" />
              )}
              {subtasksLoading ? (
                <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="space-y-1 mb-2">
                  {subtasks.map(s => (
                    <div key={s.id} className="flex items-center gap-2 group py-0.5">
                      <Checkbox
                        checked={s.is_completed}
                        onCheckedChange={(checked) => toggleSubtask(s.id, !!checked)}
                      />
                      <span className={cn('text-sm flex-1', s.is_completed && 'line-through text-muted-foreground')}>{s.title}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deleteSubtask(s.id)}
                      >
                        <X className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  placeholder="Nova subtarefa..."
                  className="h-8 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                />
                <Button onClick={handleAddSubtask} disabled={!newSubtask.trim()} size="sm" variant="outline" className="h-8">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Comments */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="h-4 w-4" />
                <h4 className="font-medium">Comentários</h4>
              </div>
              {commentsLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">Nenhum comentário</p>
              ) : (
                <div className="space-y-3 mb-4">
                  {comments.map(c => (
                    <div key={c.id} className="flex gap-3">
                      <Avatar className="h-7 w-7 flex-shrink-0">
                        <AvatarImage src={c.author?.avatar_url || ''} />
                        <AvatarFallback className="text-[9px] bg-muted">{getInitials(c.author?.display_name || c.author?.name || 'U')}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 bg-muted rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium">{c.author?.display_name || c.author?.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(c.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm">{c.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Comentar..." onKeyDown={(e) => e.key === 'Enter' && handleAddComment()} />
                <Button onClick={handleAddComment} disabled={sending || !newComment.trim()} size="sm">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar'}
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="border-t border-border pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={() => onEdit(task)}><Edit className="h-4 w-4 mr-2" /> Editar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
