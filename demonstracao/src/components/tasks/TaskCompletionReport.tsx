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

    // Build HTML
    let html = `<html><head><meta charset="utf-8"><title>Relatório - #${task.task_number} ${task.title}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; background: #fff; color: #1a1a1a; font-size: 13px; line-height: 1.6; }
      .header { border-bottom: 3px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px; }
      .header h1 { font-size: 22px; color: #1e293b; margin-bottom: 4px; }
      .header .subtitle { color: #64748b; font-size: 12px; }
      .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
      .badge-success { background: #dcfce7; color: #166534; }
      .badge-danger { background: #fee2e2; color: #991b1b; }
      .badge-info { background: #dbeafe; color: #1e40af; }
      .section { margin-bottom: 20px; }
      .section-title { font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .info-item { background: #f8fafc; padding: 10px 14px; border-radius: 8px; }
      .info-item .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 2px; }
      .info-item .value { font-size: 13px; font-weight: 600; color: #1e293b; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th { background: #1e293b; color: white; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
      td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
      tr:nth-child(even) { background: #f8fafc; }
      .timeline-item { display: flex; gap: 10px; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
      .timeline-item .time { color: #64748b; font-size: 11px; min-width: 100px; }
      .timeline-item .desc { flex: 1; }
      .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 10px; text-align: center; }
      .subtask { display: flex; gap: 6px; align-items: center; padding: 3px 0; }
      .subtask .check { color: #22c55e; }
      .subtask .uncheck { color: #94a3b8; }
      @media print { body { padding: 20px; } }
    </style></head><body>`;

    // Header
    html += `<div class="header">
      <h1>📋 #${task.task_number} - ${task.title}</h1>
      <div class="subtitle">${boardName ? `Quadro: ${boardName} • ` : ''}Relatório gerado em ${new Date().toLocaleString('pt-BR')}</div>
    </div>`;

    // Status banner
    html += `<div style="margin-bottom:20px;">
      <span class="badge ${completedAt ? (isLate ? 'badge-danger' : 'badge-success') : 'badge-info'}">${statusText}</span>
    </div>`;

    // Info grid
    html += `<div class="section"><div class="section-title">Informações Gerais</div><div class="info-grid">`;
    html += `<div class="info-item"><div class="label">Criado em</div><div class="value">${createdAt.toLocaleString('pt-BR')}</div></div>`;
    if (completedAt) html += `<div class="info-item"><div class="label">Concluído em</div><div class="value">${completedAt.toLocaleString('pt-BR')}</div></div>`;
    if (dueDate) html += `<div class="info-item"><div class="label">Prazo</div><div class="value">${dueDate.toLocaleDateString('pt-BR')}</div></div>`;
    html += `<div class="info-item"><div class="label">Prioridade</div><div class="value">${task.priority === 'urgent' ? 'Urgente' : task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}</div></div>`;
    if (task.assignee) html += `<div class="info-item"><div class="label">Responsável</div><div class="value">${task.assignee.display_name || task.assignee.name}</div></div>`;
    if (completedAt) {
      const totalTime = formatDuration(completedAt.getTime() - createdAt.getTime());
      html += `<div class="info-item"><div class="label">Tempo Total</div><div class="value">${totalTime}</div></div>`;
    }
    html += `</div></div>`;

    // Description
    if (task.description) {
      html += `<div class="section"><div class="section-title">Descrição</div><p style="white-space:pre-wrap;">${task.description}</p></div>`;
    }

    // Column timeline
    if (columnDurations.length > 0) {
      html += `<div class="section"><div class="section-title">Tempo por Coluna</div>`;
      html += `<table><thead><tr><th>Coluna</th><th>Entrada</th><th>Permanência</th></tr></thead><tbody>`;
      columnDurations.forEach(cd => {
        html += `<tr><td><strong>${cd.column}</strong></td><td>${cd.enteredAt}</td><td>${cd.duration}</td></tr>`;
      });
      html += `</tbody></table></div>`;
    }

    // Subtasks
    if (subtasks && subtasks.length > 0) {
      const done = subtasks.filter(s => s.is_completed).length;
      html += `<div class="section"><div class="section-title">Checklist (${done}/${subtasks.length})</div>`;
      subtasks.forEach(s => {
        html += `<div class="subtask"><span class="${s.is_completed ? 'check' : 'uncheck'}">${s.is_completed ? '✅' : '⬜'}</span><span>${s.title}</span></div>`;
      });
      html += `</div>`;
    }

    // Activity log
    if (sortedActivities.length > 0) {
      html += `<div class="section"><div class="section-title">Histórico de Atividades</div>`;
      sortedActivities.forEach(a => {
        html += `<div class="timeline-item">
          <div class="time">${new Date(a.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
          <div class="desc"><strong>${a.user_name}</strong> ${a.description}</div>
        </div>`;
      });
      html += `</div>`;
    }

    // Comments
    if (comments && comments.length > 0) {
      html += `<div class="section"><div class="section-title">Comentários (${comments.length})</div>`;
      comments.forEach(c => {
        html += `<div class="timeline-item">
          <div class="time">${new Date(c.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
          <div class="desc"><strong>${c.author?.display_name || c.author?.name || 'Usuário'}</strong>: ${c.content}</div>
        </div>`;
      });
      html += `</div>`;
    }

    html += `<div class="footer">Relatório gerado automaticamente pelo Nuvexa • ${new Date().toLocaleDateString('pt-BR')}</div></body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
    toast.success('Relatório PDF gerado!');
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
