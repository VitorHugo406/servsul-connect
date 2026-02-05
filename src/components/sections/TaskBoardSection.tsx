import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, MoreVertical, Calendar, Trash2, Edit, Loader2,
  GripVertical, ListTodo, X, AlertTriangle,
  Clock4, Clock, Users, Settings, ArrowLeft,
  PlusCircle, FileDown, Zap, Upload, Tag
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTaskBoards, useBoardMembers, useBoardColumns, TaskBoardColumn } from '@/hooks/useTaskBoards';
import { useBoardTasks, BoardTask } from '@/hooks/useBoardTasks';
import { useTaskLabels } from '@/hooks/useTaskLabels';
import { useActiveUsers } from '@/hooks/useDirectMessages';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFileUpload } from '@/hooks/useFileUpload';
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog';
import { ReportDialog } from '@/components/tasks/ReportDialog';
import { useSubtaskCounts } from '@/hooks/useSubtasks';
import {
  PRIORITIES, BACKGROUND_IMAGES, CARD_COVERS,
  getBoardBg, getBoardBgStyle, getInitials, getCoverDisplay,
} from '@/components/tasks/taskConstants';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CheckSquare } from 'lucide-react';

export function TaskBoardSection() {
  const { user } = useAuth();
  const { boards, loading: boardsLoading, createBoard, updateBoard, deleteBoard } = useTaskBoards();
  const isMobile = useIsMobile();
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [boardName, setBoardName] = useState('');
  const [boardDesc, setBoardDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateBoard = async () => {
    if (!boardName.trim()) { toast.error('Nome é obrigatório'); return; }
    setCreating(true);
    const { error } = await createBoard(boardName.trim(), boardDesc.trim());
    setCreating(false);
    if (error) { toast.error('Erro ao criar mural'); return; }
    toast.success('Mural criado!');
    setBoardName(''); setBoardDesc(''); setShowCreateBoard(false);
  };

  const handleDeleteBoard = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este mural e todas as suas tarefas?')) return;
    const { error } = await deleteBoard(id);
    if (error) { toast.error('Erro ao excluir mural'); return; }
    toast.success('Mural excluído com sucesso!');
    if (selectedBoardId === id) setSelectedBoardId(null);
  };

  if (boardsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (selectedBoardId) {
    const board = boards.find(b => b.id === selectedBoardId);
    if (!board) { setSelectedBoardId(null); return null; }
    return (
      <BoardView
        board={board}
        onBack={() => setSelectedBoardId(null)}
        onUpdateBoard={updateBoard}
        isOwner={board.owner_id === user?.id}
      />
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <ListTodo className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">Gestão de Tarefas</h2>
            <p className="text-sm text-muted-foreground">{boards.length} murais</p>
          </div>
        </div>
        <Button onClick={() => setShowCreateBoard(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo Mural</span>
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {boards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <ListTodo className="h-8 w-8 text-muted-foreground" />
            </div>
            <h4 className="font-display text-lg font-semibold text-foreground">Nenhum mural ainda</h4>
            <p className="text-sm text-muted-foreground mb-4">Crie seu primeiro mural de tarefas</p>
            <Button onClick={() => setShowCreateBoard(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Criar Mural
            </Button>
          </div>
        ) : (
          <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3')}>
            {boards.map((board) => (
              <Card
                key={board.id}
                className={cn('cursor-pointer hover:shadow-lg transition-all overflow-hidden', getBoardBg(board.background_image))}
                style={getBoardBgStyle(board.background_image)}
                onClick={() => setSelectedBoardId(board.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{board.name}</h3>
                      {board.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{board.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(board.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        {board.owner_id === user?.id && (
                          <DropdownMenuItem onClick={() => handleDeleteBoard(board.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir Mural
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      <Dialog open={showCreateBoard} onOpenChange={setShowCreateBoard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Mural</DialogTitle>
            <DialogDescription>Crie um mural individual de tarefas</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={boardName} onChange={(e) => setBoardName(e.target.value)} placeholder="Nome do mural" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={boardDesc} onChange={(e) => setBoardDesc(e.target.value)} placeholder="Descrição opcional" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateBoard(false)}>Cancelar</Button>
            <Button onClick={handleCreateBoard} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar Mural
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ============ Board View ============
function BoardView({ board, onBack, onUpdateBoard, isOwner }: {
  board: any;
  onBack: () => void;
  onUpdateBoard: (id: string, updates: any) => Promise<any>;
  isOwner: boolean;
}) {
  const { profile } = useAuth();
  const { columns, addColumn, updateColumn, deleteColumn, refetch: refetchColumns } = useBoardColumns(board.id);
  const { tasks, loading: tasksLoading, createTask, updateTask, deleteTask, moveTask, reorderInColumn, refetch: refetchTasks } = useBoardTasks(board.id);
  const { members, addMember, removeMember } = useBoardMembers(board.id);
  const { labels, getTaskLabels, createLabel, deleteLabel, assignLabel, removeLabel } = useTaskLabels(board.id);
  const { counts: subtaskCounts } = useSubtaskCounts(tasks.map(t => t.id));
  const { users: allUsers } = useActiveUsers();
  const { uploadFile, uploading: fileUploading } = useFileUpload();
  const isMobile = useIsMobile();
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showAutomation, setShowAutomation] = useState<TaskBoardColumn | null>(null);
  const [showLabelsManager, setShowLabelsManager] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState<string | null>(null); // task id
  const [selectedTask, setSelectedTask] = useState<BoardTask | null>(null);
  const [targetColumn, setTargetColumn] = useState<string>('');
  const [draggedTask, setDraggedTask] = useState<BoardTask | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<number | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assignedTo, setAssignedTo] = useState('none');
  const [dueDate, setDueDate] = useState('');
  const [coverImage, setCoverImage] = useState('none');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [newColumnColor, setNewColumnColor] = useState('#6366f1');
  const [customBgUrl, setCustomBgUrl] = useState('');
  const [autoAssign, setAutoAssign] = useState('none');
  const [autoCover, setAutoCover] = useState('none');
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#6366f1');

  const [creating, setCreating] = useState(false);
  const [editingTask, setEditingTask] = useState<BoardTask | null>(null);

  const memberUserIds = new Set(members.map(m => m.user_id));
  const nonMembers = allUsers.filter(u => !memberUserIds.has(u.user_id));

  const getDueDateInfo = (dueDateStr: string | null) => {
    if (!dueDateStr) return null;
    const due = new Date(dueDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: 'Atrasado', color: 'text-red-500 bg-red-500/10', icon: AlertTriangle };
    if (diffDays === 0) return { label: 'Hoje', color: 'text-orange-500 bg-orange-500/10', icon: Clock4 };
    if (diffDays <= 2) return { label: `${diffDays}d`, color: 'text-yellow-500 bg-yellow-500/10', icon: Clock };
    return { label: `${diffDays}d`, color: 'text-muted-foreground bg-muted', icon: Calendar };
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setPriority('medium');
    setAssignedTo('none'); setDueDate(''); setCoverImage('none'); setCoverImageUrl('');
  };

  const openCreateTask = (columnId: string) => {
    resetForm();
    // Apply column automations
    const col = columns.find(c => c.id === columnId);
    if (col) {
      if (col.auto_assign_to) setAssignedTo(col.auto_assign_to);
      if (col.auto_cover) setCoverImage(col.auto_cover);
    }
    setTargetColumn(columnId);
    setEditingTask(null);
    setShowCreateTask(true);
  };

  const openEditTask = (task: BoardTask) => {
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority);
    setAssignedTo(task.assigned_to || 'none');
    setDueDate(task.due_date ? task.due_date.split('T')[0] : '');
    const cover = getCoverDisplay(task.cover_image);
    if (cover.type === 'image') {
      setCoverImage('custom');
      setCoverImageUrl(task.cover_image || '');
    } else {
      setCoverImage(task.cover_image || 'none');
      setCoverImageUrl('');
    }
    setTargetColumn(task.status);
    setEditingTask(task);
    setShowCreateTask(true);
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadFile(file);
    if (result) {
      setCoverImage('custom');
      setCoverImageUrl(result.url);
    }
  };

  const handleSaveTask = async () => {
    if (!title.trim()) { toast.error('Título é obrigatório'); return; }
    setCreating(true);

    const finalCover = coverImage === 'custom' ? coverImageUrl : (coverImage !== 'none' ? coverImage : undefined);

    const taskData = {
      title: title.trim(),
      description: description.trim() || undefined,
      status: targetColumn,
      priority,
      assigned_to: assignedTo !== 'none' ? assignedTo : undefined,
      due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
      cover_image: finalCover,
    };

    let result;
    if (editingTask) {
      result = await updateTask(editingTask.id, {
        ...taskData,
        assigned_to: assignedTo !== 'none' ? assignedTo : null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        cover_image: finalCover || null,
        description: description.trim() || null,
      } as any);
    } else {
      result = await createTask(taskData);
    }

    setCreating(false);
    if (result.error) { toast.error('Erro ao salvar tarefa'); return; }
    toast.success(editingTask ? 'Tarefa atualizada!' : 'Tarefa criada!');
    resetForm();
    setShowCreateTask(false);
    setEditingTask(null);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Excluir esta tarefa?')) return;
    const { error } = await deleteTask(taskId);
    if (error) { toast.error('Erro ao excluir tarefa'); return; }
    toast.success('Tarefa excluída');
    await refetchTasks();
  };

  const handleAddColumn = async () => {
    if (!newColumnTitle.trim()) return;
    const { error } = await addColumn(newColumnTitle.trim(), newColumnColor);
    if (error) toast.error('Erro ao criar coluna');
    else { toast.success('Coluna criada!'); setNewColumnTitle(''); setShowAddColumn(false); }
  };

  const handleDeleteColumn = async (colId: string) => {
    const colTasks = tasks.filter(t => t.status === colId);
    if (colTasks.length > 0) { toast.error('Remova as tarefas antes de excluir a coluna'); return; }
    if (!confirm('Excluir esta coluna?')) return;
    const { error } = await deleteColumn(colId);
    if (error) { toast.error('Erro ao excluir coluna'); return; }
    toast.success('Coluna excluída');
    await refetchColumns();
  };

  const handleAddMember = async (user: any) => {
    const { error } = await addMember(user.user_id, user.id);
    if (error) toast.error('Erro ao adicionar');
    else toast.success('Membro adicionado!');
  };

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await removeMember(memberId);
    if (error) toast.error('Erro ao remover');
    else toast.success('Membro removido');
  };

  const handleChangeBg = async (bgId: string) => {
    await onUpdateBoard(board.id, { background_image: bgId });
    toast.success('Fundo atualizado!');
  };

  const handleCustomBg = async () => {
    if (!customBgUrl.trim()) return;
    await onUpdateBoard(board.id, { background_image: customBgUrl.trim() });
    toast.success('Fundo personalizado aplicado!');
    setCustomBgUrl('');
  };

  const handleSaveAutomation = async () => {
    if (!showAutomation) return;
    const updates: Record<string, string | null> = {
      auto_assign_to: autoAssign !== 'none' ? autoAssign : null,
      auto_cover: autoCover !== 'none' ? autoCover : null,
    };
    const { error } = await updateColumn(showAutomation.id, updates as any);
    if (error) { toast.error('Erro ao salvar automação'); return; }
    toast.success('Automação salva!');
    setShowAutomation(null);
    refetchColumns();
  };

  const openAutomation = (col: TaskBoardColumn) => {
    setAutoAssign(col.auto_assign_to || 'none');
    setAutoCover(col.auto_cover || 'none');
    setShowAutomation(col);
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    const { error } = await createLabel(newLabelName.trim(), newLabelColor);
    if (error) toast.error('Erro ao criar etiqueta');
    else { toast.success('Etiqueta criada!'); setNewLabelName(''); }
  };

  const handleToggleLabel = async (taskId: string, labelId: string) => {
    const taskLabels = getTaskLabels(taskId);
    const hasLabel = taskLabels.some(l => l.id === labelId);
    if (hasLabel) {
      await removeLabel(taskId, labelId);
    } else {
      await assignLabel(taskId, labelId);
    }
  };

  // Drag and drop
  const handleDragStart = (e: React.DragEvent, task: BoardTask) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  };
  const handleDragOver = (e: React.DragEvent, colId: string, position?: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(colId);
    if (position !== undefined) setDragOverPosition(position);
  };
  const handleDragLeave = () => { setDragOverColumn(null); setDragOverPosition(null); };
  const handleDrop = async (e: React.DragEvent, colId: string, position?: number) => {
    e.preventDefault();
    setDragOverColumn(null); setDragOverPosition(null);
    if (!draggedTask) return;
    if (draggedTask.status === colId && position !== undefined) {
      await reorderInColumn(draggedTask.id, position);
    } else if (draggedTask.status !== colId) {
      const colTasks = tasks.filter(t => t.status === colId);
      await moveTask(draggedTask.id, colId, position ?? colTasks.length);
    }
    setDraggedTask(null);
  };
  const handleDragEnd = () => { setDraggedTask(null); setDragOverColumn(null); setDragOverPosition(null); };

  const boardBg = getBoardBg(board.background_image);
  const boardBgStyle = getBoardBgStyle(board.background_image);

  return (
    <div className={cn('flex flex-col h-full', boardBg)} style={boardBgStyle}>
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-border bg-background/80 backdrop-blur-sm">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-foreground truncate">{board.name}</h2>
          <p className="text-xs text-muted-foreground">{tasks.length} tarefas</p>
        </div>

        {/* Member avatars */}
        <TooltipProvider>
          <div className="flex items-center -space-x-2 mr-1">
            {members.slice(0, 5).map(m => (
              <Tooltip key={m.id}>
                <TooltipTrigger asChild>
                  <Avatar className="h-7 w-7 border-2 border-background">
                    <AvatarImage src={m.profile?.avatar_url || ''} />
                    <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                      {getInitials(m.profile?.display_name || m.profile?.name || 'U')}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>{m.profile?.display_name || m.profile?.name}</TooltipContent>
              </Tooltip>
            ))}
            {members.length > 5 && (
              <Avatar className="h-7 w-7 border-2 border-background">
                <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">
                  +{members.length - 5}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </TooltipProvider>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setShowLabelsManager(true)} title="Etiquetas">
            <Tag className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowReport(true)} title="Relatório">
            <FileDown className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowMembers(true)} title="Membros">
            <Users className="h-4 w-4" />
          </Button>
          {isOwner && (
            <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)} title="Configurações">
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Board columns with horizontal scroll */}
      <div className="flex-1 overflow-hidden">
        <div className={cn(
          'h-full p-4 task-board-scroll',
          isMobile ? 'overflow-y-auto space-y-4' : 'overflow-x-auto overflow-y-hidden'
        )}>
          <div className={cn(isMobile ? '' : 'flex gap-4 h-full pb-2')}>
            {columns.map((column) => {
              const colTasks = tasks.filter(t => t.status === column.id).sort((a, b) => a.position - b.position);
              return (
                <div
                  key={column.id}
                  className={cn(
                    'rounded-xl transition-colors flex flex-col',
                    isMobile ? 'w-full' : 'w-72 flex-shrink-0',
                    dragOverColumn === column.id ? 'bg-primary/10 ring-2 ring-primary/30' : 'bg-background/60 backdrop-blur-sm'
                  )}
                  onDragOver={(e) => handleDragOver(e, column.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, column.id)}
                >
                  <div className="flex items-center gap-2 p-3 border-b border-border">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: column.color }} />
                    <h3 className="font-semibold text-foreground text-sm flex-1 truncate">{column.title}</h3>
                    <Badge variant="secondary" className="text-xs">{colTasks.length}</Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6"><MoreVertical className="h-3 w-3" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openCreateTask(column.id)}>
                          <Plus className="h-4 w-4 mr-2" /> Adicionar Tarefa
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openAutomation(column)}>
                          <Zap className="h-4 w-4 mr-2" /> Automações
                        </DropdownMenuItem>
                        {isOwner && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDeleteColumn(column.id)} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir Coluna
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="p-2 space-y-2 min-h-[60px] flex-1 overflow-y-auto max-h-[calc(100vh-220px)] task-col-scroll">
                    {colTasks.map((task, index) => {
                      const cover = getCoverDisplay(task.cover_image);
                      const dueInfo = getDueDateInfo(task.due_date);
                      const taskLabelsForCard = getTaskLabels(task.id);
                      return (
                        <Card
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); handleDragOver(e, column.id, index); }}
                          onDrop={(e) => { e.stopPropagation(); handleDrop(e, column.id, index); }}
                          onClick={() => { setSelectedTask(task); setShowTaskDetail(true); }}
                          className={cn(
                            'cursor-pointer hover:shadow-md transition-all',
                            draggedTask?.id === task.id && 'opacity-50 scale-95',
                            dragOverColumn === column.id && dragOverPosition === index && 'ring-2 ring-primary'
                          )}
                        >
                          {cover.type === 'color' && <div className={cn('h-2 rounded-t-lg', cover.value)} />}
                          {cover.type === 'image' && (
                            <div className="h-24 rounded-t-lg overflow-hidden">
                              <img src={cover.value} alt="Capa" className="w-full h-full object-cover" />
                            </div>
                          )}
                          <CardContent className="p-3">
                            {/* Labels */}
                            {taskLabelsForCard.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-1.5">
                                {taskLabelsForCard.map(l => (
                                  <span
                                    key={l.id}
                                    className="inline-block h-2 w-10 rounded-full"
                                    style={{ backgroundColor: l.color }}
                                    title={l.name}
                                  />
                                ))}
                              </div>
                            )}
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <div className="cursor-grab active:cursor-grabbing p-0.5 -ml-0.5">
                                <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <Badge variant="outline" className="text-[9px] mb-0.5">#{task.task_number}</Badge>
                                <h4 className="font-medium text-sm text-foreground line-clamp-2">{task.title}</h4>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0">
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditTask(task); }}>
                                    <Edit className="h-4 w-4 mr-2" /> Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setShowLabelPicker(task.id); }}>
                                    <Tag className="h-4 w-4 mr-2" /> Etiquetas
                                  </DropdownMenuItem>
                                  {columns.filter(c => c.id !== column.id).map(c => (
                                    <DropdownMenuItem key={c.id} onClick={(e) => { e.stopPropagation(); moveTask(task.id, c.id, 0); }}>
                                      <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: c.color }} />
                                      Mover para {c.title}
                                    </DropdownMenuItem>
                                  ))}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }} className="text-destructive">
                                    <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            {task.description && <p className="text-xs text-muted-foreground mb-1.5 line-clamp-2">{task.description}</p>}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge className={cn('text-[9px]', PRIORITIES.find(p => p.id === task.priority)?.color, 'text-white')}>
                                {PRIORITIES.find(p => p.id === task.priority)?.label}
                              </Badge>
                              {subtaskCounts[task.id] && subtaskCounts[task.id].total > 0 && (
                                <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                  <CheckSquare className="h-3 w-3" />
                                  <span>{subtaskCounts[task.id].completed}/{subtaskCounts[task.id].total}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border">
                              {task.assignee ? (
                                <div className="flex items-center gap-1">
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={task.assignee.avatar_url || ''} />
                                    <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">
                                      {getInitials(task.assignee.display_name || task.assignee.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-[10px] text-muted-foreground truncate max-w-16">{task.assignee.display_name || task.assignee.name}</span>
                                </div>
                              ) : <span className="text-[10px] text-muted-foreground">Sem responsável</span>}
                              {dueInfo && (() => {
                                const DI = dueInfo.icon;
                                return (
                                  <div className={cn('flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded font-medium', dueInfo.color)}>
                                    <DI className="h-2.5 w-2.5" />
                                    {dueInfo.label}
                                  </div>
                                );
                              })()}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                    {colTasks.length === 0 && (
                      <div className="text-center py-6 text-muted-foreground text-xs">Nenhuma tarefa</div>
                    )}
                    <Button variant="ghost" size="sm" className="w-full text-xs gap-1 mt-1" onClick={() => openCreateTask(column.id)}>
                      <Plus className="h-3 w-3" /> Adicionar
                    </Button>
                  </div>
                </div>
              );
            })}
            {/* Add column button */}
            <div className={cn('flex-shrink-0', isMobile ? 'w-full' : 'w-72')}>
              {showAddColumn ? (
                <div className="bg-background/60 backdrop-blur-sm rounded-xl p-3 space-y-2">
                  <Input value={newColumnTitle} onChange={(e) => setNewColumnTitle(e.target.value)} placeholder="Nome da coluna" autoFocus />
                  <div className="flex items-center gap-2">
                    <input type="color" value={newColumnColor} onChange={(e) => setNewColumnColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                    <Button size="sm" onClick={handleAddColumn} className="flex-1">Criar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowAddColumn(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" className="w-full gap-2 bg-background/40" onClick={() => setShowAddColumn(true)}>
                  <PlusCircle className="h-4 w-4" /> Nova Coluna
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Task Dialog */}
      <Dialog open={showCreateTask} onOpenChange={(o) => { if (!o) { setShowCreateTask(false); setEditingTask(null); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTask ? `Editar Tarefa #${editingTask.task_number}` : 'Nova Tarefa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título da tarefa" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva a tarefa..." rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {members.map(m => (
                      <SelectItem key={m.profile_id} value={m.profile_id}>
                        {m.profile?.display_name || m.profile?.name || 'Membro'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Data de Entrega</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Capa do Card</Label>
              <div className="flex flex-wrap gap-2">
                {CARD_COVERS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setCoverImage(c.id); setCoverImageUrl(''); }}
                    className={cn(
                      'w-10 h-6 rounded border-2 transition-all',
                      c.id === 'none' ? 'bg-muted border-dashed' : c.color,
                      coverImage === c.id ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'
                    )}
                    title={c.name}
                  />
                ))}
                <button
                  onClick={() => coverInputRef.current?.click()}
                  className={cn(
                    'w-10 h-6 rounded border-2 border-dashed flex items-center justify-center transition-all',
                    coverImage === 'custom' ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'
                  )}
                  title="Enviar imagem"
                >
                  <Upload className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverUpload}
              />
              {coverImage === 'custom' && coverImageUrl && (
                <div className="mt-2 rounded-lg overflow-hidden h-20">
                  <img src={coverImageUrl} alt="Capa preview" className="w-full h-full object-cover" />
                </div>
              )}
              {fileUploading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Enviando imagem...
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateTask(false); resetForm(); setEditingTask(null); }}>Cancelar</Button>
            <Button onClick={handleSaveTask} disabled={creating || fileUploading}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingTask ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        task={selectedTask}
        open={showTaskDetail}
        onOpenChange={(o) => { setShowTaskDetail(o); if (!o) setSelectedTask(null); }}
        onEdit={(t) => { setShowTaskDetail(false); openEditTask(t); }}
        taskLabels={selectedTask ? getTaskLabels(selectedTask.id) : []}
        allLabels={labels}
        onToggleLabel={handleToggleLabel}
      />

      {/* Label Picker Dialog */}
      <Dialog open={!!showLabelPicker} onOpenChange={(o) => { if (!o) setShowLabelPicker(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" /> Etiquetas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {labels.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">Nenhuma etiqueta criada. Use o botão de etiquetas no cabeçalho para criar.</p>
            ) : (
              labels.map(l => {
                const isAssigned = showLabelPicker ? getTaskLabels(showLabelPicker).some(tl => tl.id === l.id) : false;
                return (
                  <button
                    key={l.id}
                    onClick={() => showLabelPicker && handleToggleLabel(showLabelPicker, l.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-2 rounded-lg border-2 transition-all text-left',
                      isAssigned ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted'
                    )}
                  >
                    <div className="w-8 h-5 rounded" style={{ backgroundColor: l.color }} />
                    <span className="text-sm font-medium flex-1">{l.name}</span>
                    {isAssigned && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Labels Manager Dialog */}
      <Dialog open={showLabelsManager} onOpenChange={setShowLabelsManager}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" /> Gerenciar Etiquetas
            </DialogTitle>
            <DialogDescription>Crie e gerencie etiquetas para organizar suas tarefas</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2">
              <input type="color" value={newLabelColor} onChange={(e) => setNewLabelColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer flex-shrink-0" />
              <Input
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder="Nome da etiqueta"
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateLabel()}
              />
              <Button size="sm" onClick={handleCreateLabel} disabled={!newLabelName.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto task-col-scroll">
              {labels.map(l => (
                <div key={l.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted group">
                  <div className="w-6 h-4 rounded" style={{ backgroundColor: l.color }} />
                  <span className="text-sm flex-1">{l.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deleteLabel(l.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
              {labels.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma etiqueta ainda</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      <Dialog open={showMembers} onOpenChange={setShowMembers}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>Membros do Mural</DialogTitle></DialogHeader>
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-2 pb-4">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={m.profile?.avatar_url || ''} />
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {getInitials(m.profile?.display_name || m.profile?.name || 'U')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.profile?.display_name || m.profile?.name}</p>
                    <p className="text-xs text-muted-foreground">{m.role === 'owner' ? 'Dono' : 'Membro'}</p>
                  </div>
                  {isOwner && m.role !== 'owner' && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveMember(m.id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {isOwner && nonMembers.length > 0 && (
              <div className="border-t border-border pt-3">
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Adicionar Colaboradores</h4>
                <div className="space-y-1">
                  {nonMembers.map(u => (
                    <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={u.avatar_url || ''} />
                        <AvatarFallback className="text-xs bg-muted">{getInitials(u.display_name || u.name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm flex-1 truncate">{u.display_name || u.name}</span>
                      <Button size="sm" variant="outline" onClick={() => handleAddMember(u)}>
                        <Plus className="h-3 w-3 mr-1" /> Adicionar
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog (Background) */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Configurações do Mural</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-2 block">Imagem de Fundo</Label>
              <div className="grid grid-cols-4 gap-2">
                {BACKGROUND_IMAGES.map(bg => (
                  <button
                    key={bg.id}
                    onClick={() => handleChangeBg(bg.id)}
                    className={cn(
                      'h-16 rounded-lg border-2 transition-all', bg.preview,
                      board.background_image === bg.id ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'
                    )}
                  >
                    <span className="text-[9px] text-foreground/70">{bg.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Imagem personalizada (URL)</Label>
              <div className="flex gap-2">
                <Input value={customBgUrl} onChange={(e) => setCustomBgUrl(e.target.value)} placeholder="https://..." className="flex-1" />
                <Button size="sm" onClick={handleCustomBg} disabled={!customBgUrl.trim()}>Aplicar</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Automation Dialog */}
      <Dialog open={!!showAutomation} onOpenChange={(o) => { if (!o) setShowAutomation(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Automações: {showAutomation?.title}
            </DialogTitle>
            <DialogDescription>
              Configure ações automáticas para novos cards nesta coluna
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Auto-atribuir responsável</Label>
              <Select value={autoAssign} onValueChange={setAutoAssign}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {members.map(m => (
                    <SelectItem key={m.profile_id} value={m.profile_id}>
                      {m.profile?.display_name || m.profile?.name || 'Membro'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Novos cards nesta coluna terão este responsável automaticamente</p>
            </div>
            <div className="space-y-2">
              <Label>Auto-capa padrão</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setAutoCover('none')}
                  className={cn('w-10 h-6 rounded border-2 bg-muted border-dashed', autoCover === 'none' && 'border-primary ring-2 ring-primary/30')}
                  title="Nenhuma"
                />
                {CARD_COVERS.filter(c => c.id !== 'none').map(c => (
                  <button
                    key={c.id}
                    onClick={() => setAutoCover(c.id)}
                    className={cn('w-10 h-6 rounded border-2 transition-all', c.color, autoCover === c.id ? 'border-primary ring-2 ring-primary/30' : 'border-transparent')}
                    title={c.name}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Novos cards nesta coluna terão esta capa automaticamente</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutomation(null)}>Cancelar</Button>
            <Button onClick={handleSaveAutomation}>Salvar Automação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <ReportDialog open={showReport} onOpenChange={setShowReport} tasks={tasks} columns={columns} boardName={board.name} />
    </div>
  );
}
