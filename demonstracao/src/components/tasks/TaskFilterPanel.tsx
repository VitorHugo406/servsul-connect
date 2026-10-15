import { useState } from 'react';
import { Filter, X, Search, Calendar, Tag, Users, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TaskBoardColumn, TaskBoardMember } from '@/hooks/useTaskBoards';
import { BoardTask } from '@/hooks/useBoardTasks';
import { TaskLabel } from '@/hooks/useTaskLabels';
import { getInitials } from './taskConstants';
import { cn } from '@/lib/utils';

export interface TaskFilter {
  keyword: string;
  members: string[]; // profile_ids
  noMembers: boolean;
  myCards: boolean;
  completed: boolean;
  notCompleted: boolean;
  noDates: boolean;
  overdue: boolean;
  dueSoon: boolean; // within 1 day
  dueWeek: boolean;
  dueMonth: boolean;
  labels: string[]; // label_ids
  noLabels: boolean;
}

export const emptyFilter: TaskFilter = {
  keyword: '',
  members: [],
  noMembers: false,
  myCards: false,
  completed: false,
  notCompleted: false,
  noDates: false,
  overdue: false,
  dueSoon: false,
  dueWeek: false,
  dueMonth: false,
  labels: [],
  noLabels: false,
};

export function isFilterActive(f: TaskFilter): boolean {
  return !!(
    f.keyword || f.members.length || f.noMembers || f.myCards ||
    f.completed || f.notCompleted || f.noDates || f.overdue ||
    f.dueSoon || f.dueWeek || f.dueMonth || f.labels.length || f.noLabels
  );
}

export function applyFilter(
  tasks: BoardTask[],
  filter: TaskFilter,
  currentProfileId: string | undefined,
  conclusionColumnIds: string[],
  getTaskLabels: (taskId: string) => TaskLabel[],
): BoardTask[] {
  if (!isFilterActive(filter)) return tasks;

  return tasks.filter(task => {
    // Keyword
    if (filter.keyword) {
      const q = filter.keyword.toLowerCase();
      if (!task.title.toLowerCase().includes(q) && !task.description?.toLowerCase().includes(q) && !`#${task.task_number}`.includes(q)) {
        return false;
      }
    }

    // Members
    if (filter.noMembers && task.assigned_to) return false;
    if (filter.myCards && task.assigned_to !== currentProfileId) return false;
    if (filter.members.length > 0 && !filter.members.includes(task.assigned_to || '')) return false;

    // Status
    const isCompleted = conclusionColumnIds.includes(task.status) || !!task.completed_at;
    if (filter.completed && !isCompleted) return false;
    if (filter.notCompleted && isCompleted) return false;

    // Dates
    if (filter.noDates && task.due_date) return false;
    if (filter.overdue || filter.dueSoon || filter.dueWeek || filter.dueMonth) {
      if (!task.due_date) return false;
      const now = new Date();
      const due = new Date(task.due_date);
      const diffMs = due.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      let match = false;
      if (filter.overdue && diffDays < 0) match = true;
      if (filter.dueSoon && diffDays >= 0 && diffDays <= 1) match = true;
      if (filter.dueWeek && diffDays >= 0 && diffDays <= 7) match = true;
      if (filter.dueMonth && diffDays >= 0 && diffDays <= 30) match = true;
      if (!match) return false;
    }

    // Labels
    if (filter.noLabels) {
      const tl = getTaskLabels(task.id);
      if (tl.length > 0) return false;
    }
    if (filter.labels.length > 0) {
      const tl = getTaskLabels(task.id);
      if (!filter.labels.some(lid => tl.some(l => l.id === lid))) return false;
    }

    return true;
  });
}

export function TaskFilterPanel({ open, onOpenChange, filter, onFilterChange, members, labels, currentProfileId }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  filter: TaskFilter;
  onFilterChange: (f: TaskFilter) => void;
  members: TaskBoardMember[];
  labels: TaskLabel[];
  currentProfileId?: string;
}) {
  const update = (partial: Partial<TaskFilter>) => onFilterChange({ ...filter, ...partial });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[320px] sm:w-[340px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" /> Filtro
            </SheetTitle>
            {isFilterActive(filter) && (
              <Button variant="ghost" size="sm" onClick={() => onFilterChange(emptyFilter)} className="text-xs">
                Limpar
              </Button>
            )}
          </div>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-5">
            {/* Keyword */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Palavra-chave</label>
              <Input
                placeholder="Insira uma palavra-chave..."
                value={filter.keyword}
                onChange={e => update({ keyword: e.target.value })}
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground">Pesquise cartões, membros, etiquetas e muito mais.</p>
            </div>

            {/* Members */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Membros</label>
              <label className="flex items-center gap-2 cursor-pointer py-1">
                <Checkbox checked={filter.noMembers} onCheckedChange={c => update({ noMembers: !!c })} />
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Sem membros</span>
              </label>
              {currentProfileId && (
                <label className="flex items-center gap-2 cursor-pointer py-1">
                  <Checkbox checked={filter.myCards} onCheckedChange={c => update({ myCards: !!c })} />
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">EU</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">Cartões atribuídos a mim</span>
                </label>
              )}
            </div>

            {/* Card status */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Card status</label>
              <label className="flex items-center gap-2 cursor-pointer py-1">
                <Checkbox checked={filter.completed} onCheckedChange={c => update({ completed: !!c })} />
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">Marcado como concluído</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer py-1">
                <Checkbox checked={filter.notCompleted} onCheckedChange={c => update({ notCompleted: !!c })} />
                <span className="text-sm">Não marcado como concluído</span>
              </label>
            </div>

            {/* Due dates */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data de entrega</label>
              <label className="flex items-center gap-2 cursor-pointer py-1">
                <Checkbox checked={filter.noDates} onCheckedChange={c => update({ noDates: !!c })} />
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Sem datas</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer py-1">
                <Checkbox checked={filter.overdue} onCheckedChange={c => update({ overdue: !!c })} />
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm">Em Atraso</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer py-1">
                <Checkbox checked={filter.dueSoon} onCheckedChange={c => update({ dueSoon: !!c })} />
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">A ser entregue em um dia</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer py-1">
                <Checkbox checked={filter.dueWeek} onCheckedChange={c => update({ dueWeek: !!c })} />
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-sm">A ser entregue em uma semana</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer py-1">
                <Checkbox checked={filter.dueMonth} onCheckedChange={c => update({ dueMonth: !!c })} />
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">A ser entregue em um mês</span>
              </label>
            </div>

            {/* Labels */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Etiquetas</label>
              <label className="flex items-center gap-2 cursor-pointer py-1">
                <Checkbox checked={filter.noLabels} onCheckedChange={c => update({ noLabels: !!c })} />
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Sem etiquetas</span>
              </label>
              {labels.map(l => (
                <label key={l.id} className="flex items-center gap-2 cursor-pointer py-1">
                  <Checkbox
                    checked={filter.labels.includes(l.id)}
                    onCheckedChange={c => {
                      update({
                        labels: c
                          ? [...filter.labels, l.id]
                          : filter.labels.filter(id => id !== l.id)
                      });
                    }}
                  />
                  <div className="w-full h-6 rounded" style={{ backgroundColor: l.color }} />
                </label>
              ))}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
