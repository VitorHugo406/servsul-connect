import { useState } from 'react';
import { Calendar, CheckSquare, Edit, Loader2, MessageSquare, Plus, Tag, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react';
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
import { useSubtaskGroups } from '@/hooks/useSubtaskGroups';
import { TaskLabel } from '@/hooks/useTaskLabels';
import { PRIORITIES, getInitials, getCoverDisplay } from './taskConstants';
import { cn } from '@/lib/utils';

export function TaskDetailDialog({ task, open, onOpenChange, onEdit, taskLabels, allLabels, onToggleLabel, boardId }: {
  task: BoardTask | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEdit: (t: BoardTask) => void;
  taskLabels?: TaskLabel[];
  allLabels?: TaskLabel[];
  onToggleLabel?: (taskId: string, labelId: string) => void;
  boardId?: string | null;
}) {
  const { comments, addComment, loading: commentsLoading } = useTaskComments(task?.id || null);
  const { subtasks, addSubtask, toggleSubtask, deleteSubtask, completed, total, loading: subtasksLoading } = useSubtasks(task?.id || null, boardId);
  const { groups, addGroup, deleteGroup, updateGroup, loading: groupsLoading } = useSubtaskGroups(task?.id || null);
  const [newComment, setNewComment] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [newGroupSubtask, setNewGroupSubtask] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [activeAddItem, setActiveAddItem] = useState<string | null>(null); // group id or 'ungrouped'

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

  const cover = getCoverDisplay(task.cover_image);
  const ungroupedSubtasks = subtasks.filter(s => !s.group_id);
  const overallProgress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Cover */}
        {cover.type === 'color' && <div className={cn('h-3 rounded-t-lg', cover.value)} />}
        {cover.type === 'image' && (
          <div className="h-40 rounded-t-lg overflow-hidden">
            <img src={cover.value} alt="Capa" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Header */}
        <div className="px-6 pt-4 pb-2">
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
          {showLabelPicker && allLabels && onToggleLabel && (
            <div className="flex flex-wrap gap-1.5 pb-2">
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
        </div>

        {/* Two-column Trello-style layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Details, Subtasks */}
          <ScrollArea className="flex-1 border-r border-border">
            <div className="px-6 pb-6 space-y-5">
              {/* Info row */}
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

              {/* Description */}
              {task.description && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Descrição</h4>
                  <p className="text-foreground text-sm whitespace-pre-wrap">{task.description}</p>
                </div>
              )}

              {/* Overall subtask progress */}
              {total > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Progresso geral</span>
                    <span className="text-xs font-medium">{completed}/{total} ({overallProgress}%)</span>
                  </div>
                  <Progress value={overallProgress} className="h-1.5" />
                </div>
              )}

              {/* Subtask Groups */}
              {!groupsLoading && groups.map(group => {
                const groupSubtasks = subtasks.filter(s => s.group_id === group.id);
                const groupCompleted = groupSubtasks.filter(s => s.is_completed).length;
                const groupTotal = groupSubtasks.length;
                const groupProgress = groupTotal > 0 ? Math.round((groupCompleted / groupTotal) * 100) : 0;
                const isCollapsed = collapsedGroups.has(group.id);

                return (
                  <div key={group.id} className="border border-border rounded-lg overflow-hidden">
                    {/* Group header */}
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/50">
                      <button onClick={() => toggleGroupCollapse(group.id)} className="p-0.5">
                        {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </button>
                      <CheckSquare className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold text-sm flex-1">{group.title}</h4>
                      {groupTotal > 0 && (
                        <span className="text-xs text-muted-foreground">{groupCompleted}/{groupTotal}</span>
                      )}
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteGroup(group.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                    {/* Group progress */}
                    {groupTotal > 0 && !isCollapsed && (
                      <div className="px-3 pt-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-8">{groupProgress}%</span>
                          <Progress value={groupProgress} className="h-1.5 flex-1" />
                        </div>
                      </div>
                    )}
                    {/* Group subtasks */}
                    {!isCollapsed && (
                      <div className="px-3 py-2 space-y-1">
                        {groupSubtasks.map(s => (
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
                        {/* Add item to group */}
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
                              <Button size="sm" onClick={() => handleAddSubtask(group.id)} disabled={!(newGroupSubtask[group.id] || '').trim()}>
                                Adicionar
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setActiveAddItem(null)}>
                                Cancelar
                              </Button>
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
              })}

              {/* Ungrouped subtasks */}
              {!subtasksLoading && ungroupedSubtasks.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/50">
                    <CheckSquare className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold text-sm flex-1">Subtarefas</h4>
                    <span className="text-xs text-muted-foreground">
                      {ungroupedSubtasks.filter(s => s.is_completed).length}/{ungroupedSubtasks.length}
                    </span>
                  </div>
                  {ungroupedSubtasks.length > 0 && (
                    <div className="px-3 pt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-8">
                          {Math.round((ungroupedSubtasks.filter(s => s.is_completed).length / ungroupedSubtasks.length) * 100)}%
                        </span>
                        <Progress value={Math.round((ungroupedSubtasks.filter(s => s.is_completed).length / ungroupedSubtasks.length) * 100)} className="h-1.5 flex-1" />
                      </div>
                    </div>
                  )}
                  <div className="px-3 py-2 space-y-1">
                    {ungroupedSubtasks.map(s => (
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
                    {activeAddItem === 'ungrouped' ? (
                      <div className="pt-1 space-y-2">
                        <Input
                          value={newSubtask}
                          onChange={(e) => setNewSubtask(e.target.value)}
                          placeholder="Adicionar um item"
                          className="h-8 text-sm"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask(null)}
                        />
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => handleAddSubtask(null)} disabled={!newSubtask.trim()}>
                            Adicionar
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setActiveAddItem(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="w-full text-xs gap-1 mt-1 justify-start text-muted-foreground" onClick={() => setActiveAddItem('ungrouped')}>
                        Adicionar um item
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Add new checklist group button */}
              {showAddGroup ? (
                <div className="border border-border rounded-lg p-3 space-y-2">
                  <h4 className="font-medium text-sm">Adicionar Checklist</h4>
                  <Input
                    value={newGroupTitle}
                    onChange={(e) => setNewGroupTitle(e.target.value)}
                    placeholder="Título"
                    className="h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddGroup} disabled={!newGroupTitle.trim()}>
                      Adicionar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setShowAddGroup(false); setNewGroupTitle(''); }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAddGroup(true)}>
                    <CheckSquare className="h-3.5 w-3.5" /> Checklist
                  </Button>
                  {groups.length === 0 && ungroupedSubtasks.length === 0 && (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setActiveAddItem('ungrouped')}>
                      <Plus className="h-3.5 w-3.5" /> Subtarefa
                    </Button>
                  )}
                </div>
              )}

              {subtasksLoading && (
                <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              )}
            </div>
          </ScrollArea>

          {/* Right: Comments */}
          <div className="w-[320px] flex-shrink-0 flex flex-col max-h-full">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
              <MessageSquare className="h-4 w-4" />
              <h4 className="font-semibold text-sm">Comentários e atividade</h4>
            </div>
            <ScrollArea className="flex-1 px-4">
              <div className="py-3 space-y-3">
                {commentsLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum comentário</p>
                ) : (
                  comments.map(c => (
                    <div key={c.id} className="flex gap-2">
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
                  ))
                )}
              </div>
            </ScrollArea>
            <div className="p-3 border-t border-border">
              <div className="flex gap-2">
                <Input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Escrever um comentário..."
                  className="text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                />
                <Button onClick={handleAddComment} disabled={sending || !newComment.trim()} size="sm">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="border-t border-border p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={() => onEdit(task)}><Edit className="h-4 w-4 mr-2" /> Editar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
