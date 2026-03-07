import { useState } from 'react';
import { Plus, Trash2, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useColumnAutoSubtasks } from '@/hooks/useColumnAutoSubtasks';
import { toast } from 'sonner';

export function AutoSubtasksConfig({ columnId }: { columnId: string }) {
  const { autoSubtasks, addAutoSubtask, deleteAutoSubtask } = useColumnAutoSubtasks(columnId);
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [newItemTitle, setNewItemTitle] = useState('');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  // Group auto-subtasks by group_title
  const groups = new Map<string, typeof autoSubtasks>();
  autoSubtasks.forEach(s => {
    if (!groups.has(s.group_title)) groups.set(s.group_title, []);
    groups.get(s.group_title)!.push(s);
  });

  const handleAddGroup = () => {
    if (!newGroupTitle.trim()) return;
    setActiveGroup(newGroupTitle.trim());
    setNewGroupTitle('');
  };

  const handleAddItem = async () => {
    if (!newItemTitle.trim() || !activeGroup) return;
    const { error } = await addAutoSubtask(activeGroup, newItemTitle.trim());
    if (error) { toast.error('Erro ao adicionar'); return; }
    setNewItemTitle('');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-primary" />
        <Label>Auto-subtarefas (template)</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Cards que entrarem nesta coluna receberão automaticamente estas subtarefas organizadas em grupos.
      </p>

      {/* Existing groups */}
      {Array.from(groups.entries()).map(([groupTitle, items]) => (
        <div key={groupTitle} className="border border-border rounded-lg p-2.5 space-y-1.5">
          <h5 className="text-xs font-semibold text-foreground">{groupTitle}</h5>
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 rounded border border-border flex-shrink-0" />
              <span className="flex-1 text-muted-foreground">{item.title}</span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => deleteAutoSubtask(item.id)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
          {/* Add item to this group */}
          {activeGroup === groupTitle && (
            <div className="flex gap-1.5 pt-1">
              <Input
                value={newItemTitle}
                onChange={e => setNewItemTitle(e.target.value)}
                placeholder="Nome da subtarefa"
                className="h-7 text-xs"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleAddItem()}
              />
              <Button size="sm" className="h-7 text-xs" onClick={handleAddItem}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          )}
          {activeGroup !== groupTitle && (
            <Button variant="ghost" size="sm" className="text-xs w-full" onClick={() => setActiveGroup(groupTitle)}>
              + Adicionar item
            </Button>
          )}
        </div>
      ))}

      {/* Add new group */}
      <div className="flex gap-1.5">
        <Input
          value={newGroupTitle}
          onChange={e => setNewGroupTitle(e.target.value)}
          placeholder="Nome do grupo (ex: Benefícios)"
          className="h-7 text-xs"
          onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
        />
        <Button size="sm" className="h-7 text-xs gap-1" onClick={handleAddGroup} disabled={!newGroupTitle.trim()}>
          <Plus className="h-3 w-3" /> Grupo
        </Button>
      </div>
    </div>
  );
}
