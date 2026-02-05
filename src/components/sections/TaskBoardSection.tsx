import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, MoreVertical, Calendar, Trash2, Edit, Loader2,
  GripVertical, ListTodo, MessageSquare, X, AlertTriangle,
  Clock4, Clock, Users, Settings, Image, FileDown, ArrowLeft,
  PlusCircle, Palette
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
import { useTaskBoards, useBoardMembers, useBoardColumns } from '@/hooks/useTaskBoards';
import { useBoardTasks, BoardTask } from '@/hooks/useBoardTasks';
import { useTaskComments } from '@/hooks/useTasks';
import { useActiveUsers } from '@/hooks/useDirectMessages';
import { useSectors } from '@/hooks/useData';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const PRIORITIES = [
  { id: 'low', label: 'Baixa', color: 'bg-gray-500' },
  { id: 'medium', label: 'Média', color: 'bg-blue-500' },
  { id: 'high', label: 'Alta', color: 'bg-orange-500' },
  { id: 'urgent', label: 'Urgente', color: 'bg-red-500' },
];

const BACKGROUND_IMAGES = [
  { id: 'default', name: 'Padrão', preview: 'bg-muted/30' },
  { id: 'gradient-blue', name: 'Azul', preview: 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20' },
  { id: 'gradient-purple', name: 'Roxo', preview: 'bg-gradient-to-br from-purple-500/20 to-pink-500/20' },
  { id: 'gradient-green', name: 'Verde', preview: 'bg-gradient-to-br from-green-500/20 to-emerald-500/20' },
  { id: 'gradient-orange', name: 'Laranja', preview: 'bg-gradient-to-br from-orange-500/20 to-yellow-500/20' },
  { id: 'gradient-dark', name: 'Escuro', preview: 'bg-gradient-to-br from-gray-800/30 to-gray-900/30' },
  { id: 'gradient-ocean', name: 'Oceano', preview: 'bg-gradient-to-br from-blue-600/20 to-teal-400/20' },
  { id: 'gradient-sunset', name: 'Pôr do Sol', preview: 'bg-gradient-to-br from-red-500/20 to-orange-400/20' },
];

const CARD_COVERS = [
  { id: 'none', name: 'Nenhuma', color: '' },
  { id: 'blue', name: 'Azul', color: 'bg-blue-500' },
  { id: 'green', name: 'Verde', color: 'bg-green-500' },
  { id: 'yellow', name: 'Amarelo', color: 'bg-yellow-500' },
  { id: 'red', name: 'Vermelho', color: 'bg-red-500' },
  { id: 'purple', name: 'Roxo', color: 'bg-purple-500' },
  { id: 'pink', name: 'Rosa', color: 'bg-pink-500' },
  { id: 'orange', name: 'Laranja', color: 'bg-orange-500' },
];

function getBoardBg(bg: string) {
  const found = BACKGROUND_IMAGES.find(b => b.id === bg);
  if (found) return found.preview;
  // Custom URL
  return '';
}

function getBoardBgStyle(bg: string): React.CSSProperties {
  if (bg && bg.startsWith('http')) {
    return { backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  return {};
}

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
    setBoardName('');
    setBoardDesc('');
    setShowCreateBoard(false);
  };

  const handleDeleteBoard = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este mural e todas as suas tarefas?')) return;
    const { error } = await deleteBoard(id);
    if (error) toast.error('Erro ao excluir');
    else {
      toast.success('Mural excluído');
      if (selectedBoardId === id) setSelectedBoardId(null);
    }
  };

  if (boardsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Board view
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

  // Board list
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

      {/* Create Board Dialog */}
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
  const { columns, addColumn, updateColumn, deleteColumn } = useBoardColumns(board.id);
  const { tasks, loading: tasksLoading, createTask, updateTask, deleteTask, moveTask, reorderInColumn } = useBoardTasks(board.id);
  const { members, addMember, removeMember } = useBoardMembers(board.id);
  const { users: allUsers } = useActiveUsers();
  const { sectors } = useSectors();
  const isMobile = useIsMobile();

  const [showSettings, setShowSettings] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [showReport, setShowReport] = useState(false);
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
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [newColumnColor, setNewColumnColor] = useState('#6366f1');
  const [customBgUrl, setCustomBgUrl] = useState('');

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
    setAssignedTo('none'); setDueDate(''); setCoverImage('none');
  };

  const openCreateTask = (columnId: string) => {
    resetForm();
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
    setCoverImage(task.cover_image || 'none');
    setTargetColumn(task.status);
    setEditingTask(task);
    setShowCreateTask(true);
  };

  const handleSaveTask = async () => {
    if (!title.trim()) { toast.error('Título é obrigatório'); return; }
    setCreating(true);

    const taskData = {
      title: title.trim(),
      description: description.trim() || undefined,
      status: targetColumn,
      priority,
      assigned_to: assignedTo !== 'none' ? assignedTo : undefined,
      due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
      cover_image: coverImage !== 'none' ? coverImage : undefined,
    };

    let result;
    if (editingTask) {
      result = await updateTask(editingTask.id, {
        ...taskData,
        assigned_to: assignedTo !== 'none' ? assignedTo : null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        cover_image: coverImage !== 'none' ? coverImage : null,
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
    const { error } = await deleteTask(taskId);
    if (error) toast.error('Erro ao excluir');
    else toast.success('Tarefa excluída');
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
    await deleteColumn(colId);
    toast.success('Coluna excluída');
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
    setDragOverColumn(null);
    setDragOverPosition(null);
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

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const getCoverClass = (cover: string | null) => CARD_COVERS.find(c => c.id === cover)?.color || '';

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
        <div className="flex items-center gap-1">
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

      {/* Board */}
      <ScrollArea className="flex-1">
        <div className={cn('p-4 gap-4', isMobile ? 'space-y-4' : 'flex min-w-max')}>
          {columns.map((column) => {
            const colTasks = tasks.filter(t => t.status === column.id).sort((a, b) => a.position - b.position);
            return (
              <div
                key={column.id}
                className={cn(
                  'rounded-xl transition-colors',
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
                      {isOwner && (
                        <DropdownMenuItem onClick={() => handleDeleteColumn(column.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir Coluna
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="p-2 space-y-2 min-h-[100px]">
                  {colTasks.map((task, index) => {
                    const cover = getCoverClass(task.cover_image);
                    const dueInfo = getDueDateInfo(task.due_date);
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
                        {cover && <div className={cn('h-2 rounded-t-lg', cover)} />}
                        <CardContent className="p-3">
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
      </ScrollArea>

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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data de Entrega</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Capa do Card</Label>
                <Select value={coverImage} onValueChange={setCoverImage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CARD_COVERS.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        <div className="flex items-center gap-2">
                          {c.color && <div className={cn('w-4 h-2 rounded', c.color)} />}
                          {c.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateTask(false); resetForm(); setEditingTask(null); }}>Cancelar</Button>
            <Button onClick={handleSaveTask} disabled={creating}>
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
        members={members}
      />

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

      {/* Report Dialog */}
      <ReportDialog open={showReport} onOpenChange={setShowReport} tasks={tasks} columns={columns} boardName={board.name} members={members} />
    </div>
  );
}

// ============ Task Detail Dialog ============
function TaskDetailDialog({ task, open, onOpenChange, onEdit, members }: {
  task: BoardTask | null; open: boolean; onOpenChange: (o: boolean) => void;
  onEdit: (t: BoardTask) => void; members: any[];
}) {
  const { comments, addComment, loading: commentsLoading } = useTaskComments(task?.id || null);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);
  if (!task) return null;

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setSending(true);
    await addComment(newComment.trim());
    setNewComment('');
    setSending(false);
  };

  const cover = CARD_COVERS.find(c => c.id === task.cover_image)?.color;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {cover && <div className={cn('h-3 -mx-6 -mt-6 mb-2 rounded-t-lg', cover)} />}
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline">#{task.task_number}</Badge>
            <Badge className={cn(
              task.priority === 'urgent' && 'bg-red-500',
              task.priority === 'high' && 'bg-orange-500',
              task.priority === 'medium' && 'bg-blue-500',
              task.priority === 'low' && 'bg-gray-500', 'text-white'
            )}>
              {PRIORITIES.find(p => p.id === task.priority)?.label}
            </Badge>
          </div>
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

// ============ Report Dialog ============
function ReportDialog({ open, onOpenChange, tasks, columns, boardName, members }: {
  open: boolean; onOpenChange: (o: boolean) => void; tasks: BoardTask[];
  columns: any[]; boardName: string; members: any[];
}) {
  const [includeTitle, setIncludeTitle] = useState(true);
  const [includeDescription, setIncludeDescription] = useState(true);
  const [includeStatus, setIncludeStatus] = useState(true);
  const [includePriority, setIncludePriority] = useState(true);
  const [includeAssignee, setIncludeAssignee] = useState(true);
  const [includeDueDate, setIncludeDueDate] = useState(true);

  const generateCSV = () => {
    const headers: string[] = ['#'];
    if (includeTitle) headers.push('Título');
    if (includeDescription) headers.push('Descrição');
    if (includeStatus) headers.push('Status');
    if (includePriority) headers.push('Prioridade');
    if (includeAssignee) headers.push('Responsável');
    if (includeDueDate) headers.push('Data de Entrega');

    const rows = tasks.map(t => {
      const row: string[] = [`#${t.task_number}`];
      if (includeTitle) row.push(t.title);
      if (includeDescription) row.push(t.description || '');
      if (includeStatus) {
        const col = columns.find(c => c.id === t.status);
        row.push(col?.title || t.status);
      }
      if (includePriority) row.push(PRIORITIES.find(p => p.id === t.priority)?.label || t.priority);
      if (includeAssignee) row.push(t.assignee?.display_name || t.assignee?.name || 'Sem responsável');
      if (includeDueDate) row.push(t.due_date ? new Date(t.due_date).toLocaleDateString('pt-BR') : '');
      return row;
    });

    const csvContent = [headers, ...rows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${boardName}_relatorio.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório CSV gerado!');
  };

  const generatePDF = () => {
    const colMap = new Map(columns.map(c => [c.id, c.title]));
    let html = `<html><head><meta charset="utf-8"><title>Relatório - ${boardName}</title>
    <style>body{font-family:Arial,sans-serif;margin:40px}h1{color:#1a1a1a;border-bottom:2px solid #3b82f6;padding-bottom:10px}
    table{width:100%;border-collapse:collapse;margin-top:20px}th{background:#3b82f6;color:white;padding:10px;text-align:left;font-size:12px}
    td{padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:11px}tr:nth-child(even){background:#f9fafb}
    .footer{margin-top:30px;color:#6b7280;font-size:10px;text-align:center}</style></head><body>`;
    html += `<h1>📋 ${boardName}</h1><p style="color:#6b7280">${tasks.length} tarefas | Gerado em ${new Date().toLocaleString('pt-BR')}</p>`;
    html += '<table><thead><tr><th>#</th>';
    if (includeTitle) html += '<th>Título</th>';
    if (includeDescription) html += '<th>Descrição</th>';
    if (includeStatus) html += '<th>Status</th>';
    if (includePriority) html += '<th>Prioridade</th>';
    if (includeAssignee) html += '<th>Responsável</th>';
    if (includeDueDate) html += '<th>Entrega</th>';
    html += '</tr></thead><tbody>';
    tasks.forEach(t => {
      html += `<tr><td>#${t.task_number}</td>`;
      if (includeTitle) html += `<td>${t.title}</td>`;
      if (includeDescription) html += `<td>${t.description || '-'}</td>`;
      if (includeStatus) html += `<td>${colMap.get(t.status) || t.status}</td>`;
      if (includePriority) html += `<td>${PRIORITIES.find(p => p.id === t.priority)?.label || t.priority}</td>`;
      if (includeAssignee) html += `<td>${t.assignee?.display_name || t.assignee?.name || '-'}</td>`;
      if (includeDueDate) html += `<td>${t.due_date ? new Date(t.due_date).toLocaleDateString('pt-BR') : '-'}</td>`;
      html += '</tr>';
    });
    html += '</tbody></table>';
    html += `<div class="footer">Relatório gerado automaticamente pelo ServChat</div></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
    toast.success('Relatório PDF gerado!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerar Relatório</DialogTitle>
          <DialogDescription>Selecione os campos que deseja incluir</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {[
            { label: 'Título', checked: includeTitle, set: setIncludeTitle },
            { label: 'Descrição', checked: includeDescription, set: setIncludeDescription },
            { label: 'Status', checked: includeStatus, set: setIncludeStatus },
            { label: 'Prioridade', checked: includePriority, set: setIncludePriority },
            { label: 'Responsável', checked: includeAssignee, set: setIncludeAssignee },
            { label: 'Data de Entrega', checked: includeDueDate, set: setIncludeDueDate },
          ].map(f => (
            <label key={f.label} className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={f.checked} onChange={(e) => f.set(e.target.checked)} className="rounded border-border" />
              <span className="text-sm">{f.label}</span>
            </label>
          ))}
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={generateCSV} className="gap-2 w-full sm:w-auto">
            <FileDown className="h-4 w-4" /> Excel (CSV)
          </Button>
          <Button onClick={generatePDF} className="gap-2 w-full sm:w-auto">
            <FileDown className="h-4 w-4" /> PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
