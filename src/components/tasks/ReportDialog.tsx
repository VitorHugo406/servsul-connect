import { openReport } from '@/lib/reports';
import { useState } from 'react';
import { FileSpreadsheet, FileText, CheckSquare, Square, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { BoardTask } from '@/hooks/useBoardTasks';
import { PRIORITIES } from './taskConstants';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ReportField {
  key: string;
  label: string;
  icon: string;
  checked: boolean;
}

export function ReportDialog({ open, onOpenChange, tasks, columns, boardName }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tasks: BoardTask[];
  columns: any[];
  boardName: string;
}) {
  const [fields, setFields] = useState<ReportField[]>([
    { key: 'title', label: 'Título', icon: '📝', checked: true },
    { key: 'description', label: 'Descrição', icon: '📋', checked: true },
    { key: 'status', label: 'Status (Coluna)', icon: '📊', checked: true },
    { key: 'priority', label: 'Prioridade', icon: '🔥', checked: true },
    { key: 'assignee', label: 'Responsável', icon: '👤', checked: true },
    { key: 'dueDate', label: 'Data de Entrega', icon: '📅', checked: true },
  ]);

  const toggleField = (key: string) => {
    setFields(prev => prev.map(f => f.key === key ? { ...f, checked: !f.checked } : f));
  };

  const selectAll = () => setFields(prev => prev.map(f => ({ ...f, checked: true })));
  const deselectAll = () => setFields(prev => prev.map(f => ({ ...f, checked: false })));

  const isActive = (key: string) => fields.find(f => f.key === key)?.checked;
  const colMap = new Map(columns.map(c => [c.id, c.title]));

  const getTaskRow = (t: BoardTask) => {
    const row: string[] = [`#${t.task_number}`];
    if (isActive('title')) row.push(t.title);
    if (isActive('description')) row.push(t.description || '');
    if (isActive('status')) row.push(colMap.get(t.status) || t.status);
    if (isActive('priority')) row.push(PRIORITIES.find(p => p.id === t.priority)?.label || t.priority);
    if (isActive('assignee')) row.push(t.assignee?.display_name || t.assignee?.name || 'Sem responsável');
    if (isActive('dueDate')) row.push(t.due_date ? new Date(t.due_date).toLocaleDateString('pt-BR') : '');
    return row;
  };

  const getHeaders = () => {
    const headers = ['#'];
    if (isActive('title')) headers.push('Título');
    if (isActive('description')) headers.push('Descrição');
    if (isActive('status')) headers.push('Status');
    if (isActive('priority')) headers.push('Prioridade');
    if (isActive('assignee')) headers.push('Responsável');
    if (isActive('dueDate')) headers.push('Data de Entrega');
    return headers;
  };

  const generateCSV = () => {
    const headers = getHeaders();
    const rows = tasks.map(getTaskRow);
    const csvContent = [headers, ...rows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${boardName}_relatorio.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório Excel (CSV) baixado!');
  };

  const generatePDF = () => {
    const totalTasks = tasks.length;
    const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date()).length;
    const completed = tasks.filter(t => {
      const col = columns.find(c => c.id === t.status);
      return (col as { is_conclusion?: boolean } | undefined)?.is_conclusion || col?.title?.toLowerCase().includes('conclu');
    }).length;
    const ok = openReport({
      eyebrow: 'Relatório de tarefas',
      title: boardName,
      subtitle: 'Tarefas do quadro com os campos selecionados',
      fileName: `${boardName} - relatório`,
      landscape: getHeaders().length > 5,
      blocks: [
        { type: 'kpis', items: [
          { label: 'Tarefas', value: totalTasks },
          { label: 'Concluídas', value: completed, tone: 'good' },
          { label: 'Em aberto', value: totalTasks - completed, tone: 'info' },
          { label: 'Atrasadas', value: overdue, tone: overdue ? 'bad' : 'neutral' },
        ] },
        { type: 'bars', title: 'Tarefas por coluna', items: columns.map(c => ({ label: c.title, value: tasks.filter(t => t.status === c.id).length })) },
        { type: 'table', title: 'Lista de tarefas', headers: getHeaders(), rows: tasks.map(getTaskRow), empty: 'Nenhuma tarefa neste quadro.' },
      ],
    });
    if (ok) toast.success('Relatório aberto para salvar em PDF'); else toast.error('Permita pop-ups para gerar o relatório');
  };

  const activeCount = fields.filter(f => f.checked).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Gerar Relatório
          </DialogTitle>
          <DialogDescription>
            Selecione os campos para incluir no relatório de <strong>{boardName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 py-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground">{activeCount} de {fields.length} campos selecionados</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAll}>Todos</Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={deselectAll}>Nenhum</Button>
            </div>
          </div>

          {fields.map(f => (
            <button
              key={f.key}
              onClick={() => toggleField(f.key)}
              className={cn(
                'flex items-center gap-3 w-full p-3 rounded-lg transition-all text-left',
                f.checked
                  ? 'bg-primary/10 border border-primary/20'
                  : 'bg-muted/30 border border-transparent hover:bg-muted/50'
              )}
            >
              {f.checked
                ? <CheckSquare className="h-4 w-4 text-primary flex-shrink-0" />
                : <Square className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              }
              <span className="text-lg flex-shrink-0">{f.icon}</span>
              <span className={cn('text-sm font-medium', f.checked ? 'text-foreground' : 'text-muted-foreground')}>
                {f.label}
              </span>
            </button>
          ))}
        </div>

        <div className="text-xs text-muted-foreground text-center py-1">
          {tasks.length} tarefas serão incluídas no relatório
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={generateCSV}
            disabled={activeCount === 0}
            className="gap-2 flex-1"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            Excel (CSV)
          </Button>
          <Button
            onClick={generatePDF}
            disabled={activeCount === 0}
            className="gap-2 flex-1"
          >
            <FileText className="h-4 w-4" />
            PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
