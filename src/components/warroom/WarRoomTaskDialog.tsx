import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { EmergencyTaskInput } from '@/hooks/useWarRooms';

interface BoardOption {
  id: string;
  name: string;
}

interface ColumnOption {
  id: string;
  title: string;
  position: number;
}

interface WarRoomTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (task: EmergencyTaskInput) => Promise<void> | void;
  title?: string;
  confirmLabel?: string;
}

export function WarRoomTaskDialog({
  open,
  onOpenChange,
  onSubmit,
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

  useEffect(() => {
    if (!open) return;

    const fetchBoards = async () => {
      setLoadingBoards(true);
      const { data, error } = await supabase.from('task_boards').select('id, name').order('name');
      if (error) {
        toast({ title: 'Erro ao carregar painéis', description: error.message, variant: 'destructive' });
      } else {
        setBoards((data || []) as BoardOption[]);
      }
      setLoadingBoards(false);
    };

    fetchBoards();
  }, [open, toast]);

  useEffect(() => {
    if (!boardId) {
      setColumns([]);
      setColumnId('');
      return;
    }

    const fetchColumns = async () => {
      setLoadingColumns(true);
      const { data, error } = await supabase
        .from('task_board_columns')
        .select('id, title, position')
        .eq('board_id', boardId)
        .order('position', { ascending: true });

      if (error) {
        toast({ title: 'Erro ao carregar colunas', description: error.message, variant: 'destructive' });
      } else {
        setColumns((data || []) as ColumnOption[]);
      }
      setLoadingColumns(false);
    };

    fetchColumns();
  }, [boardId, toast]);

  const canSubmit = useMemo(() => {
    return Boolean(boardId && columnId && taskTitle.trim());
  }, [boardId, columnId, taskTitle]);

  const reset = () => {
    setBoardId('');
    setColumnId('');
    setTaskTitle('');
    setDescription('');
    setPriority('high');
    setDueDate('');
    setColumns([]);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);

    try {
      await onSubmit({
        board_id: boardId,
        column_id: columnId,
        title: taskTitle.trim(),
        description: description.trim() || undefined,
        priority,
        due_date: dueDate || undefined,
      });
      onOpenChange(false);
      reset();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Painel</label>
            <Select value={boardId} onValueChange={setBoardId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={loadingBoards ? 'Carregando painéis...' : 'Selecione o painel'} />
              </SelectTrigger>
              <SelectContent>
                {boards.map(board => (
                  <SelectItem key={board.id} value={board.id}>
                    {board.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!loadingBoards && boards.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">Você não tem acesso a painéis para criar card.</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">Coluna</label>
            <Select value={columnId} onValueChange={setColumnId} disabled={!boardId || loadingColumns}>
              <SelectTrigger className="mt-1">
                <SelectValue
                  placeholder={
                    !boardId
                      ? 'Selecione o painel primeiro'
                      : loadingColumns
                        ? 'Carregando colunas...'
                        : 'Selecione a coluna'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {columns.map(column => (
                  <SelectItem key={column.id} value={column.id}>
                    {column.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Título do card</label>
            <Input
              className="mt-1"
              value={taskTitle}
              onChange={e => setTaskTitle(e.target.value)}
              placeholder="Ex: Mitigar falha no banco principal"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Descrição</label>
            <Textarea
              className="mt-1"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Detalhe a ação emergencial"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Prioridade</label>
              <Select value={priority} onValueChange={(value: 'low' | 'medium' | 'high' | 'urgent') => setPriority(value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
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
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || saving || boards.length === 0}>
            {saving ? 'Salvando...' : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
