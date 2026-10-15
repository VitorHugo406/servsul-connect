import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckSquare, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useColumnAutoSubtasks, ColumnAutoSubtask } from '@/hooks/useColumnAutoSubtasks';
import { toast } from 'sonner';

interface LocalGroup {
  title: string;
  items: string[];
}

export function AutoSubtasksConfig({ columnId }: { columnId: string }) {
  const { autoSubtasks, addAutoSubtask, deleteAutoSubtask, refetch } = useColumnAutoSubtasks(columnId);
  
  // Local draft state - only saved on confirm
  const [localGroups, setLocalGroups] = useState<LocalGroup[]>([]);
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [newItemTexts, setNewItemTexts] = useState<Record<number, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize local state from DB
  useEffect(() => {
    const groups = new Map<string, string[]>();
    autoSubtasks.forEach(s => {
      if (!groups.has(s.group_title)) groups.set(s.group_title, []);
      groups.get(s.group_title)!.push(s.title);
    });
    setLocalGroups(Array.from(groups.entries()).map(([title, items]) => ({ title, items })));
    setIsDirty(false);
  }, [autoSubtasks]);

  const handleAddGroup = () => {
    const title = newGroupTitle.trim();
    if (!title) return;
    if (localGroups.some(g => g.title === title)) {
      toast.error('Grupo já existe');
      return;
    }
    setLocalGroups(prev => [...prev, { title, items: [] }]);
    setNewGroupTitle('');
    setIsDirty(true);
  };

  const handleRemoveGroup = (idx: number) => {
    setLocalGroups(prev => prev.filter((_, i) => i !== idx));
    setIsDirty(true);
  };

  const handleAddItems = (groupIdx: number) => {
    const text = (newItemTexts[groupIdx] || '').trim();
    if (!text) return;
    // Support pasting multiple lines
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setLocalGroups(prev => prev.map((g, i) => 
      i === groupIdx ? { ...g, items: [...g.items, ...lines] } : g
    ));
    setNewItemTexts(prev => ({ ...prev, [groupIdx]: '' }));
    setIsDirty(true);
  };

  const handleRemoveItem = (groupIdx: number, itemIdx: number) => {
    setLocalGroups(prev => prev.map((g, i) => 
      i === groupIdx ? { ...g, items: g.items.filter((_, j) => j !== itemIdx) } : g
    ));
    setIsDirty(true);
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      // Delete all existing auto-subtasks for this column
      for (const s of autoSubtasks) {
        await deleteAutoSubtask(s.id);
      }
      // Insert all local groups/items
      for (const group of localGroups) {
        for (const item of group.items) {
          await addAutoSubtask(group.title, item);
        }
      }
      await refetch();
      toast.success('Auto-subtarefas salvas!');
      setIsDirty(false);
    } catch (err) {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-primary" />
        <Label>Auto-subtarefas (template por coluna)</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Cards que entrarem nesta coluna receberão automaticamente estas subtarefas. Você pode colar várias subtarefas de uma vez (uma por linha).
      </p>

      {/* Local groups */}
      {localGroups.map((group, gIdx) => (
        <div key={gIdx} className="border border-border rounded-lg p-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-semibold text-foreground">{group.title}</h5>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleRemoveGroup(gIdx)}>
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
          {group.items.map((item, iIdx) => (
            <div key={iIdx} className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 rounded border border-border flex-shrink-0" />
              <span className="flex-1 text-muted-foreground">{item}</span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleRemoveItem(gIdx, iIdx)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
          {/* Add items - supports multi-line paste */}
          <div className="space-y-1 pt-1">
            <Textarea
              value={newItemTexts[gIdx] || ''}
              onChange={e => setNewItemTexts(prev => ({ ...prev, [gIdx]: e.target.value }))}
              placeholder="Cole uma ou mais subtarefas (uma por linha)"
              className="min-h-[50px] text-xs resize-none"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAddItems(gIdx);
                }
              }}
            />
            <Button size="sm" className="h-7 text-xs gap-1 w-full" onClick={() => handleAddItems(gIdx)}>
              <Plus className="h-3 w-3" /> Adicionar subtarefa(s)
            </Button>
          </div>
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
        <Button size="sm" className="h-7 text-xs gap-1 whitespace-nowrap" onClick={handleAddGroup} disabled={!newGroupTitle.trim()}>
          <FolderPlus className="h-3 w-3" /> Grupo
        </Button>
      </div>

      {/* Confirm button - only shown when dirty */}
      {isDirty && (
        <Button className="w-full" onClick={handleConfirm} disabled={saving}>
          {saving ? 'Salvando...' : 'Confirmar Auto-subtarefas'}
        </Button>
      )}
    </div>
  );
}
