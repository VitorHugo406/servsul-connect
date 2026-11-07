import { openReport, priorityLabel } from '@/lib/reports';
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

  const generatePDF = () => {
    setGenerating(true);

    const colMap = new Map((columns || []).map(c => [c.id, c.title]));
    const createdAt = new Date(task.created_at);
    const completedAt = task.completed_at ? new Date(task.completed_at) : null;
    const dueDate = task.due_date ? new Date(task.due_date) : null;

    // Calculate time in each column from activities
    const columnDurations: { column: string; duration: string; enteredAt: string }[] = [];
    
    // Build column timeline from activities
    const sortedActivities = [...activities].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    // Find initial column from create activity or fallback to current status
    let currentColumn = '';
    let lastMoveTime = createdAt;
    
    // First pass: find the create activity to get initial column
    const createAct = sortedActivities.find(a => a.action_type === 'create');
    if (createAct) {
      const match = createAct.description.match(/coluna "(.+?)"/);
      if (match) currentColumn = match[1];
      lastMoveTime = new Date(createAct.created_at);
    }
    
    // If no create activity found, try to determine from first move or use current column name
    if (!currentColumn) {
      const firstMove = sortedActivities.find(a => a.action_type === 'move');
      if (firstMove) {
        const moveMatch = firstMove.description.match(/de "(.+?)" para "(.+?)"/);
        if (moveMatch) currentColumn = moveMatch[1];
      }
      if (!currentColumn) {
        currentColumn = colMap.get(task.status) || task.status;
      }
    }
    
    for (const act of sortedActivities) {
      if (act.action_type === 'move') {
        const moveMatch = act.description.match(/de "(.+?)" para "(.+?)"/);
        if (moveMatch) {
          const duration = formatDuration(new Date(act.created_at).getTime() - lastMoveTime.getTime());
          columnDurations.push({
            column: moveMatch[1],
            duration,
            enteredAt: lastMoveTime.toLocaleString('pt-BR'),
          });
          currentColumn = moveMatch[2];
          lastMoveTime = new Date(act.created_at);
        }
      }
    }
    // Add current/final column
    const endTime = completedAt || new Date();
    columnDurations.push({
      column: currentColumn,
      duration: formatDuration(endTime.getTime() - lastMoveTime.getTime()),
      enteredAt: lastMoveTime.toLocaleString('pt-BR'),
    });

    // Status
    const isLate = task.completed_late;
    const delayDays = task.delay_days || 0;
    const statusText = completedAt
      ? (isLate ? `Entregue com ${delayDays} dia(s) de atraso` : 'Entregue no prazo')
      : 'Em andamento';

    const durations = columnDurations;
    const done = (subtasks || []).filter(x => x.is_completed).length;
    const ok = openReport({
      eyebrow: 'Relatório de conclusão de tarefa',
      title: `#${task.task_number} · ${task.title}`,
      subtitle: boardName ? `Quadro ${boardName}` : undefined,
      fileName: `Tarefa ${task.task_number}`,
      blocks: [
        { type: 'badge', text: statusText, tone: completedAt ? (isLate ? 'bad' : 'good') : 'info' },
        { type: 'kpis', items: [
          { label: 'Tempo total', value: completedAt ? formatDuration(completedAt.getTime() - createdAt.getTime()) : formatDuration(Date.now() - createdAt.getTime()), hint: completedAt ? 'da criação à conclusão' : 'até agora' },
          { label: 'Checklist', value: subtasks?.length ? `${done}/${subtasks.length}` : '—' },
          { label: 'Comentários', value: comments?.length || 0 },
          { label: 'Atraso', value: completedAt && isLate ? `${delayDays} dia(s)` : '0', tone: completedAt && isLate ? 'bad' : 'good' },
        ] },
        { type: 'info', title: 'Informações gerais', items: [
          { label: 'Criada em', value: createdAt.toLocaleString('pt-BR') },
          { label: 'Concluída em', value: completedAt ? completedAt.toLocaleString('pt-BR') : null },
          { label: 'Prazo', value: dueDate ? dueDate.toLocaleDateString('pt-BR') : null },
          { label: 'Prioridade', value: priorityLabel(task.priority) },
          { label: 'Responsável', value: task.assignee ? (task.assignee.display_name || task.assignee.name) : null },
        ] },
        ...(task.description ? [{ type: 'text' as const, title: 'Descrição', body: task.description }] : []),
        ...(durations.length ? [{ type: 'table' as const, title: 'Tempo por coluna', headers: ['Coluna', 'Entrada', 'Permanência'], rows: durations.map(cd => [{ text: cd.column, strong: true }, cd.enteredAt, cd.duration]) }] : []),
        ...(subtasks?.length ? [{ type: 'checklist' as const, title: `Checklist (${done}/${subtasks.length})`, items: subtasks.map(x => ({ done: !!x.is_completed, text: x.title })) }] : []),
        ...(sortedActivities.length ? [{ type: 'timeline' as const, title: 'Histórico de atividades', items: sortedActivities.map(a => ({ time: new Date(a.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }), title: a.user_name, text: a.description })) }] : []),
        ...(comments?.length ? [{ type: 'timeline' as const, title: `Comentários (${comments.length})`, items: comments.map(c => ({ time: new Date(c.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }), title: c.author?.display_name || c.author?.name || 'Usuário', text: c.content })) }] : []),
      ],
    });
    if (!ok) toast.error('Permita pop-ups para gerar o relatório');
    else toast.success('Relatório aberto para salvar em PDF');
    setGenerating(false);
  };

  return (
    <Button variant="outline" className="gap-2 rounded-md" onClick={generatePDF} disabled={generating}>
      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Relatório PDF
    </Button>
  );
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    const remainHours = hours % 24;
    return `${days}d ${remainHours}h`;
  }
  if (hours > 0) {
    const remainMin = minutes % 60;
    return `${hours}h ${remainMin}min`;
  }
  return `${minutes}min`;
}
