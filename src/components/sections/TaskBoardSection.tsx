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
   ListTodo
 } from 'lucide-react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
 import { useTasks, Task } from '@/hooks/useTasks';
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
   const [selectedTask, setSelectedTask] = useState<Task | null>(null);
   const [creating, setCreating] = useState(false);
   
   // Form state
   const [title, setTitle] = useState('');
   const [description, setDescription] = useState('');
   const [priority, setPriority] = useState('medium');
   const [assignedTo, setAssignedTo] = useState('');
   const [sectorId, setSectorId] = useState('');
   const [dueDate, setDueDate] = useState('');
 
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
 
   const handleMoveTask = async (taskId: string, newStatus: string) => {
     const tasksInColumn = tasks.filter(t => t.status === newStatus);
     const newPosition = tasksInColumn.length;
     await moveTask(taskId, newStatus, newPosition);
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
                   'bg-muted/30 rounded-xl',
                   isMobile ? 'w-full' : 'w-72 flex-shrink-0'
                 )}
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
                         className="cursor-pointer hover:shadow-md transition-shadow"
                       >
                         <CardContent className="p-3">
                           <div className="flex items-start justify-between gap-2 mb-2">
                             <div className="flex-1 min-w-0">
                               <p className="text-xs text-muted-foreground mb-1">
                                 #{task.task_number}
                               </p>
                               <h4 className="font-medium text-sm text-foreground line-clamp-2">
                                 {task.title}
                               </h4>
                             </div>
                             <DropdownMenu>
                               <DropdownMenuTrigger asChild>
                                 <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0">
                                   <MoreVertical className="h-4 w-4" />
                                 </Button>
                               </DropdownMenuTrigger>
                               <DropdownMenuContent align="end">
                                 <DropdownMenuItem onClick={() => openEditDialog(task)}>
                                   <Edit className="h-4 w-4 mr-2" />
                                   Editar
                                 </DropdownMenuItem>
                                 {COLUMNS.filter(c => c.id !== task.status).map(c => (
                                   <DropdownMenuItem 
                                     key={c.id}
                                     onClick={() => handleMoveTask(task.id, c.id)}
                                   >
                                     <c.icon className={cn('h-4 w-4 mr-2', c.color)} />
                                     Mover para {c.title}
                                   </DropdownMenuItem>
                                 ))}
                                 <DropdownMenuItem 
                                   onClick={() => handleDelete(task.id)}
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
     </motion.div>
   );
 }