import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Board {
  id: string;
  name: string;
}

interface TaskOption {
  id: string;
  task_number: number;
  title: string;
  description: string | null;
  priority: string;
  due_date: string | null;
  board_name: string;
  board_id: string;
  labels: { name: string; color: string }[];
}

interface CardMentionPickerProps {
  query: string;
  onSelect: (task: TaskOption) => void;
  onClose: () => void;
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente',
};
const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-500', medium: 'bg-blue-500', high: 'bg-orange-500', urgent: 'bg-red-500',
};

export function CardMentionPicker({ query, onSelect, onClose }: CardMentionPickerProps) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch boards
  useEffect(() => {
    const fetchBoards = async () => {
      const { data } = await supabase.from('task_boards').select('id, name').order('name');
      setBoards(data || []);
      setLoading(false);
    };
    fetchBoards();
  }, []);

  // Fetch tasks when board is selected
  useEffect(() => {
    if (!selectedBoardId) { setTasks([]); return; }
    const fetchTasks = async () => {
      setLoading(true);
      const board = boards.find(b => b.id === selectedBoardId);
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('id, task_number, title, description, priority, due_date')
        .eq('board_id', selectedBoardId)
        .order('task_number', { ascending: true });

      if (!tasksData) { setLoading(false); return; }

      // Fetch labels for all tasks
      const taskIds = tasksData.map(t => t.id);
      const { data: assignments } = taskIds.length > 0
        ? await supabase.from('task_label_assignments').select('task_id, label_id').in('task_id', taskIds)
        : { data: [] };

      const labelIds = [...new Set((assignments || []).map(a => a.label_id))];
      const { data: labelsData } = labelIds.length > 0
        ? await supabase.from('task_labels').select('id, name, color').in('id', labelIds)
        : { data: [] };

      const labelMap = new Map((labelsData || []).map(l => [l.id, l]));

      const enrichedTasks: TaskOption[] = tasksData.map(t => {
        const taskAssignments = (assignments || []).filter(a => a.task_id === t.id);
        const taskLabels = taskAssignments.map(a => labelMap.get(a.label_id)).filter(Boolean) as { name: string; color: string }[];
        return {
          ...t,
          board_name: board?.name || '',
          board_id: selectedBoardId,
          labels: taskLabels,
        };
      });

      // Filter by query (number after #)
      const filtered = query
        ? enrichedTasks.filter(t =>
            t.task_number.toString().includes(query) ||
            t.title.toLowerCase().includes(query.toLowerCase())
          )
        : enrichedTasks;

      setTasks(filtered);
      setLoading(false);
    };
    fetchTasks();
  }, [selectedBoardId, query, boards]);

  const formatDate = (d: string | null) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 z-50 bg-card border border-border rounded-xl shadow-lg overflow-hidden max-h-[300px] flex flex-col">
      {!selectedBoardId ? (
        <>
          <div className="px-3 py-2 border-b border-border">
            <span className="text-xs font-medium text-muted-foreground">Selecione o mural</span>
          </div>
          <ScrollArea className="max-h-[250px]">
            <div className="p-1">
              {loading ? (
                <div className="text-center py-4 text-sm text-muted-foreground">Carregando...</div>
              ) : boards.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">Nenhum mural encontrado</div>
              ) : (
                boards.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBoardId(b.id)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted text-sm font-medium transition-colors"
                  >
                    📋 {b.name}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </>
      ) : (
        <>
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <button onClick={() => setSelectedBoardId(null)} className="text-xs text-primary hover:underline">
              ← Voltar
            </button>
            <span className="text-xs font-medium text-muted-foreground">
              {boards.find(b => b.id === selectedBoardId)?.name}
            </span>
          </div>
          <ScrollArea className="max-h-[250px]">
            <div className="p-1">
              {loading ? (
                <div className="text-center py-4 text-sm text-muted-foreground">Carregando...</div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">Nenhum card encontrado</div>
              ) : (
                tasks.map(t => (
                  <button
                    key={t.id}
                    onClick={() => onSelect(t)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] flex-shrink-0">#{t.task_number}</Badge>
                      <span className="text-sm font-medium truncate flex-1">{t.title}</span>
                      <Badge className={cn('text-[9px] text-white', PRIORITY_COLORS[t.priority])}>
                        {PRIORITY_LABELS[t.priority]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {t.labels.map((l, i) => (
                        <span key={i} className="inline-block h-1.5 w-6 rounded-full" style={{ backgroundColor: l.color }} />
                      ))}
                      {t.due_date && (
                        <span className="text-[10px] text-muted-foreground ml-auto">📅 {formatDate(t.due_date)}</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}

export function formatCardMention(task: {
  task_number: number;
  title: string;
  description?: string | null;
  priority: string;
  due_date: string | null;
  board_name: string;
  labels: { name: string; color: string }[];
}): string {
  const priorityLabel = PRIORITY_LABELS[task.priority] || task.priority;
  const labelsStr = task.labels.length > 0 ? task.labels.map(l => l.name).join(', ') : '';
  const dueStr = task.due_date
    ? new Date(task.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  let msg = `📋 Card #${task.task_number} — ${task.title}`;
  if (task.description) msg += `\n📝 ${task.description}`;
  if (labelsStr) msg += `\n🏷️ ${labelsStr}`;
  msg += `\n⚡ Prioridade: ${priorityLabel}`;
  if (dueStr) msg += `\n📅 Prazo: ${dueStr}`;
  msg += `\n📌 Mural: ${task.board_name}`;

  return msg;
}
