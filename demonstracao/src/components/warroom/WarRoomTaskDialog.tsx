import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, FolderPlus, X, ListChecks } from 'lucide-react';
import type { EmergencyTaskInput } from '@/hooks/useWarRooms';

interface BoardOption { id: string; name: string; }
interface ColumnOption { id: string; title: string; position: number; }
interface SubtaskGroup { id: string; title: string; subtasks: string[]; }

interface WarRoomTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (task: EmergencyTaskInput) => Promise<void> | void;
  title?: string;
  confirmLabel?: string;
}

export function WarRoomTaskDialog({
  open, onOpenChange, onSubmit,
  title = 'Configurar Card Emergencial',
  confirmLabel = 'Salvar card',
}: WarRoomTaskDialogProps) {
  const { toast } = useToast();
  const [boards, setBoards] = useState<BoardOption[]>([]);
  const [columns, setColumns] = useState<ColumnOption[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [saving, setSaving] = useState(false);

  const [boardId, setBoardId] = useState('');
  const [columnId, setColumnId] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('high');
  const [dueDate, setDueDate] = useState('');

  // Subtask groups state
  const [subtaskGroups, setSubtaskGroups] = useState<SubtaskGroup[]>([]);
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [subtaskInputs, setSubtaskInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setLoadingBoards(true);
    supabase.from('task_boards').select('id, name').order('name').then(({ data, error }) => {
      if (error) toast({ title: 'Erro ao carregar painéis', description: error.message, variant: 'destructive' });
      else setBoards((data || []) as BoardOption[]);
      setLoadingBoards(false);
    });
  }, [open, toast]);

  useEffect(() => {
    if (!boardId) { setColumns([]); setColumnId(''); return; }
    setLoadingColumns(true);
    supabase.from('task_board_columns').select('id, title, position')
      .eq('board_id', boardId).order('position', { ascending: true })
      .then(({ data, error }) => {
        if (error) toast({ title: 'Erro ao carregar colunas', description: error.message, variant: 'destructive' });
        else setColumns((data || []) as ColumnOption[]);
        setLoadingColumns(false);
      });
  }, [boardId, toast]);

  const canSubmit = useMemo(() => Boolean(boardId && columnId && taskTitle.trim()), [boardId, columnId, taskTitle]);

  const reset = () => {
    setBoardId(''); setColumnId(''); setTaskTitle(''); setDescription('');
    setPriority('high'); setDueDate(''); setColumns([]);
    setSubtaskGroups([]); setNewGroupTitle(''); setSubtaskInputs({});
  };

  const addGroup = () => {
    if (!newGroupTitle.trim()) return;
    const id = `sg-${Date.now()}`;
    setSubtaskGroups(prev => [...prev, { id, title: newGroupTitle.trim(), subtasks: [] }]);
    setSubtaskInputs(prev => ({ ...prev, [id]: '' }));
    setNewGroupTitle('');
  };

  const removeGroup = (id: string) => {
    setSubtaskGroups(prev => prev.filter(g => g.id !== id));
    setSubtaskInputs(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const addSubtask = (groupId: string) => {
    const text = (subtaskInputs[groupId] || '').trim();
    if (!text) return;
    setSubtaskGroups(prev => prev.map(g => g.id === groupId ? { ...g, subtasks: [...g.subtasks, text] } : g));
    setSubtaskInputs(prev => ({ ...prev, [groupId]: '' }));
  };

  const removeSubtask = (groupId: string, idx: number) => {
    setSubtaskGroups(prev => prev.map(g => g.id === groupId ? { ...g, subtasks: g.subtasks.filter((_, i) => i !== idx) } : g));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await onSubmit({
        board_id: boardId, column_id: columnId,
        title: taskTitle.trim(),
        description: description.trim() || undefined,
        priority, due_date: dueDate || undefined,
        subtask_groups: subtaskGroups.length > 0
          ? subtaskGroups.map(g => ({ title: g.title, subtasks: g.subtasks }))
          : undefined,
      });
      onOpenChange(false);
      reset();
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-auto pr-1">
          <div>
            <label className="text-sm font-medium">Painel</label>
            <Select value={boardId} onValueChange={setBoardId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={loadingBoards ? 'Carregando painéis...' : 'Selecione o painel'} />
              </SelectTrigger>
              <SelectContent>
                {boards.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Coluna</label>
            <Select value={columnId} onValueChange={setColumnId} disabled={!boardId || loadingColumns}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={!boardId ? 'Selecione o painel primeiro' : loadingColumns ? 'Carregando...' : 'Selecione a coluna'} />
              </SelectTrigger>
              <SelectContent>
                {columns.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Título do card</label>
            <Input className="mt-1" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Ex: Mitigar falha no banco principal" />
          </div>

          <div>
            <label className="text-sm font-medium">Descrição</label>
            <Textarea className="mt-1" value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhe a ação emergencial" rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Prioridade</label>
              <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Prazo (opcional)</label>
              <Input className="mt-1" type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* Subtask Groups */}
          <div className="space-y-2 border rounded-lg p-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <ListChecks className="h-4 w-4" /> Subtarefas (opcional)
            </p>
            <div className="flex gap-2">
              <Input
                value={newGroupTitle}
                onChange={e => setNewGroupTitle(e.target.value)}
                placeholder="Nome do grupo de subtarefas..."
                onKeyDown={e => e.key === 'Enter' && addGroup()}
                className="h-8 text-sm"
              />
              <Button type="button" variant="outline" size="sm" onClick={addGroup} className="h-8 px-2">
                <FolderPlus className="h-4 w-4" />
              </Button>
            </div>

            {subtaskGroups.map(group => (
              <div key={group.id} className="border rounded-md p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{group.title}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeGroup(group.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                {group.subtasks.map((sub, idx) => (
                  <div key={idx} className="flex items-center gap-2 pl-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground flex-shrink-0" />
                    <span className="text-xs flex-1">{sub}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeSubtask(group.id, idx)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-1.5">
                  <Input
                    value={subtaskInputs[group.id] || ''}
                    onChange={e => setSubtaskInputs(prev => ({ ...prev, [group.id]: e.target.value }))}
                    placeholder="Nova subtarefa..."
                    onKeyDown={e => e.key === 'Enter' && addSubtask(group.id)}
                    className="h-7 text-xs"
                  />
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => addSubtask(group.id)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || saving || boards.length === 0}>
            {saving ? 'Salvando...' : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
