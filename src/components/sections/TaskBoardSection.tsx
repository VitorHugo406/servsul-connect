 import { useState } from 'react';
 import { motion } from 'framer-motion';
 import { 
   Plus, 
   MoreVertical, 
   Calendar,
   User,
   Trash2,
   Edit,
   Loader2,
   CheckCircle2,
   Clock,
   AlertCircle,
   Circle,
   GripVertical,
  ListTodo,
  MessageSquare,
  X
 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Textarea } from '@/components/ui/textarea';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTasks, useTaskComments, Task } from '@/hooks/useTasks';
 import { useActiveUsers } from '@/hooks/useDirectMessages';
 import { useSectors } from '@/hooks/useData';
 import { useIsMobile } from '@/hooks/use-mobile';
 import { cn } from '@/lib/utils';
 import { toast } from 'sonner';
 
 const COLUMNS = [
   { id: 'todo', title: 'A Fazer', icon: Circle, color: 'text-muted-foreground' },
   { id: 'in_progress', title: 'Em Progresso', icon: Clock, color: 'text-blue-500' },
   { id: 'review', title: 'Em Revisão', icon: AlertCircle, color: 'text-yellow-500' },
   { id: 'done', title: 'Concluído', icon: CheckCircle2, color: 'text-green-500' },
 ];
 
 const PRIORITIES = [
   { id: 'low', label: 'Baixa', color: 'bg-gray-500' },
   { id: 'medium', label: 'Média', color: 'bg-blue-500' },
   { id: 'high', label: 'Alta', color: 'bg-orange-500' },
   { id: 'urgent', label: 'Urgente', color: 'bg-red-500' },
 ];
 
 export function TaskBoardSection() {
   const { tasks, loading, createTask, updateTask, deleteTask, moveTask } = useTasks();
   const { users } = useActiveUsers();
   const { sectors } = useSectors();
   const isMobile = useIsMobile();
   
   const [showCreateDialog, setShowCreateDialog] = useState(false);
   const [showEditDialog, setShowEditDialog] = useState(false);
  const [showTaskDetailDialog, setShowTaskDetailDialog] = useState(false);
   const [selectedTask, setSelectedTask] = useState<Task | null>(null);
   const [creating, setCreating] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
   
   // Form state
   const [title, setTitle] = useState('');
   const [description, setDescription] = useState('');
   const [priority, setPriority] = useState('medium');
   const [assignedTo, setAssignedTo] = useState('');
   const [sectorId, setSectorId] = useState('');
   const [dueDate, setDueDate] = useState('');
  const [newComment, setNewComment] = useState('');
 
   const resetForm = () => {
     setTitle('');
     setDescription('');
     setPriority('medium');
     setAssignedTo('');
     setSectorId('');
     setDueDate('');
   };
 
   const handleCreate = async () => {
     if (!title.trim()) {
       toast.error('Título é obrigatório');
       return;
     }
 
     setCreating(true);
     const { error } = await createTask({
       title: title.trim(),
       description: description.trim() || undefined,
       priority,
       assigned_to: assignedTo || undefined,
       sector_id: sectorId || undefined,
       due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
     });
     setCreating(false);
 
     if (error) {
       toast.error('Erro ao criar tarefa');
     } else {
       toast.success('Tarefa criada!');
       resetForm();
       setShowCreateDialog(false);
     }
   };
 
   const handleEdit = async () => {
     if (!selectedTask || !title.trim()) return;
 
     setCreating(true);
     const { error } = await updateTask(selectedTask.id, {
       title: title.trim(),
       description: description.trim() || null,
       priority: priority as Task['priority'],
       assigned_to: assignedTo || null,
       sector_id: sectorId || null,
       due_date: dueDate ? new Date(dueDate).toISOString() : null,
     });
     setCreating(false);
 
     if (error) {
       toast.error('Erro ao atualizar tarefa');
     } else {
       toast.success('Tarefa atualizada!');
       resetForm();
       setShowEditDialog(false);
       setSelectedTask(null);
     }
   };
 
   const handleDelete = async (taskId: string) => {
     const { error } = await deleteTask(taskId);
     if (error) {
       toast.error('Erro ao excluir tarefa');
     } else {
       toast.success('Tarefa excluída');
     }
   };
 
   const openEditDialog = (task: Task) => {
     setSelectedTask(task);
     setTitle(task.title);
     setDescription(task.description || '');
     setPriority(task.priority);
     setAssignedTo(task.assigned_to || '');
     setSectorId(task.sector_id || '');
     setDueDate(task.due_date ? task.due_date.split('T')[0] : '');
     setShowEditDialog(true);
   };
 
  const openTaskDetail = (task: Task) => {
    setSelectedTask(task);
    setShowTaskDetailDialog(true);
  };

   const handleMoveTask = async (taskId: string, newStatus: string) => {
     const tasksInColumn = tasks.filter(t => t.status === newStatus);
     const newPosition = tasksInColumn.length;
     await moveTask(taskId, newStatus, newPosition);
   };
 
  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    
    if (!draggedTask) return;
    
    if (draggedTask.status !== newStatus) {
      await handleMoveTask(draggedTask.id, newStatus);
    }
    
    setDraggedTask(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverColumn(null);
  };

   const getInitials = (name: string) => {
     return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
   };
 
   const getPriorityBadge = (priority: string) => {
     const p = PRIORITIES.find(pr => pr.id === priority);
     return (
       <Badge className={cn('text-[10px]', p?.color, 'text-white')}>
         {p?.label}
       </Badge>
     );
   };
 
   if (loading) {
     return (
       <div className="flex h-full items-center justify-center">
         <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
       </div>
     );
   }
 
   return (
     <motion.div
       initial={{ opacity: 0 }}
       animate={{ opacity: 1 }}
       className="flex flex-col h-full"
     >
       {/* Header */}
       <div className="flex items-center justify-between p-4 border-b border-border">
         <div className="flex items-center gap-3">
           <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
             <ListTodo className="h-5 w-5 text-primary" />
           </div>
           <div>
             <h2 className="font-display text-xl font-bold text-foreground">
               Gestão de Tarefas
             </h2>
             <p className="text-sm text-muted-foreground">
               {tasks.length} tarefas
             </p>
           </div>
         </div>
         <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
           <Plus className="h-4 w-4" />
           <span className="hidden sm:inline">Nova Tarefa</span>
         </Button>
       </div>
 
       {/* Board */}
       <ScrollArea className="flex-1">
         <div className={cn(
           'p-4 gap-4',
           isMobile ? 'space-y-4' : 'flex min-w-max'
         )}>
           {COLUMNS.map((column) => {
             const columnTasks = tasks.filter(t => t.status === column.id);
             const Icon = column.icon;
 
             return (
               <div
                 key={column.id}
                 className={cn(
                    'bg-muted/30 rounded-xl transition-colors',
                    isMobile ? 'w-full' : 'w-72 flex-shrink-0',
                    dragOverColumn === column.id && 'bg-primary/10 ring-2 ring-primary/30'
                 )}
                  onDragOver={(e) => handleDragOver(e, column.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, column.id)}
               >
                 {/* Column Header */}
                 <div className="flex items-center gap-2 p-3 border-b border-border">
                   <Icon className={cn('h-5 w-5', column.color)} />
                   <h3 className="font-semibold text-foreground">{column.title}</h3>
                   <Badge variant="secondary" className="ml-auto">
                     {columnTasks.length}
                   </Badge>
                 </div>
 
                 {/* Tasks */}
                 <div className="p-2 space-y-2 min-h-[200px]">
                   {columnTasks.map((task) => {
                     const assignee = task.assignee;
                     const sector = sectors.find(s => s.id === task.sector_id);
 
                     return (
                       <Card
                         key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task)}
                          onDragEnd={handleDragEnd}
                          onClick={() => openTaskDetail(task)}
                          className={cn(
                            'cursor-pointer hover:shadow-md transition-all',
                            draggedTask?.id === task.id && 'opacity-50 scale-95'
                          )}
                       >
                         <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2 mb-2" onClick={(e) => e.stopPropagation()}>
                              <div className="cursor-grab active:cursor-grabbing p-1 -ml-1">
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                              </div>
                             <div className="flex-1 min-w-0">
                                <Badge variant="outline" className="text-[10px] mb-1">
                                 #{task.task_number}
                                </Badge>
                                <h4 className="font-medium text-sm text-foreground line-clamp-2" onClick={() => openTaskDetail(task)}>
                                 {task.title}
                               </h4>
                             </div>
                             <DropdownMenu>
                               <DropdownMenuTrigger asChild>
                                 <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0">
                                   <MoreVertical className="h-4 w-4" />
                                 </Button>
                               </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(task); }}>
                                   <Edit className="h-4 w-4 mr-2" />
                                   Editar
                                 </DropdownMenuItem>
                                 {COLUMNS.filter(c => c.id !== task.status).map(c => (
                                   <DropdownMenuItem 
                                     key={c.id}
                                      onClick={(e) => { e.stopPropagation(); handleMoveTask(task.id, c.id); }}
                                   >
                                     <c.icon className={cn('h-4 w-4 mr-2', c.color)} />
                                     Mover para {c.title}
                                   </DropdownMenuItem>
                                 ))}
                                 <DropdownMenuItem 
                                    onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }}
                                   className="text-destructive"
                                 >
                                   <Trash2 className="h-4 w-4 mr-2" />
                                   Excluir
                                 </DropdownMenuItem>
                               </DropdownMenuContent>
                             </DropdownMenu>
                           </div>
 
                           {task.description && (
                             <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                               {task.description}
                             </p>
                           )}
 
                           <div className="flex items-center gap-2 flex-wrap">
                             {getPriorityBadge(task.priority)}
                             {sector && (
                               <Badge 
                                 variant="outline" 
                                 className="text-[10px]"
                                 style={{ borderColor: sector.color, color: sector.color }}
                               >
                                 {sector.name}
                               </Badge>
                             )}
                           </div>
 
                           <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                             {assignee ? (
                               <div className="flex items-center gap-1.5">
                                 <Avatar className="h-5 w-5">
                                   <AvatarImage src={assignee.avatar_url || ''} />
                                   <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">
                                     {getInitials(assignee.display_name || assignee.name)}
                                   </AvatarFallback>
                                 </Avatar>
                                 <span className="text-xs text-muted-foreground truncate max-w-20">
                                   {assignee.display_name || assignee.name}
                                 </span>
                               </div>
                             ) : (
                               <span className="text-xs text-muted-foreground">Sem responsável</span>
                             )}
 
                             {task.due_date && (
                               <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                 <Calendar className="h-3 w-3" />
                                 {new Date(task.due_date).toLocaleDateString('pt-BR', { 
                                   day: '2-digit', 
                                   month: 'short' 
                                 })}
                               </div>
                             )}
                           </div>
                         </CardContent>
                       </Card>
                     );
                   })}
 
                   {columnTasks.length === 0 && (
                     <div className="text-center py-8 text-muted-foreground text-sm">
                       Nenhuma tarefa
                     </div>
                   )}
                 </div>
               </div>
             );
           })}
         </div>
       </ScrollArea>
 
       {/* Create/Edit Dialog */}
       <Dialog 
         open={showCreateDialog || showEditDialog} 
         onOpenChange={(open) => {
           if (!open) {
             setShowCreateDialog(false);
             setShowEditDialog(false);
             setSelectedTask(null);
             resetForm();
           }
         }}
       >
         <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle>
               {showEditDialog ? 'Editar Tarefa' : 'Nova Tarefa'}
             </DialogTitle>
             <DialogDescription>
               {showEditDialog 
                 ? `Editando tarefa #${selectedTask?.task_number}` 
                 : 'Crie uma nova tarefa para o quadro'
               }
             </DialogDescription>
           </DialogHeader>
 
           <div className="space-y-4 py-4">
             <div className="space-y-2">
               <Label>Título *</Label>
               <Input
                 value={title}
                 onChange={(e) => setTitle(e.target.value)}
                 placeholder="Título da tarefa"
               />
             </div>
 
             <div className="space-y-2">
               <Label>Descrição</Label>
               <Textarea
                 value={description}
                 onChange={(e) => setDescription(e.target.value)}
                 placeholder="Descreva a tarefa..."
                 rows={3}
               />
             </div>
 
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label>Prioridade</Label>
                 <Select value={priority} onValueChange={setPriority}>
                   <SelectTrigger>
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     {PRIORITIES.map(p => (
                       <SelectItem key={p.id} value={p.id}>
                         <div className="flex items-center gap-2">
                           <div className={cn('w-2 h-2 rounded-full', p.color)} />
                           {p.label}
                         </div>
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
 
               <div className="space-y-2">
                 <Label>Responsável</Label>
                 <Select value={assignedTo} onValueChange={setAssignedTo}>
                   <SelectTrigger>
                     <SelectValue placeholder="Selecionar" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="">Nenhum</SelectItem>
                     {users.map(u => (
                       <SelectItem key={u.id} value={u.id}>
                         {u.display_name || u.name}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
             </div>
 
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label>Setor</Label>
                 <Select value={sectorId} onValueChange={setSectorId}>
                   <SelectTrigger>
                     <SelectValue placeholder="Selecionar" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="">Nenhum</SelectItem>
                     {sectors.map(s => (
                       <SelectItem key={s.id} value={s.id}>
                         {s.name}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
 
               <div className="space-y-2">
                 <Label>Data de Entrega</Label>
                 <Input
                   type="date"
                   value={dueDate}
                   onChange={(e) => setDueDate(e.target.value)}
                 />
               </div>
             </div>
           </div>
 
           <DialogFooter className="flex-col sm:flex-row gap-2">
             <Button 
               variant="outline" 
               onClick={() => {
                 setShowCreateDialog(false);
                 setShowEditDialog(false);
                 resetForm();
               }}
               className="w-full sm:w-auto"
             >
               Cancelar
             </Button>
             <Button 
               onClick={showEditDialog ? handleEdit : handleCreate} 
               disabled={creating}
               className="w-full sm:w-auto"
             >
               {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
               {showEditDialog ? 'Salvar' : 'Criar Tarefa'}
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>

        {/* Task Detail Dialog */}
        <TaskDetailDialog
          task={selectedTask}
          open={showTaskDetailDialog}
          onOpenChange={(open) => {
            setShowTaskDetailDialog(open);
            if (!open) setSelectedTask(null);
          }}
          onEdit={(task) => {
            setShowTaskDetailDialog(false);
            openEditDialog(task);
          }}
          users={users}
          sectors={sectors}
        />
     </motion.div>
   );
 }

// Task Detail Dialog Component
function TaskDetailDialog({ 
  task, 
  open, 
  onOpenChange, 
  onEdit,
  users,
  sectors
}: { 
  task: Task | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onEdit: (task: Task) => void;
  users: any[];
  sectors: any[];
}) {
  const { comments, addComment, loading: commentsLoading } = useTaskComments(task?.id || null);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);

  if (!task) return null;

  const assignee = task.assignee;
  const sector = sectors.find((s: any) => s.id === task.sector_id);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setSending(true);
    await addComment(newComment.trim());
    setNewComment('');
    setSending(false);
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'low': return 'Baixa';
      case 'medium': return 'Média';
      case 'high': return 'Alta';
      case 'urgent': return 'Urgente';
      default: return priority;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'todo': return 'A Fazer';
      case 'in_progress': return 'Em Progresso';
      case 'review': return 'Em Revisão';
      case 'done': return 'Concluído';
      default: return status;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline">#{task.task_number}</Badge>
            <Badge className={cn(
              task.priority === 'urgent' && 'bg-red-500',
              task.priority === 'high' && 'bg-orange-500',
              task.priority === 'medium' && 'bg-blue-500',
              task.priority === 'low' && 'bg-gray-500',
              'text-white'
            )}>
              {getPriorityLabel(task.priority)}
            </Badge>
            <Badge variant="secondary">{getStatusLabel(task.status)}</Badge>
          </div>
          <DialogTitle className="text-xl">{task.title}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pb-4">
            {/* Description */}
            {task.description && (
              <div>
                <Label className="text-muted-foreground text-xs">Descrição</Label>
                <p className="text-foreground mt-1">{task.description}</p>
              </div>
            )}

            {/* Meta info */}
            <div className="grid grid-cols-2 gap-4">
              {assignee && (
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={assignee.avatar_url || ''} />
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {getInitials(assignee.display_name || assignee.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs text-muted-foreground">Responsável</p>
                    <p className="text-sm font-medium">{assignee.display_name || assignee.name}</p>
                  </div>
                </div>
              )}

              {sector && (
                <div>
                  <p className="text-xs text-muted-foreground">Setor</p>
                  <Badge variant="outline" style={{ borderColor: sector.color, color: sector.color }}>
                    {sector.name}
                  </Badge>
                </div>
              )}

              {task.due_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Data de Entrega</p>
                    <p className="text-sm font-medium">
                      {new Date(task.due_date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground">Criado em</p>
                <p className="text-sm">
                  {new Date(task.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>

            {/* Comments */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="h-4 w-4" />
                <h4 className="font-medium">Comentários</h4>
              </div>

              {commentsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum comentário ainda
                </p>
              ) : (
                <div className="space-y-3 mb-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={comment.author?.avatar_url || ''} />
                        <AvatarFallback className="text-xs bg-muted">
                          {getInitials(comment.author?.display_name || comment.author?.name || 'U')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 bg-muted rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">
                            {comment.author?.display_name || comment.author?.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(comment.created_at).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className="text-sm">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add comment */}
              <div className="flex gap-2">
                <Input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Adicionar comentário..."
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                />
                <Button onClick={handleAddComment} disabled={sending || !newComment.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar'}
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="border-t border-border pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={() => onEdit(task)}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}