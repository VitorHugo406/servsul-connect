import { openTaskReport } from '@/lib/designReports';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { FileText, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BoardTask } from '@/hooks/useBoardTasks';
import { TaskActivity } from '@/hooks/useTaskActivities';
import { toast } from 'sonner';

interface TaskCompletionReportProps {
  task: BoardTask;
  activities: TaskActivity[];
  columns?: { id: string; title: string; color: string }[];
  subtasks?: { id: string; title: string; is_completed: boolean; group_id: string | null }[];
  comments?: { id: string; content: string; created_at: string; author?: any }[];
  boardName?: string;
}

export function TaskCompletionReport({ task, activities, columns, subtasks, comments, boardName }: TaskCompletionReportProps) {
  const [generating, setGenerating] = useState(false);
  const { profile } = useAuth();

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const colByName = new Map((columns || []).map(c => [c.title, c]));
      const createdAt = new Date(task.created_at);
      const completedAt = task.completed_at ? new Date(task.completed_at) : null;
      const dueDate = task.due_date ? new Date(task.due_date) : null;
      const acts = [...activities].sort((x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime());
      const currentName = (columns || []).find(c => c.id === task.status)?.title || task.status;

      // column timeline from the create/move activities
      const createAct = acts.find(a => a.action_type === 'create');
      const firstMove = acts.find(a => a.action_type === 'move');
      let col = createAct?.description.match(/coluna "(.+?)"/)?.[1] || firstMove?.description.match(/de "(.+?)" para/)?.[1] || currentName;
      let enter = createAct ? new Date(createAct.created_at) : createdAt;
      const cols: { name: string; color: string; enter: Date; exit: Date | null }[] = [];
      for (const a of acts) {
        const m = a.action_type === 'move' ? a.description.match(/de "(.+?)" para "(.+?)"/) : null;
        if (!m) continue;
        const at = new Date(a.created_at);
        cols.push({ name: m[1], color: colByName.get(m[1])?.color || '#6B7482', enter, exit: at });
        col = m[2]; enter = at;
      }
      cols.push({ name: col, color: colByName.get(col)?.color || '#6B7482', enter, exit: null });

      const doneCol = completedAt ? currentName : null;
      const lastIntoDone = doneCol ? [...acts].reverse().find(a => a.action_type === 'move' && a.description.endsWith(`para "${doneCol}"`)) : null;
      let board = boardName || null;
      if (!board && (task as any).board_id) {
        const { data } = await (supabase as any).from('task_boards').select('name').eq('id', (task as any).board_id).maybeSingle();
        board = data?.name || null;
      }
      const ok = openTaskReport({
        number: task.task_number, title: task.title, board,
        createdAt, completedAt, dueDate, late: !!task.completed_late, delayDays: task.delay_days || 0,
        completedBy: lastIntoDone?.user_name || null,
        priority: task.priority,
        owner: task.assignee ? { name: task.assignee.display_name || task.assignee.name, avatar: task.assignee.avatar_url } : null,
        statusName: currentName,
        checklist: { done: (subtasks || []).filter(x => x.is_completed).length, total: (subtasks || []).length },
        comments: comments?.length || 0,
        columns: cols,
        activities: acts.map(a => {
          const who = a.user_name || 'Usuário';
          const text = a.description.startsWith(who + ' ') ? a.description.slice(who.length + 1) : a.description;
          return { at: new Date(a.created_at), who, text, done: !!doneCol && a.action_type === 'move' && a.description.endsWith(`para "${doneCol}"`) };
        }),
        generatedBy: profile?.display_name || profile?.name || 'ewvon',
      });
      if (!ok) toast.error('Permita pop-ups para gerar o relatório');
      else toast.success('Relatório aberto para salvar em PDF');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button variant="outline" className="gap-2 rounded-md" onClick={() => void generatePDF()} disabled={generating}>
      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Relatório PDF
    </Button>
  );
}
