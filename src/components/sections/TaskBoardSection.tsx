import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import {
  Plus, MoreVertical, Calendar, Trash2, Edit, Loader2,
  GripVertical, ListTodo, X, AlertTriangle, Search,
  Clock4, Clock, Users, Settings, ArrowLeft, MoveRight,
  PlusCircle, FileDown, Zap, Upload, Tag, Copy, Repeat,
  Archive, ArchiveRestore, Pencil, Activity, Menu, Shield,
  Filter, Share2, UserPlus, Link2, Shuffle, Bell
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
import { AutomationRulesPanel } from '@/components/tasks/AutomationRulesPanel';
import { OperationModePanel } from '@/components/tasks/OperationModePanel';
import { TaskFilterPanel, TaskFilter, emptyFilter, isFilterActive, applyFilter } from '@/components/tasks/TaskFilterPanel';
import { AutoSubtasksConfig } from '@/components/tasks/AutoSubtasksConfig';
import { useSubtaskCounts } from '@/hooks/useSubtasks';
import { useTaskAssignees } from '@/hooks/useTaskAssignees';
import { useCardDuplications } from '@/hooks/useCardDuplications';
import { useWorkflowRules } from '@/hooks/useWorkflowRules';
import { useColumnAutoSubtasks } from '@/hooks/useColumnAutoSubtasks';
import {
  PRIORITIES, BACKGROUND_IMAGES, BACKGROUND_GROUPS, CARD_COVERS,
  getBoardBg, getBoardBgStyle, getInitials, getCoverDisplay, isBoardBgDark,
} from '@/components/tasks/taskConstants';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CheckSquare, CheckCircle2 } from 'lucide-react';

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
        boards={boards}
        onBack={() => setSelectedBoardId(null)}
        onSelectBoard={(id: string) => setSelectedBoardId(id)}
        onUpdateBoard={updateBoard}
        isOwner={board.owner_id === user?.id}
        currentUserId={user?.id || ''}
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
            {boards.map((board) => {
              const isDark = isBoardBgDark(board.background_image);
              return (
              <Card
                key={board.id}
                className={cn('cursor-pointer hover:shadow-lg transition-all overflow-hidden', getBoardBg(board.background_image))}
                style={getBoardBgStyle(board.background_image)}
                onClick={() => setSelectedBoardId(board.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className={cn("font-semibold truncate", isDark ? "text-white" : "text-foreground")}>{board.name}</h3>
                      {board.description && (
                        <p className={cn("text-sm line-clamp-2 mt-1", isDark ? "text-white/70" : "text-muted-foreground")}>{board.description}</p>
                      )}
                      <p className={cn("text-xs mt-2", isDark ? "text-white/60" : "text-muted-foreground")}>
                        {new Date(board.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className={cn("h-8 w-8 flex-shrink-0", isDark && "text-white hover:bg-white/20")}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        {board.owner_id === user?.id && (
                          <DropdownMenuItem onClick={() => {
                            const newName = prompt('Novo nome do mural:', board.name);
                            if (newName && newName.trim()) {
                              updateBoard(board.id, { name: newName.trim() });
                              toast.success('Nome atualizado!');
                            }
                          }}>
                            <Edit className="h-4 w-4 mr-2" /> Renomear
                          </DropdownMenuItem>
                        )}
                        {board.owner_id === user?.id && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDeleteBoard(board.id)} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir Mural
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
              );
            })}
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
function BoardView({ board, boards, onBack, onSelectBoard, onUpdateBoard, isOwner, currentUserId }: {
  board: any;
  boards: any[];
  onBack: () => void;
  onSelectBoard: (id: string) => void;
  onUpdateBoard: (id: string, updates: any) => Promise<any>;
  isOwner: boolean;
  currentUserId: string;
}) {
  const { profile } = useAuth();
  const { columns, addColumn, updateColumn, deleteColumn, refetch: refetchColumns } = useBoardColumns(board.id);
  const { tasks, archivedTasks, loading: tasksLoading, createTask, updateTask, deleteTask, moveTask, reorderInColumn, archiveTask, unarchiveTask, archiveColumnTasks, refetch: refetchTasks } = useBoardTasks(board.id);
  const { members, addMember, removeMember, updateMemberRole } = useBoardMembers(board.id);
  const { labels, getTaskLabels, createLabel, deleteLabel, assignLabel, removeLabel } = useTaskLabels(board.id);
  const { counts: subtaskCounts } = useSubtaskCounts(tasks.map(t => t.id));
  const { getTaskAssignees, setTaskAssignees: setTaskAssigneesDb } = useTaskAssignees(board.id);
  const { createDuplication, deleteDuplication, getTaskDuplication } = useCardDuplications(board.id);
  const { rules: workflowRules, canMoveToColumn } = useWorkflowRules(board.id);
  const { users: allUsers } = useActiveUsers();
  const { uploadFile, uploading: fileUploading } = useFileUpload();
  const isMobile = useIsMobile();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const autoCoverInputRef = useRef<HTMLInputElement>(null);

  // Check if current user is admin of this board
  const currentMember = members.find(m => m.user_id === currentUserId);
  const isAdminOrOwner = isOwner || currentMember?.role === 'admin';

  const [showSettings, setShowSettings] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [mobileSelectedColumn, setMobileSelectedColumn] = useState<string | null>(null);
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
  const [showDuplication, setShowDuplication] = useState<BoardTask | null>(null);
  const [dupTargetColumn, setDupTargetColumn] = useState('');
  const [dupFrequency, setDupFrequency] = useState<string>('daily');
  const [dupWeekdays, setDupWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [dupMonthDay, setDupMonthDay] = useState<number>(1);
  const [showArchive, setShowArchive] = useState(false);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editColumnTitle, setEditColumnTitle] = useState('');
  const [expandedLabels, setExpandedLabels] = useState(false);
  const [showAutomationRules, setShowAutomationRules] = useState(false);
  const [automationTaskId, setAutomationTaskId] = useState<string | undefined>(undefined);
  const [showOperationMode, setShowOperationMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [bgCategory, setBgCategory] = useState('color');
  const boardScrollRef = useRef<HTMLDivElement>(null);
  const [isDraggingBoard, setIsDraggingBoard] = useState(false);
  const dragStartRef = useRef<{ x: number; scrollLeft: number } | null>(null);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>(emptyFilter);
  const [showFilter, setShowFilter] = useState(false);
  const [showPlanner, setShowPlanner] = useState(false);
  const [showBoard, setShowBoard] = useState(true);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showJoinRequests, setShowJoinRequests] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [showDistribution, setShowDistribution] = useState(false);

  const togglePlanner = () => {
    if (showPlanner) { setShowPlanner(false); setShowBoard(true); }
    else setShowPlanner(true);
  };
  const toggleBoard = () => {
    if (showBoard) { if (!showPlanner) return; setShowBoard(false); }
    else setShowBoard(true);
  };

  // Fetch share link and join requests
  useEffect(() => {
    if (!isAdminOrOwner) return;
    const fetchShareData = async () => {
      const { data: links } = await (supabase as any)
        .from('board_share_links')
        .select('*')
        .eq('board_id', board.id)
        .eq('is_active', true)
        .limit(1);
      if (links && links.length > 0) {
        setShareLink(`${window.location.origin}?join=${links[0].share_token}`);
      }
      
      const { data: requests } = await (supabase as any)
        .from('board_join_requests')
        .select('*, profile:profiles!board_join_requests_profile_id_fkey(id, name, display_name, avatar_url, email)')
        .eq('board_id', board.id)
        .eq('status', 'pending');
      setJoinRequests(requests || []);
    };
    fetchShareData();

    const channel = supabase
      .channel(`board-requests-${board.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'board_join_requests', filter: `board_id=eq.${board.id}` }, () => fetchShareData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [board.id, isAdminOrOwner]);

  const generateShareLink = async () => {
    const { data, error } = await (supabase as any)
      .from('board_share_links')
      .insert({ board_id: board.id, created_by: currentUserId })
      .select()
      .single();
    if (!error && data) {
      const link = `${window.location.origin}?join=${data.share_token}`;
      setShareLink(link);
      navigator.clipboard.writeText(link);
      toast.success('Link copiado para a área de transferência!');
    }
  };

  const handleJoinRequest = async (requestId: string, approve: boolean) => {
    const request = joinRequests.find(r => r.id === requestId);
    if (!request) return;
    
    if (approve) {
      await addMember(request.user_id, request.profile_id);
    }
    
    await (supabase as any)
      .from('board_join_requests')
      .update({ status: approve ? 'approved' : 'rejected', resolved_at: new Date().toISOString(), resolved_by: currentUserId })
      .eq('id', requestId);
    
    setJoinRequests(prev => prev.filter(r => r.id !== requestId));
    toast.success(approve ? 'Usuário aprovado!' : 'Solicitação recusada');
  };

  // Auto-distribution recommendations
  const getDistributionRecommendations = () => {
    const memberWorkloads = members.map(m => {
      const memberTasks = tasks.filter(t => t.assigned_to === m.profile_id && !columns.find(c => c.id === t.status)?.is_conclusion);
      return { ...m, taskCount: memberTasks.length, tasks: memberTasks };
    });
    const avg = memberWorkloads.reduce((s, m) => s + m.taskCount, 0) / Math.max(memberWorkloads.length, 1);
    const overloaded = memberWorkloads.filter(m => m.taskCount > avg + 1);
    const underloaded = memberWorkloads.filter(m => m.taskCount < avg);
    
    const recommendations: { taskId: string; taskTitle: string; fromName: string; toName: string; toProfileId: string }[] = [];
    for (const over of overloaded) {
      const excess = over.tasks.slice(Math.ceil(avg));
      for (const task of excess) {
        const target = underloaded.find(u => u.taskCount < avg);
        if (target) {
          const fromProfile = allUsers.find(u => u.id === over.profile_id);
          const toProfile = allUsers.find(u => u.id === target.profile_id);
          recommendations.push({
            taskId: task.id,
            taskTitle: task.title,
            fromName: fromProfile?.display_name || fromProfile?.name || 'Sem nome',
            toName: toProfile?.display_name || toProfile?.name || 'Sem nome',
            toProfileId: target.profile_id,
          });
          target.taskCount++;
        }
      }
    }
    return recommendations;
  };

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
  const [autoConclusion, setAutoConclusion] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#6366f1');
  const [additionalAssignees, setAdditionalAssignees] = useState<string[]>([]);

  const [creating, setCreating] = useState(false);
  const [editingTask, setEditingTask] = useState<BoardTask | null>(null);

  const memberUserIds = new Set(members.map(m => m.user_id));
  const nonMembers = allUsers.filter(u => !memberUserIds.has(u.user_id));

  // Dynamic browser tab title
  useEffect(() => {
    const originalTitle = document.title;
    document.title = `${board.name} | Tarefas`;
    return () => { document.title = originalTitle; };
  }, [board.name]);

  // Update tab title when viewing a card
  useEffect(() => {
    if (showTaskDetail && selectedTask) {
      document.title = `${selectedTask.title} | ${board.name}`;
    } else {
      document.title = `${board.name} | Tarefas`;
    }
  }, [showTaskDetail, selectedTask, board.name]);

  // Dynamic favicon based on board background
  useEffect(() => {
    const bgStyle = getBoardBgStyle(board.background_image);
    if (bgStyle?.backgroundImage) {
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) {
        const originalHref = link.href;
        const urlMatch = (bgStyle.backgroundImage as string).match(/url\(["']?([^"')]+)/);
        if (urlMatch?.[1]) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = 32; canvas.height = 32;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                const r = 8;
                ctx.beginPath();
                ctx.moveTo(r, 0);
                ctx.lineTo(32 - r, 0);
                ctx.quadraticCurveTo(32, 0, 32, r);
                ctx.lineTo(32, 32 - r);
                ctx.quadraticCurveTo(32, 32, 32 - r, 32);
                ctx.lineTo(r, 32);
                ctx.quadraticCurveTo(0, 32, 0, 32 - r);
                ctx.lineTo(0, r);
                ctx.quadraticCurveTo(0, 0, r, 0);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(img, 0, 0, 32, 32);
                link.href = canvas.toDataURL('image/png');
              }
            } catch (e) { /* CORS */ }
          };
          img.src = urlMatch[1];
        }
        return () => { link.href = originalHref; };
      }
    }
  }, [board.background_image]);

  // Apply filter to tasks
  const conclusionColumnIds = columns.filter(c => c.is_conclusion).map(c => c.id);
  const filteredTasks = applyFilter(tasks, taskFilter, profile?.id, conclusionColumnIds, getTaskLabels);

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
    setAdditionalAssignees([]);
  };

  const openCreateTask = (columnId: string) => {
    const col = columns.find(c => c.id === columnId);
    setTitle(''); setDescription(''); setPriority('medium');
    setDueDate('');
    setEditingTask(null);
    setTargetColumn(columnId);
    
    // Apply column automations
    if (col?.auto_assign_to) {
      setAssignedTo(col.auto_assign_to);
    } else {
      setAssignedTo('none');
    }
    if (col?.auto_cover) {
      // Check if auto_cover is an image URL
      if (col.auto_cover.startsWith('http')) {
        setCoverImage('custom');
        setCoverImageUrl(col.auto_cover);
      } else {
        setCoverImage(col.auto_cover);
        setCoverImageUrl('');
      }
    } else {
      setCoverImage('none');
      setCoverImageUrl('');
    }
    
    setShowCreateTask(true);
  };

  const openEditTask = (task: BoardTask) => {
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority);
    setAssignedTo(task.assigned_to || 'none');
    setDueDate(task.due_date ? (() => { const d = new Date(task.due_date); return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}T${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`; })() : '');
    const cover = getCoverDisplay(task.cover_image);
    if (cover.type === 'image') {
      setCoverImage('custom');
      setCoverImageUrl(task.cover_image || '');
    } else {
      setCoverImage(task.cover_image || 'none');
      setCoverImageUrl('');
    }
    // Load existing additional assignees
    const existingAssignees = getTaskAssignees(task.id);
    setAdditionalAssignees(existingAssignees.map(a => a.profile_id));
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
    let taskId: string | null = null;
    if (editingTask) {
      result = await updateTask(editingTask.id, {
        ...taskData,
        assigned_to: assignedTo !== 'none' ? assignedTo : null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        cover_image: finalCover || null,
        description: description.trim() || null,
      } as any);
      taskId = editingTask.id;
    } else {
      result = await createTask(taskData);
      taskId = result.data?.id || null;
    }

    setCreating(false);
    if (result.error) { toast.error('Erro ao salvar tarefa'); return; }

    // Save additional assignees
    if (taskId && additionalAssignees.length > 0) {
      await setTaskAssigneesDb(taskId, additionalAssignees);
    } else if (taskId && additionalAssignees.length === 0) {
      await setTaskAssigneesDb(taskId, []);
    }

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

  const handleArchiveTask = async (taskId: string) => {
    const { error } = await archiveTask(taskId);
    if (error) { toast.error('Erro ao arquivar'); return; }
    toast.success('Card arquivado');
  };

  const handleArchiveColumn = async (colId: string) => {
    const colTasks = tasks.filter(t => t.status === colId);
    if (colTasks.length === 0) { toast.info('Nenhum card para arquivar'); return; }
    if (!confirm(`Arquivar ${colTasks.length} card(s) desta coluna?`)) return;
    const { error } = await archiveColumnTasks(colId);
    if (error) { toast.error('Erro ao arquivar'); return; }
    toast.success(`${colTasks.length} card(s) arquivado(s)`);
  };

  const handleUnarchiveTask = async (taskId: string) => {
    const { error } = await unarchiveTask(taskId);
    if (error) { toast.error('Erro ao desarquivar'); return; }
    toast.success('Card restaurado');
  };

  const handleRenameColumn = async (colId: string) => {
    if (!editColumnTitle.trim()) return;
    const { error } = await updateColumn(colId, { title: editColumnTitle.trim() } as any);
    if (error) { toast.error('Erro ao renomear'); return; }
    toast.success('Coluna renomeada');
    setEditingColumnId(null);
    setEditColumnTitle('');
    refetchColumns();
  };

  const handleMoveColumn = async (colId: string, direction: 'left' | 'right') => {
    const idx = columns.findIndex(c => c.id === colId);
    if (idx < 0) return;
    const swapIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= columns.length) return;
    const colA = columns[idx];
    const colB = columns[swapIdx];
    await Promise.all([
      updateColumn(colA.id, { position: colB.position } as any),
      updateColumn(colB.id, { position: colA.position } as any),
    ]);
    toast.success('Coluna movida');
    refetchColumns();
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
    const updates: Record<string, string | boolean | null> = {
      auto_assign_to: autoAssign !== 'none' ? autoAssign : null,
      auto_cover: autoCover !== 'none' ? autoCover : null,
      is_conclusion: autoConclusion,
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
    setAutoConclusion(col.is_conclusion || false);
    setShowAutomation(col);
  };

  const handleAutoCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadFile(file);
    if (result) {
      setAutoCover(result.url);
    }
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    const { error } = await createLabel(newLabelName.trim(), newLabelColor);
    if (error) toast.error('Erro ao criar etiqueta');
    else { toast.success('Etiqueta criada!'); setNewLabelName(''); }
  };

  const handleToggleLabel = async (taskId: string, labelId: string) => {
    const tLabels = getTaskLabels(taskId);
    const hasLabel = tLabels.some(l => l.id === labelId);
    const label = labels.find(l => l.id === labelId);
    if (hasLabel) {
      await removeLabel(taskId, labelId);
    } else {
      await assignLabel(taskId, labelId);
    }
    if (profile && label) {
      await (supabase as any).from('task_activities').insert({
        task_id: taskId, user_id: profile.id,
        user_name: profile.display_name || profile.name,
        action_type: 'label',
        description: hasLabel ? `removeu a etiqueta "${label.name}"` : `adicionou a etiqueta "${label.name}"`,
      });
    }
  };

  const handleQuickComplete = async (task: BoardTask) => {
    const conclusionCol = columns.find(c => c.is_conclusion);
    if (!conclusionCol) { toast.error('Nenhuma coluna de conclusão configurada'); return; }
    const moveCheck = canMoveToColumn(task.status, conclusionCol.id);
    if (!moveCheck.allowed) { toast.error(moveCheck.reason || 'Movimento bloqueado'); return; }
    await moveTask(task.id, conclusionCol.id, 0);
    await updateTask(task.id, {
      completed_at: new Date().toISOString(),
      completed_late: task.due_date ? new Date() > new Date(task.due_date) : false,
      delay_days: task.due_date ? Math.max(0, Math.ceil((new Date().getTime() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24))) : 0,
    });
    toast.success('Tarefa concluída!');
    if (profile) {
      await (supabase as any).from('task_activities').insert({
        task_id: task.id, user_id: profile.id,
        user_name: profile.display_name || profile.name,
        action_type: 'complete', description: 'marcou como concluída',
      });
    }
  };

  const applyColumnAutoSubtasks = async (taskId: string, columnId: string) => {
    try {
      const { data: autoSubs } = await supabase.from('column_auto_subtasks').select('*').eq('column_id', columnId).order('group_title').order('position');
      if (!autoSubs || autoSubs.length === 0) return;
      const { data: existing } = await supabase.from('task_subtasks').select('id').eq('task_id', taskId).limit(1);
      if (existing && existing.length > 0) return;
      const groupMap = new Map<string, any[]>();
      autoSubs.forEach((s: any) => {
        if (!groupMap.has(s.group_title)) groupMap.set(s.group_title, []);
        groupMap.get(s.group_title)!.push(s);
      });
      let pos = 0;
      for (const [title, items] of groupMap) {
        const { data: group } = await supabase.from('subtask_groups').insert({ task_id: taskId, title, position: pos++ }).select().single();
        if (group) {
          await supabase.from('task_subtasks').insert(items.map((item: any, idx: number) => ({ task_id: taskId, title: item.title, position: idx, group_id: group.id })));
        }
      }
      toast.info('Subtarefas automáticas aplicadas');
    } catch (err) { console.error('Error applying auto subtasks:', err); }
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
      // Workflow rule check
      const moveCheck = canMoveToColumn(draggedTask.status, colId);
      if (!moveCheck.allowed) {
        toast.error(moveCheck.reason || 'Movimento bloqueado por regra de workflow');
        setDraggedTask(null);
        return;
      }
      const colTasks = tasks.filter(t => t.status === colId);
      await moveTask(draggedTask.id, colId, position ?? colTasks.length);

      // Log activity
      const sourceCol = columns.find(c => c.id === draggedTask.status);
      const targetCol = columns.find(c => c.id === colId);
      if (profile && targetCol) {
        await (supabase as any).from('task_activities').insert({
          task_id: draggedTask.id, user_id: profile.id,
          user_name: profile.display_name || profile.name,
          action_type: 'move',
          description: `moveu de "${sourceCol?.title || '?'}" para "${targetCol.title}"`,
        });
      }

      // Apply column automations on drag
      if (targetCol) {
        const autoUpdates: Record<string, any> = {};
        if (targetCol.auto_assign_to) autoUpdates.assigned_to = targetCol.auto_assign_to;
        if (targetCol.auto_cover) autoUpdates.cover_image = targetCol.auto_cover;

        if (targetCol.is_conclusion) {
          autoUpdates.completed_at = new Date().toISOString();
          if (draggedTask.due_date) {
            const due = new Date(draggedTask.due_date);
            const now = new Date();
            due.setHours(0, 0, 0, 0);
            now.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
            autoUpdates.completed_late = diffDays > 0;
            autoUpdates.delay_days = diffDays > 0 ? diffDays : 0;
          } else {
            autoUpdates.completed_late = false;
            autoUpdates.delay_days = 0;
          }
        }

        if (Object.keys(autoUpdates).length > 0) {
          await updateTask(draggedTask.id, autoUpdates);
          if (targetCol.is_conclusion) {
            toast.info(autoUpdates.completed_late ? `Concluída com ${autoUpdates.delay_days} dia(s) de atraso` : 'Concluída no prazo!');
          } else {
            toast.info('Automações da coluna aplicadas');
          }
        }

        // Apply auto-subtasks
        await applyColumnAutoSubtasks(draggedTask.id, colId);
      }
    }
    setDraggedTask(null);
  };
  const handleDragEnd = () => { setDraggedTask(null); setDragOverColumn(null); setDragOverPosition(null); };

  const boardBg = getBoardBg(board.background_image);
  const boardBgStyle = getBoardBgStyle(board.background_image);
  const isDarkBg = isBoardBgDark(board.background_image);

  // Drag-to-scroll handlers for desktop board
  const handleBoardMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Only drag on empty space, not on cards/buttons
    if (target.closest('.bg-card, button, [draggable], input, textarea, [role="dialog"]')) return;
    if (!boardScrollRef.current) return;
    setIsDraggingBoard(true);
    dragStartRef.current = { x: e.clientX, scrollLeft: boardScrollRef.current.scrollLeft };
    e.preventDefault();
  };
  const handleBoardMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingBoard || !dragStartRef.current || !boardScrollRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    boardScrollRef.current.scrollLeft = dragStartRef.current.scrollLeft - dx;
  };
  const handleBoardMouseUp = () => {
    setIsDraggingBoard(false);
    dragStartRef.current = null;
  };

  return (
    <div className={cn('flex flex-col h-full relative', boardBg)} style={boardBgStyle}>
      {/* Dark overlay for image backgrounds to improve readability */}
      {isDarkBg && <div className="absolute inset-0 bg-black/40 pointer-events-none z-0" />}
      {/* Search is now inline in header */}

      {/* Header */}
      <div className={cn("flex items-center gap-2 p-3 border-b border-border backdrop-blur-sm relative z-10", isDarkBg ? "bg-black/50 text-white" : "bg-background/80")}>
        <Button variant="ghost" size="icon" onClick={onBack} className={isDarkBg ? "text-white hover:bg-white/20" : ""}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1 min-w-0">
          <h2 className={cn("font-semibold truncate", isDarkBg ? "text-white" : "text-foreground")}>{board.name}</h2>
          <p className={cn("text-xs", isDarkBg ? "text-white/70" : "text-muted-foreground")}>{tasks.length} tarefas</p>
        </div>

        {/* Member avatars - only on desktop */}
        {!isMobile && (
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
        )}

        <div className="flex items-center gap-1">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true); }}
              onFocus={() => { if (searchQuery) setShowSearch(true); }}
              onBlur={() => setTimeout(() => setShowSearch(false), 200)}
              className={cn("pl-8 h-8 text-xs bg-muted/50 focus-visible:ring-primary", isMobile ? "w-28" : "w-52")}
            />
            {/* Dropdown results */}
            {showSearch && searchQuery.trim() && !isMobile && (() => {
              const q = searchQuery.toLowerCase().trim();
              const allSearchTasks = [...tasks, ...archivedTasks].filter(t =>
                t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || `#${t.task_number}`.includes(q)
              );
              return (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-border bg-card shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                  {allSearchTasks.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">Nenhum card encontrado</div>
                  ) : (
                    allSearchTasks.slice(0, 10).map(t => {
                      const col = columns.find(c => c.id === t.status);
                      return (
                        <button
                          key={t.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedTask(t); setShowTaskDetail(true); setShowSearch(false); setSearchQuery('');
                          }}
                          className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border last:border-b-0"
                        >
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: col?.color || 'hsl(var(--muted-foreground))' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">#{t.task_number} {t.title}</p>
                            <p className="text-xs text-muted-foreground">{col?.title || 'Sem coluna'}{t.is_archived ? ' • Arquivado' : ''}</p>
                          </div>
                          <Badge className={cn('text-[9px] text-white flex-shrink-0 mt-0.5', PRIORITIES.find(p => p.id === t.priority)?.color)}>
                            {PRIORITIES.find(p => p.id === t.priority)?.label}
                          </Badge>
                        </button>
                      );
                    })
                  )}
                </div>
              );
            })()}
          </div>

          {isMobile ? (
            /* Mobile: Hamburger menu for all options */
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className={isDarkBg ? "text-white hover:bg-white/20" : ""}>
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setShowFilter(true)}>
                  <Filter className="h-4 w-4 mr-2" /> Filtro {isFilterActive(taskFilter) && '●'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowReport(true)}>
                  <FileDown className="h-4 w-4 mr-2" /> Relatório
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowMembers(true)}>
                  <Users className="h-4 w-4 mr-2" /> Membros
                </DropdownMenuItem>
                {isAdminOrOwner && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShowDistribution(true)}>
                      <Shuffle className="h-4 w-4 mr-2" /> Auto-distribuição
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowShareDialog(true)}>
                      <Share2 className="h-4 w-4 mr-2" /> Compartilhar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowJoinRequests(true)}>
                      <UserPlus className="h-4 w-4 mr-2" /> Solicitações {joinRequests.length > 0 && `(${joinRequests.length})`}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShowArchive(true)}>
                      <Archive className="h-4 w-4 mr-2" /> Arquivados
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowSettings(true)}>
                      <Settings className="h-4 w-4 mr-2" /> Configurações
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowFilter(true)}
                title="Filtro"
                className={cn(isFilterActive(taskFilter) && "text-primary")}
              >
                <Filter className="h-4 w-4" />
                {isFilterActive(taskFilter) && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => { setAutomationTaskId(undefined); setShowAutomationRules(true); }} title="Automações do Board">
                <Zap className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowOperationMode(true)} title="Modo Operação" className="text-orange-500 hover:text-orange-600">
                <Activity className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowLabelsManager(true)} title="Etiquetas">
                <Tag className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowReport(true)} title="Relatório">
                <FileDown className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowMembers(true)} title="Membros">
                <Users className="h-4 w-4" />
              </Button>
              {isAdminOrOwner && (
                <>
                  <Button variant="ghost" size="icon" onClick={() => setShowDistribution(true)} title="Auto-distribuição" className="text-secondary hover:text-secondary/80">
                    <Shuffle className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setShowShareDialog(true)} title="Compartilhar quadro">
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <div className="relative">
                    <Button variant="ghost" size="icon" onClick={() => setShowJoinRequests(true)} title="Solicitações">
                      <UserPlus className="h-4 w-4" />
                    </Button>
                    {joinRequests.length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center font-bold">
                        {joinRequests.length}
                      </span>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setShowArchive(true)} title="Arquivados">
                    <Archive className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)} title="Configurações">
                    <Settings className="h-4 w-4" />
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Board area with optional planner */}
      <div className="flex-1 overflow-hidden relative z-10 flex">
        {/* Planner sidebar - Trello style */}
        {showPlanner && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: showBoard ? 300 : '100%', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden flex-shrink-0 py-3 pl-3"
          >
            <div className={cn(
              "h-full overflow-y-auto p-4 space-y-3 rounded-xl",
              "bg-muted text-foreground"
            )}>
              <h3 className="font-display font-semibold text-sm text-foreground">
                Planejador
              </h3>
              <p className="text-xs text-muted-foreground">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <div className="h-px bg-border" />
              {(() => {
                const todayTasks = tasks.filter(t => {
                  if (!t.due_date) return false;
                  return new Date(t.due_date).toDateString() === new Date().toDateString();
                }).sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
                return todayTasks.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <div className="mb-3 rounded-full bg-background p-3">
                      <Calendar className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">Nenhuma tarefa para hoje</p>
                  </div>
                ) : todayTasks.map(t => {
                  const col = columns.find(c => c.id === t.status);
                  return (
                    <div key={t.id} className="p-3 rounded-lg bg-background cursor-pointer hover:bg-background/80 transition-all shadow-sm"
                      onClick={() => { setSelectedTask(t); setShowTaskDetail(true); }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col?.color }} />
                        <span className="text-xs text-muted-foreground">
                          {new Date(t.due_date!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground">{t.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{col?.title}</p>
                    </div>
                  );
                });
              })()}
            </div>
          </motion.div>
        )}
        {showBoard && (
        <div className="flex-1 overflow-hidden">
          <div
            ref={boardScrollRef}
            className={cn(isMobile ? 'overflow-y-auto' : 'overflow-x-auto overflow-y-hidden h-full p-4 task-board-scroll')}
            onMouseDown={!isMobile ? handleBoardMouseDown : undefined}
            onMouseMove={!isMobile ? handleBoardMouseMove : undefined}
            onMouseUp={!isMobile ? handleBoardMouseUp : undefined}
            onMouseLeave={!isMobile ? handleBoardMouseUp : undefined}
            style={!isMobile ? { cursor: isDraggingBoard ? 'grabbing' : 'grab' } : undefined}
          >
          <TooltipProvider delayDuration={200}>
          {isMobile ? (
            /* Mobile: Column selector panel */
            mobileSelectedColumn ? (
              <div className="p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setMobileSelectedColumn(null)}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Colunas
                  </Button>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: columns.find(c => c.id === mobileSelectedColumn)?.color }} />
                  <span className="font-semibold text-sm">{columns.find(c => c.id === mobileSelectedColumn)?.title}</span>
                  <Badge variant="secondary" className="text-xs">{filteredTasks.filter(t => t.status === mobileSelectedColumn).length}</Badge>
                </div>
                <div className="space-y-2">
                  {filteredTasks.filter(t => t.status === mobileSelectedColumn).sort((a, b) => a.position - b.position).map((task) => {
                    const cover = getCoverDisplay(task.cover_image);
                    const dueInfo = getDueDateInfo(task.due_date);
                    const taskLabelsForCard = getTaskLabels(task.id);
                    return (
                      <div key={task.id} className="bg-card rounded-lg border border-border p-3 relative"
                        onClick={() => { setSelectedTask(task); setShowTaskDetail(true); }}
                      >
                        {cover.type === 'color' && <div className={cn('h-2 rounded-t-lg -mx-3 -mt-3 mb-2', cover.value)} />}
                        {cover.type === 'image' && (
                          <div className="h-20 rounded-t-lg -mx-3 -mt-3 mb-2 overflow-hidden">
                            <img src={cover.value} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                        {taskLabelsForCard.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-1.5 cursor-pointer" onClick={(e) => { e.stopPropagation(); setExpandedLabels(!expandedLabels); }}>
                            {taskLabelsForCard.map(l => (
                              <span
                                key={l.id}
                                className={cn(
                                  'rounded-sm transition-all',
                                  expandedLabels
                                    ? 'inline-flex items-center h-5 px-2 text-[10px] font-semibold text-white'
                                    : 'inline-block w-10 h-2'
                                )}
                                style={{ backgroundColor: l.color }}
                                title={l.name}
                              >
                                {expandedLabels && l.name}
                              </span>
                            ))}
                          </div>
                        )}
                        <h4 className="font-normal text-sm text-foreground mb-1.5">{task.title}</h4>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {dueInfo && (() => {
                            const DI = dueInfo.icon;
                            return (
                              <div className={cn('flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium', dueInfo.color)}>
                                <DI className="h-3 w-3" />
                                {task.due_date && new Date(task.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                {task.due_date && (() => { const d = new Date(task.due_date); return d.getHours() !== 0 || d.getMinutes() !== 0 ? ` ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''; })()}
                              </div>
                            );
                          })()}
                          {subtaskCounts[task.id] && subtaskCounts[task.id].total > 0 && (
                            <div className={cn("flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded",
                              subtaskCounts[task.id].completed === subtaskCounts[task.id].total ? "bg-green-500/10 text-green-600" : "text-muted-foreground"
                            )}>
                              <CheckSquare className="h-3 w-3" />
                              <span>{subtaskCounts[task.id].completed}/{subtaskCounts[task.id].total}</span>
                            </div>
                          )}
                          <div className="flex-1" />
                          {task.assignee && (
                            <Avatar className="h-6 w-6 ring-1 ring-border">
                              <AvatarImage src={task.assignee.avatar_url || ''} />
                              <AvatarFallback className="text-[8px] bg-primary/80 text-primary-foreground">
                                {getInitials(task.assignee.display_name || task.assignee.name)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                        {/* Quick actions */}
                        <div className="absolute top-2 right-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="secondary" size="icon" className="h-6 w-6 rounded-full shadow-sm">
                                <Edit className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditTask(task); }}>
                                <Edit className="h-4 w-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleArchiveTask(task.id); }}>
                                <Archive className="h-4 w-4 mr-2" /> Arquivar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setAutomationTaskId(task.id); setShowAutomationRules(true); }}>
                                <Zap className="h-4 w-4 mr-2" /> Automações
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-xs font-medium text-muted-foreground" disabled>Mover para:</DropdownMenuItem>
                              {columns.filter(c => c.id !== mobileSelectedColumn).map(c => (
                                <DropdownMenuItem key={c.id} onClick={async (e) => {
                                  e.stopPropagation();
                                  await moveTask(task.id, c.id, 0);
                                  toast.success(`Movido para ${c.title}`);
                                }}>
                                  <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: c.color }} />
                                  {c.title}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                  <Button variant="ghost" size="sm" className="w-full text-xs gap-1 mt-1" onClick={() => openCreateTask(mobileSelectedColumn)}>
                    <Plus className="h-3 w-3" /> Adicionar Tarefa
                  </Button>
                </div>
              </div>
            ) : (
              /* Mobile: Column list panel */
              <div className="p-3 space-y-2 relative">
                {/* Search results overlay - above columns */}
                {showSearch && searchQuery.trim() && (() => {
                  const q = searchQuery.toLowerCase().trim();
                  const allSearchTasks = [...tasks, ...archivedTasks].filter(t =>
                    t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || `#${t.task_number}`.includes(q)
                  );
                  return (
                    <div className="absolute left-3 right-3 top-0 z-50 rounded-lg border border-border bg-card shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                      {allSearchTasks.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">Nenhum card encontrado</div>
                      ) : (
                        allSearchTasks.slice(0, 10).map(t => {
                          const col = columns.find(c => c.id === t.status);
                          return (
                            <button
                              key={t.id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setSelectedTask(t); setShowTaskDetail(true); setShowSearch(false); setSearchQuery('');
                              }}
                              className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border last:border-b-0"
                            >
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: col?.color || 'hsl(var(--muted-foreground))' }} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">#{t.task_number} {t.title}</p>
                                <p className="text-xs text-muted-foreground">{col?.title || 'Sem coluna'}{t.is_archived ? ' • Arquivado' : ''}</p>
                              </div>
                              <Badge className={cn('text-[9px] text-white flex-shrink-0 mt-0.5', PRIORITIES.find(p => p.id === t.priority)?.color)}>
                                {PRIORITIES.find(p => p.id === t.priority)?.label}
                              </Badge>
                            </button>
                          );
                        })
                      )}
                    </div>
                  );
                })()}
                {columns.map(col => {
                  const colTasks = filteredTasks.filter(t => t.status === col.id);
                  return (
                    <button
                      key={col.id}
                      onClick={() => setMobileSelectedColumn(col.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted transition-colors text-left"
                    >
                      <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-foreground">{col.title}</h4>
                        <p className="text-xs text-muted-foreground">{colTasks.length} tarefa(s)</p>
                      </div>
                      {col.is_conclusion && (
                        <Badge variant="outline" className="text-[9px] border-green-500 text-green-600">✓</Badge>
                      )}
                    </button>
                  );
                })}
                <Button variant="outline" className="w-full gap-2 mt-2" onClick={() => setShowAddColumn(true)}>
                  <PlusCircle className="h-4 w-4" /> Nova Coluna
                </Button>
              </div>
            )
          ) : (
            /* Desktop: horizontal scroll */
            <div className="inline-flex gap-4 h-full pb-2 items-start">
            {columns.map((column) => {
              const colTasks = filteredTasks.filter(t => t.status === column.id).sort((a, b) => a.position - b.position);
              return (
                <div
                  key={column.id}
                  className={cn(
                    'rounded-xl transition-colors flex flex-col',
                    isMobile ? 'w-full' : 'w-[280px] flex-shrink-0',
                    dragOverColumn === column.id ? 'bg-primary/10 ring-2 ring-primary/30' : 'bg-background/60 backdrop-blur-sm'
                  )}
                  onDragOver={(e) => handleDragOver(e, column.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, column.id)}
                >
                  <div className="flex items-center gap-2 p-3 border-b border-border">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: column.color }} />
                    {editingColumnId === column.id ? (
                      <div className="flex items-center gap-1 flex-1">
                        <Input
                          value={editColumnTitle}
                          onChange={(e) => setEditColumnTitle(e.target.value)}
                          className="h-6 text-sm py-0 px-1"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') handleRenameColumn(column.id); if (e.key === 'Escape') setEditingColumnId(null); }}
                        />
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleRenameColumn(column.id)}>
                          <CheckSquare className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setEditingColumnId(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <h3
                        className={cn("font-semibold text-foreground text-sm flex-1 truncate transition-colors", isAdminOrOwner && "cursor-pointer hover:text-primary")}
                        onDoubleClick={() => { if (isAdminOrOwner) { setEditingColumnId(column.id); setEditColumnTitle(column.title); } }}
                        title={isAdminOrOwner ? "Clique duplo para renomear" : column.title}
                      >
                        {column.title}
                      </h3>
                    )}
                    {column.is_conclusion && (
                      <Badge variant="outline" className="text-[9px] border-green-500 text-green-600">✓ Conclusão</Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">{colTasks.length}</Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6"><MoreVertical className="h-3 w-3" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openCreateTask(column.id)}>
                          <Plus className="h-4 w-4 mr-2" /> Adicionar Tarefa
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setEditingColumnId(column.id); setEditColumnTitle(column.title); }}>
                          <Pencil className="h-4 w-4 mr-2" /> Renomear Coluna
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openAutomation(column)}>
                          <Zap className="h-4 w-4 mr-2" /> Automações
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleArchiveColumn(column.id)}>
                          <Archive className="h-4 w-4 mr-2" /> Arquivar Todos os Cards
                        </DropdownMenuItem>
                        {columns.indexOf(column) > 0 && (
                          <DropdownMenuItem onClick={() => handleMoveColumn(column.id, 'left')}>
                            <ArrowLeft className="h-4 w-4 mr-2" /> Mover para Esquerda
                          </DropdownMenuItem>
                        )}
                        {columns.indexOf(column) < columns.length - 1 && (
                          <DropdownMenuItem onClick={() => handleMoveColumn(column.id, 'right')}>
                            <MoveRight className="h-4 w-4 mr-2" /> Mover para Direita
                          </DropdownMenuItem>
                        )}
                        {isAdminOrOwner && (
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

                  <div className="p-2 space-y-2 min-h-[60px] flex-1 overflow-y-auto max-h-[calc(100vh-300px)] task-col-scroll">
                    {colTasks.map((task, index) => {
                      const cover = getCoverDisplay(task.cover_image);
                      const dueInfo = getDueDateInfo(task.due_date);
                      const taskLabelsForCard = getTaskLabels(task.id);
                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); handleDragOver(e, column.id, index); }}
                          onDrop={(e) => { e.stopPropagation(); handleDrop(e, column.id, index); }}
                          onClick={() => { setSelectedTask(task); setShowTaskDetail(true); }}
                          className={cn(
                            'bg-card rounded-lg shadow-sm border border-border cursor-pointer hover:shadow-md transition-all group/card relative',
                            draggedTask?.id === task.id && 'opacity-50 scale-95',
                            dragOverColumn === column.id && dragOverPosition === index && 'ring-2 ring-primary'
                          )}
                        >
                          {/* Cover */}
                          {cover.type === 'color' && <div className={cn('h-8 rounded-t-lg', cover.value)} />}
                          {cover.type === 'image' && (
                            <div className="h-28 rounded-t-lg overflow-hidden">
                              <img src={cover.value} alt="Capa" className="w-full h-full object-cover" />
                            </div>
                          )}

                          <div className="px-2 py-1.5">
                            {/* Labels */}
                            {taskLabelsForCard.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); setExpandedLabels(!expandedLabels); }}>
                                {taskLabelsForCard.map(l => (
                                  <span
                                    key={l.id}
                                    className={cn(
                                      'rounded-sm transition-all',
                                      expandedLabels
                                        ? 'inline-flex items-center h-5 px-2 text-[10px] font-semibold text-white'
                                        : 'inline-block w-10 h-2'
                                    )}
                                    style={{ backgroundColor: l.color }}
                                    title={l.name}
                                  >
                                    {expandedLabels && l.name}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Title with hover completion dot */}
                            <div className="flex items-start gap-0 group-hover/card:gap-1.5 transition-all duration-200 mb-1.5">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleQuickComplete(task); }}
                                className="w-0 h-4 mt-0.5 group-hover/card:w-4 min-w-0 group-hover/card:min-w-[16px] opacity-0 group-hover/card:opacity-100 transition-all duration-200 rounded-full border-2 border-muted-foreground/30 flex-shrink-0 hover:!border-green-500 hover:!bg-green-500/20"
                                title="Marcar como concluída"
                              />
                              <h4 className="font-normal text-sm text-foreground leading-snug">{task.title}</h4>
                            </div>

                            {/* Bottom row: badges + avatar */}
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-[10px] text-muted-foreground font-medium">#{task.task_number}</span>
                              {dueInfo && (
                                <span className={cn('inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium', dueInfo.color)}>
                                  <dueInfo.icon className="h-2.5 w-2.5" />
                                  {dueInfo.label}
                                </span>
                              )}
                              {(() => { const sc = subtaskCounts[task.id]; return sc && sc.total > 0 ? (
                                <span className={cn('inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium', sc.completed === sc.total ? 'text-green-600 bg-green-500/10' : 'text-muted-foreground bg-muted')}>
                                  <CheckCircle2 className="h-2.5 w-2.5" /> {sc.completed}/{sc.total}
                                </span>
                              ) : null; })()}
                              <div className="flex-1" />
                              {/* Additional Assignees */}
                              {(() => {
                                const extraAssignees = getTaskAssignees(task.id);
                                if (extraAssignees.length === 0) return null;
                                return (
                                  <div className="flex -space-x-1">
                                    {extraAssignees.slice(0, 2).map(a => (
                                      <Tooltip key={a.id}>
                                        <TooltipTrigger asChild>
                                          <Avatar className="h-5 w-5 ring-1 ring-background">
                                            <AvatarImage src={a.profile?.avatar_url || ''} />
                                            <AvatarFallback className="text-[7px] bg-primary/80 text-primary-foreground">
                                              {getInitials(a.profile?.display_name || a.profile?.name || 'U')}
                                            </AvatarFallback>
                                          </Avatar>
                                        </TooltipTrigger>
                                        <TooltipContent className="text-xs">{a.profile?.display_name || a.profile?.name}</TooltipContent>
                                      </Tooltip>
                                    ))}
                                    {extraAssignees.length > 2 && (
                                      <Avatar className="h-5 w-5 ring-1 ring-background">
                                        <AvatarFallback className="text-[7px] bg-muted text-muted-foreground">+{extraAssignees.length - 2}</AvatarFallback>
                                      </Avatar>
                                    )}
                                  </div>
                                );
                              })()}
                              {task.assignee && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Avatar className="h-6 w-6 ring-1 ring-border">
                                      <AvatarImage src={task.assignee.avatar_url || ''} />
                                      <AvatarFallback className="text-[8px] bg-primary/80 text-primary-foreground">
                                        {getInitials(task.assignee.display_name || task.assignee.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                  </TooltipTrigger>
                                  <TooltipContent>{task.assignee.display_name || task.assignee.name}</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>

                          {/* Quick action on hover */}
                          <div className="absolute top-1 right-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="secondary" size="icon" className="h-6 w-6 rounded-full shadow-sm">
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditTask(task); }}>
                                  <Edit className="h-4 w-4 mr-2" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setShowLabelPicker(task.id); }}>
                                  <Tag className="h-4 w-4 mr-2" /> Etiquetas
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  setShowDuplication(task);
                                  setDupTargetColumn(columns[0]?.id || '');
                                  setDupFrequency('daily');
                                }}>
                                <Repeat className="h-4 w-4 mr-2" /> Auto-duplicar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleArchiveTask(task.id); }}>
                                  <Archive className="h-4 w-4 mr-2" /> Arquivar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setAutomationTaskId(task.id); setShowAutomationRules(true); }}>
                                  <Zap className="h-4 w-4 mr-2" /> Automações
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-xs font-medium text-muted-foreground" disabled>
                                  Mover para:
                                </DropdownMenuItem>
                                {columns.filter(c => c.id !== column.id).map(c => (
                                  <DropdownMenuItem key={c.id} onClick={async (e) => {
                                    e.stopPropagation();
                                    await moveTask(task.id, c.id, 0);
                                    const autoUpdates: Record<string, any> = {};
                                    if (c.auto_assign_to) autoUpdates.assigned_to = c.auto_assign_to;
                                    if (c.auto_cover) autoUpdates.cover_image = c.auto_cover;
                                    if (c.is_conclusion) {
                                      autoUpdates.completed_at = new Date().toISOString();
                                      if (task.due_date) {
                                        const due = new Date(task.due_date);
                                        const now = new Date();
                                        due.setHours(0, 0, 0, 0);
                                        now.setHours(0, 0, 0, 0);
                                        const diffDays = Math.ceil((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
                                        autoUpdates.completed_late = diffDays > 0;
                                        autoUpdates.delay_days = diffDays > 0 ? diffDays : 0;
                                      } else {
                                        autoUpdates.completed_late = false;
                                        autoUpdates.delay_days = 0;
                                      }
                                    }
                                    if (Object.keys(autoUpdates).length > 0) {
                                      await updateTask(task.id, autoUpdates);
                                      if (c.is_conclusion) {
                                        toast.info(autoUpdates.completed_late ? `Concluída com ${autoUpdates.delay_days} dia(s) de atraso` : 'Concluída no prazo!');
                                      } else {
                                        toast.info('Automações aplicadas');
                                      }
                                    }
                                  }}>
                                    <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: c.color }} />
                                    {c.title}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }} className="text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    })}
                    {colTasks.length === 0 && (
                      <div className="text-center py-6 text-muted-foreground text-xs">Nenhuma tarefa</div>
                    )}
                  </div>
                  {/* Fixed add button at bottom of column */}
                  <div className="p-2 pt-0 border-t border-border">
                    <Button variant="ghost" size="sm" className="w-full text-xs gap-1" onClick={() => openCreateTask(column.id)}>
                      <Plus className="h-3 w-3" /> Adicionar
                    </Button>
                  </div>
                </div>
              );
            })}
            {/* Add column button */}
            <div className={cn('flex-shrink-0', isMobile ? 'w-full' : 'w-[280px]')}>
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
          )}
          </TooltipProvider>
        </div>
        </div>
        )}
      </div>

      {/* Bottom bar: Planner / Board / Switch - Trello style */}
      {!isMobile && (
        <div className="flex items-center justify-center py-1.5 relative z-10">
          <div className="flex items-center bg-sidebar rounded-lg p-0.5">
            <button
              onClick={togglePlanner}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                showPlanner ? "bg-sidebar-accent text-sidebar-foreground" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              Planejador
            </button>
            <button
              onClick={toggleBoard}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                showBoard && !showPlanner ? "bg-sidebar-accent text-sidebar-foreground" : showBoard ? "bg-sidebar-accent/50 text-sidebar-foreground" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              Quadro
            </button>
            <div className="w-px h-5 bg-sidebar-border mx-0.5" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors">
                  Mudar de quadro
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64">
                {boards.filter(b => b.id !== board.id).map(b => (
                  <DropdownMenuItem key={b.id} onClick={() => onSelectBoard(b.id)} className="flex items-center gap-3 p-2">
                    <div
                      className={cn("w-12 h-8 rounded flex-shrink-0 border border-border", getBoardBg(b.background_image))}
                      style={getBoardBgStyle(b.background_image)}
                    />
                    <span className="text-sm font-medium truncate">{b.name}</span>
                  </DropdownMenuItem>
                ))}
                {boards.filter(b => b.id !== board.id).length === 0 && (
                  <div className="p-3 text-sm text-muted-foreground text-center">Nenhum outro quadro</div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

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
              <Label>Responsáveis adicionais</Label>
              <ScrollArea className="border border-border rounded-lg max-h-[120px]">
                <div className="p-1">
                  {members.filter(m => m.profile_id !== assignedTo).map(m => (
                    <label key={m.profile_id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/50 border-b border-border last:border-0">
                      <Checkbox
                        checked={additionalAssignees.includes(m.profile_id)}
                        onCheckedChange={(checked) => {
                          setAdditionalAssignees(prev => checked ? [...prev, m.profile_id] : prev.filter(id => id !== m.profile_id));
                        }}
                      />
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={m.profile?.avatar_url || ''} />
                        <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">{getInitials(m.profile?.display_name || m.profile?.name || 'U')}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs truncate">{m.profile?.display_name || m.profile?.name}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
              <p className="text-[10px] text-muted-foreground">Selecione colaboradores adicionais para acompanhar esta tarefa</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data de Entrega</Label>
                <Input type="date" value={dueDate.split('T')[0] || dueDate} onChange={(e) => {
                  const time = dueDate.includes('T') ? dueDate.split('T')[1] : '';
                  setDueDate(time ? `${e.target.value}T${time}` : e.target.value);
                }} />
              </div>
              <div className="space-y-2">
                <Label>Hora de Entrega</Label>
                <Input type="time" value={dueDate.includes('T') ? dueDate.split('T')[1] : ''} onChange={(e) => {
                  const date = dueDate.split('T')[0] || dueDate;
                  setDueDate(date ? `${date}T${e.target.value}` : '');
                }} />
              </div>
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
        onUpdateTask={async (id, updates) => { await updateTask(id, updates); await refetchTasks(); }}
        taskLabels={selectedTask ? getTaskLabels(selectedTask.id) : []}
        allLabels={labels}
        onToggleLabel={handleToggleLabel}
        boardId={board.id}
        onOpenAutomation={(id) => { setShowTaskDetail(false); setAutomationTaskId(id); setShowAutomationRules(true); }}
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
                    <p className="text-xs text-muted-foreground">
                      {m.role === 'owner' ? 'Dono' : m.role === 'admin' ? '⭐ Administrador' : 'Membro'}
                    </p>
                  </div>
                  {isAdminOrOwner && m.role !== 'owner' && (
                    <div className="flex items-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={m.role === 'admin' ? 'default' : 'outline'}
                              size="icon"
                              className="h-7 w-7"
                              onClick={async () => {
                                const newRole = m.role === 'admin' ? 'member' : 'admin';
                                await updateMemberRole(m.id, newRole);
                                toast.success(newRole === 'admin' ? 'Promovido a administrador!' : 'Rebaixado a membro');
                              }}
                            >
                              <Shield className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {m.role === 'admin' ? 'Remover admin' : 'Promover a administrador'}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveMember(m.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {isAdminOrOwner && nonMembers.length > 0 && (
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
            {isAdminOrOwner && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Limiar de Sobrecarga (cards ativos)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    defaultValue={board.overload_threshold || 5}
                    className="w-24"
                    onBlur={async (e) => {
                      const val = parseInt(e.target.value);
                      if (val >= 1 && val <= 50) {
                        await onUpdateBoard(board.id, { overload_threshold: val } as any);
                        toast.success(`Limiar de sobrecarga: ${val} cards`);
                      }
                    }}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        const val = parseInt((e.target as HTMLInputElement).value);
                        if (val >= 1 && val <= 50) {
                          await onUpdateBoard(board.id, { overload_threshold: val } as any);
                          toast.success(`Limiar de sobrecarga: ${val} cards`);
                        }
                      }
                    }}
                  />
                  <span className="text-sm text-muted-foreground">cards por membro</span>
                </div>
                <p className="text-xs text-muted-foreground">Quando um membro tiver este número de cards ativos, será considerado sobrecarregado</p>
              </div>
            )}
            <div>
              <Label className="mb-2 block">Estilo de Fundo</Label>
              <div className="flex gap-2 mb-3">
                {BACKGROUND_GROUPS.map(g => (
                  <Button key={g.id} variant={bgCategory === g.id ? 'default' : 'outline'} size="sm" onClick={() => setBgCategory(g.id)}>
                    {g.name}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {BACKGROUND_GROUPS.find(g => g.id === bgCategory)?.items.map(bg => (
                  <button
                    key={bg.id}
                    onClick={() => handleChangeBg(bg.id)}
                    className={cn(
                      'h-16 rounded-lg border-2 transition-all overflow-hidden',
                      bg.preview || '',
                      board.background_image === bg.id ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'
                    )}
                    style={bg.id.startsWith('http') ? { backgroundImage: `url(${bg.id})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
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
                <button
                  onClick={() => autoCoverInputRef.current?.click()}
                  className={cn(
                    'w-10 h-6 rounded border-2 border-dashed flex items-center justify-center transition-all',
                    autoCover.startsWith('http') ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'
                  )}
                  title="Enviar imagem"
                >
                  <Upload className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
              <input
                ref={autoCoverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAutoCoverUpload}
              />
              {autoCover.startsWith('http') && (
                <div className="mt-2 rounded-lg overflow-hidden h-16">
                  <img src={autoCover} alt="Auto-capa preview" className="w-full h-full object-cover" />
                </div>
              )}
              <p className="text-xs text-muted-foreground">Novos cards nesta coluna terão esta capa automaticamente</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Coluna de Conclusão</Label>
                  <p className="text-xs text-muted-foreground">Marca tarefas como concluídas e registra atrasos</p>
                </div>
                <button
                  onClick={() => setAutoConclusion(!autoConclusion)}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    autoConclusion ? 'bg-primary' : 'bg-muted'
                  )}
                >
                  <span className={cn(
                    'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                    autoConclusion ? 'translate-x-6' : 'translate-x-1'
                  )} />
                </button>
              </div>
            </div>
            {/* Auto-subtasks section */}
            {showAutomation && (
              <AutoSubtasksConfig columnId={showAutomation.id} />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutomation(null)}>Cancelar</Button>
            <Button onClick={handleSaveAutomation}>Salvar Automação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Card Duplication Dialog */}
      <Dialog open={!!showDuplication} onOpenChange={(o) => { if (!o) setShowDuplication(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-primary" />
              Auto-duplicar Card
            </DialogTitle>
            <DialogDescription>
              Duplique automaticamente o card &quot;{showDuplication?.title}&quot; com todos os dados (exceto título com prefixo [Cópia])
            </DialogDescription>
          </DialogHeader>
          {showDuplication && (() => {
            const existing = getTaskDuplication(showDuplication.id);
            const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
            return existing ? (
              <div className="space-y-3 py-2">
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Duplicação ativa</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Frequência: <span className="font-medium">{existing.frequency === 'daily' ? 'Diário' : existing.frequency === 'weekly' ? 'Semanal' : 'Mensal'}</span>
                  </p>
                  {existing.frequency === 'daily' && (existing as any).weekdays && (
                    <p className="text-xs text-muted-foreground">
                      Dias: <span className="font-medium">{((existing as any).weekdays as number[]).map(d => WEEKDAY_NAMES[d]).join(', ')}</span>
                    </p>
                  )}
                  {existing.frequency === 'monthly' && (existing as any).month_day && (
                    <p className="text-xs text-muted-foreground">
                      Dia do mês: <span className="font-medium">{(existing as any).month_day}</span>
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Coluna destino: <span className="font-medium">{columns.find(c => c.id === existing.target_column_id)?.title || 'Desconhecida'}</span>
                  </p>
                  {existing.last_duplicated_at && (
                    <p className="text-xs text-muted-foreground">
                      Última duplicação: {new Date(existing.last_duplicated_at).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={async () => {
                    await deleteDuplication(existing.id);
                    toast.success('Auto-duplicação removida');
                    setShowDuplication(null);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Remover Auto-duplicação
                </Button>
              </div>
            ) : (
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Coluna destino</Label>
                  <Select value={dupTargetColumn} onValueChange={setDupTargetColumn}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {columns.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                            {c.title}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Frequência</Label>
                  <Select value={dupFrequency} onValueChange={setDupFrequency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diariamente</SelectItem>
                      <SelectItem value="weekly">Semanalmente</SelectItem>
                      <SelectItem value="monthly">Mensalmente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Weekday selector for daily */}
                {dupFrequency === 'daily' && (
                  <div className="space-y-2">
                    <Label>Dias da semana</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAY_NAMES.map((name, idx) => (
                        <button
                          key={idx}
                          onClick={() => setDupWeekdays(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx].sort())}
                          className={cn(
                            'w-10 h-8 rounded-lg text-xs font-medium border transition-all',
                            dupWeekdays.includes(idx) 
                              ? 'bg-primary text-primary-foreground border-primary' 
                              : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                          )}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground">Selecione os dias em que o card será duplicado</p>
                  </div>
                )}
                {/* Month day selector for monthly */}
                {dupFrequency === 'monthly' && (
                  <div className="space-y-2">
                    <Label>Dia do mês</Label>
                    <Select value={dupMonthDay.toString()} onValueChange={v => setDupMonthDay(parseInt(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                          <SelectItem key={d} value={d.toString()}>Dia {d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">O card será duplicado neste dia de cada mês</p>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowDuplication(null)}>Cancelar</Button>
                  <Button onClick={async () => {
                    if (!dupTargetColumn) { toast.error('Selecione a coluna'); return; }
                    if (dupFrequency === 'daily' && dupWeekdays.length === 0) { toast.error('Selecione ao menos um dia'); return; }
                    const { error } = await createDuplication(
                      showDuplication.id, dupTargetColumn, dupFrequency,
                      dupFrequency === 'daily' ? dupWeekdays : undefined,
                      dupFrequency === 'monthly' ? dupMonthDay : undefined
                    );
                    if (error) { toast.error('Erro ao criar auto-duplicação'); return; }
                    toast.success('Auto-duplicação configurada!');
                    setShowDuplication(null);
                  }}>
                    Ativar Auto-duplicação
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Archive Sidebar */}
      <Sheet open={showArchive} onOpenChange={setShowArchive}>
        <SheetContent side="right" className="w-[320px] sm:w-[360px] p-0 flex flex-col">
          <SheetHeader className="p-4 border-b border-border">
            <SheetTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-primary" /> Arquivados
            </SheetTitle>
          </SheetHeader>
          {archivedTasks.length > 0 && (
            <div className="px-4 pt-3">
              <Button
                variant="destructive"
                size="sm"
                className="w-full gap-2"
                onClick={async () => {
                  if (!confirm(`Excluir permanentemente ${archivedTasks.length} card(s) arquivado(s)?`)) return;
                  for (const task of archivedTasks) {
                    await deleteTask(task.id);
                  }
                  await refetchTasks();
                  toast.success('Todos os cards arquivados foram excluídos');
                }}
              >
                <Trash2 className="h-4 w-4" /> Excluir Todos ({archivedTasks.length})
              </Button>
            </div>
          )}
          <ScrollArea className="flex-1 px-4 py-3">
            {archivedTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum card arquivado</p>
            ) : (
              <div className="space-y-2">
                {archivedTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">#{task.task_number} {task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {columns.find(c => c.id === task.status)?.title || 'Sem coluna'}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => handleUnarchiveTask(task.id)} title="Restaurar">
                      <ArchiveRestore className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 text-destructive" onClick={() => handleDeleteTask(task.id)} title="Excluir permanentemente">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Report Dialog */}
      <ReportDialog open={showReport} onOpenChange={setShowReport} tasks={tasks} columns={columns} boardName={board.name} />

      {/* Automation Rules Panel */}
      <AutomationRulesPanel
        open={showAutomationRules}
        onOpenChange={setShowAutomationRules}
        boardId={board.id}
        taskId={automationTaskId}
        columns={columns}
      />

      {/* Operation Mode Panel */}
      <OperationModePanel
        open={showOperationMode}
        onOpenChange={setShowOperationMode}
        tasks={tasks}
        columns={columns}
        members={members}
        onUpdateTask={updateTask}
        onMoveTask={moveTask}
        onRefetch={refetchTasks}
      />

      {/* Filter Panel */}
      <TaskFilterPanel
        open={showFilter}
        onOpenChange={setShowFilter}
        filter={taskFilter}
        onFilterChange={setTaskFilter}
        members={members}
        labels={labels}
        currentProfileId={profile?.id}
      />

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" /> Compartilhar Quadro
            </DialogTitle>
            <DialogDescription>Gere um link para convidar pessoas ao quadro</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {shareLink ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border">
                  <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <p className="text-xs text-foreground truncate flex-1 font-mono">{shareLink}</p>
                </div>
                <Button className="w-full" onClick={() => { navigator.clipboard.writeText(shareLink); toast.success('Link copiado!'); }}>
                  <Copy className="h-4 w-4 mr-2" /> Copiar Link
                </Button>
              </div>
            ) : (
              <Button className="w-full" onClick={generateShareLink}>
                <Link2 className="h-4 w-4 mr-2" /> Gerar Link de Convite
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Pessoas que acessarem o link poderão solicitar participação. Você precisará aprovar cada solicitação.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join Requests Dialog */}
      <Dialog open={showJoinRequests} onOpenChange={setShowJoinRequests}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> Solicitações de Participação
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            {joinRequests.length === 0 ? (
              <div className="py-8 text-center">
                <UserPlus className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {joinRequests.map(req => (
                  <div key={req.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={req.profile?.avatar_url || ''} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(req.profile?.display_name || req.profile?.name || '?')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{req.profile?.display_name || req.profile?.name}</p>
                      <p className="text-xs text-muted-foreground">{req.profile?.email}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => handleJoinRequest(req.id, true)}>
                        Aprovar
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleJoinRequest(req.id, false)}>
                        Recusar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Distribution Dialog */}
      <Dialog open={showDistribution} onOpenChange={setShowDistribution}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shuffle className="h-5 w-5 text-secondary" /> Auto-distribuição de Tarefas
            </DialogTitle>
            <DialogDescription>Recomendações de redistribuição baseadas na carga de trabalho</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            {(() => {
              const recs = getDistributionRecommendations();
              return recs.length === 0 ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">As tarefas estão bem distribuídas!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recs.map((rec, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{rec.taskTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {rec.fromName} → {rec.toName}
                        </p>
                      </div>
                      <Button size="sm" className="h-7 text-xs" onClick={async () => {
                        await updateTask(rec.taskId, { assigned_to: rec.toProfileId });
                        toast.success(`Tarefa reatribuída para ${rec.toName}`);
                        setShowDistribution(false);
                      }}>
                        Aprovar
                      </Button>
                    </div>
                  ))}
                </div>
              );
            })()}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
