import { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, CheckSquare, GripVertical, Trash2, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { Subtask } from '@/hooks/useSubtasks';
import type { SubtaskGroup } from '@/hooks/useSubtaskGroups';

interface Props {
  subtasks: Subtask[];
  groups: SubtaskGroup[];
  subtasksLoading: boolean;
  groupsLoading: boolean;
  collapsedGroups: Set<string>;
  toggleGroupCollapse: (id: string) => void;
  onToggleSubtask: (id: string, completed: boolean) => void | Promise<unknown>;
  onDeleteSubtask: (id: string) => void | Promise<unknown>;
  onUpdateSubtask: (id: string, updates: { title?: string; group_id?: string | null; position?: number }) => Promise<unknown>;
  onReorderSubtasks: (orderedIds: string[], groupId: string | null) => Promise<unknown>;
  onAddSubtask: (groupId: string | null, title: string) => Promise<unknown>;
  onDeleteGroup: (id: string) => void | Promise<unknown>;
}

const UNGROUPED = '__ungrouped__';

// ---------- Sortable Item ----------
function SortableSubtaskRow({
  subtask,
  onToggle,
  onDelete,
  onRename,
}: {
  subtask: Subtask;
  onToggle: (completed: boolean) => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: subtask.id,
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(subtask.title);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const commit = () => {
    const t = draft.trim();
    setEditing(false);
    if (t && t !== subtask.title) onRename(t);
    else setDraft(subtask.title);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 group py-0.5 px-1 rounded hover:bg-muted/40"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity touch-none"
        aria-label="Reordenar"
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      <Checkbox checked={subtask.is_completed} onCheckedChange={(c) => onToggle(!!c)} />
      {editing ? (
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setDraft(subtask.title); setEditing(false); }
          }}
          autoFocus
          className="h-7 text-sm flex-1"
        />
      ) : (
        <span
          className={cn(
            'text-sm flex-1 cursor-text select-none',
            subtask.is_completed && 'line-through text-muted-foreground'
          )}
          onClick={() => setEditing(true)}
          title="Clique para editar"
        >
          {subtask.title}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onDelete}
      >
        <X className="h-3 w-3 text-destructive" />
      </Button>
    </div>
  );
}

// ---------- Droppable Group container ----------
function DroppableGroup({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `group-${id}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'px-3 py-2 space-y-1 transition-colors min-h-[40px]',
        isOver && 'bg-primary/5 ring-1 ring-primary/30 rounded'
      )}
    >
      {children}
    </div>
  );
}

export function SubtaskList({
  subtasks,
  groups,
  subtasksLoading,
  groupsLoading,
  collapsedGroups,
  toggleGroupCollapse,
  onToggleSubtask,
  onDeleteSubtask,
  onUpdateSubtask,
  onReorderSubtasks,
  onAddSubtask,
  onDeleteGroup,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeAddItem, setActiveAddItem] = useState<string | null>(null);
  const [draftInput, setDraftInput] = useState<Record<string, string>>({});

  const grouped = useMemo(() => {
    const map = new Map<string, Subtask[]>();
    map.set(UNGROUPED, []);
    groups.forEach((g) => map.set(g.id, []));
    subtasks
      .slice()
      .sort((a, b) => a.position - b.position)
      .forEach((s) => {
        const key = s.group_id || UNGROUPED;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(s);
      });
    return map;
  }, [subtasks, groups]);

  const findContainer = (id: string): string | null => {
    if (id.startsWith('group-')) return id.slice('group-'.length);
    for (const [containerId, items] of grouped) {
      if (items.some((s) => s.id === id)) return containerId;
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeContainer = findContainer(String(active.id));
    const overContainer = findContainer(String(over.id));
    if (!activeContainer || !overContainer) return;

    const sourceItems = grouped.get(activeContainer) || [];
    const destItems = grouped.get(overContainer) || [];

    if (activeContainer === overContainer) {
      // Reorder within same group
      const oldIndex = sourceItems.findIndex((s) => s.id === active.id);
      const newIndex = sourceItems.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      const reordered = arrayMove(sourceItems, oldIndex, newIndex);
      const groupId = activeContainer === UNGROUPED ? null : activeContainer;
      await onReorderSubtasks(reordered.map((s) => s.id), groupId);
    } else {
      // Move to another group
      const moving = sourceItems.find((s) => s.id === active.id);
      if (!moving) return;
      const destGroupId = overContainer === UNGROUPED ? null : overContainer;
      // Insert at end of destination (or at position of over item if over is an item)
      const overIndex = destItems.findIndex((s) => s.id === over.id);
      const newDest = [...destItems];
      const insertAt = overIndex === -1 ? newDest.length : overIndex;
      newDest.splice(insertAt, 0, { ...moving, group_id: destGroupId });
      await onReorderSubtasks(newDest.map((s) => s.id), destGroupId);
      // Source group needs re-numbering too
      const newSrc = sourceItems.filter((s) => s.id !== active.id);
      const srcGroupId = activeContainer === UNGROUPED ? null : activeContainer;
      if (newSrc.length > 0) {
        await onReorderSubtasks(newSrc.map((s) => s.id), srcGroupId);
      }
    }
  };

  const handleAdd = async (groupKey: string) => {
    const text = (draftInput[groupKey] || '').trim();
    if (!text) return;
    await onAddSubtask(groupKey === UNGROUPED ? null : groupKey, text);
    setDraftInput((p) => ({ ...p, [groupKey]: '' }));
  };

  const renderAddBox = (groupKey: string) =>
    activeAddItem === groupKey ? (
      <div className="pt-1 space-y-2 px-1">
        <Input
          value={draftInput[groupKey] || ''}
          onChange={(e) => setDraftInput((p) => ({ ...p, [groupKey]: e.target.value }))}
          placeholder="Adicionar um item"
          className="h-8 text-sm"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleAdd(groupKey)}
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => handleAdd(groupKey)} disabled={!(draftInput[groupKey] || '').trim()}>
            Adicionar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setActiveAddItem(null)}>
            Cancelar
          </Button>
        </div>
      </div>
    ) : (
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-xs gap-1 mt-1 justify-start text-muted-foreground"
        onClick={() => setActiveAddItem(groupKey)}
      >
        Adicionar um item
      </Button>
    );

  const renderGroup = (group: SubtaskGroup) => {
    const items = grouped.get(group.id) || [];
    const completed = items.filter((s) => s.is_completed).length;
    const total = items.length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    const isCollapsed = collapsedGroups.has(group.id);

    return (
      <div key={group.id} className="border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/50">
          <button onClick={() => toggleGroupCollapse(group.id)} className="p-0.5">
            {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          <CheckSquare className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm flex-1">{group.title}</h4>
          {total > 0 && <span className="text-xs text-muted-foreground">{completed}/{total}</span>}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDeleteGroup(group.id)}>
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
        {total > 0 && !isCollapsed && (
          <div className="px-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-8">{progress}%</span>
              <Progress value={progress} className="h-1.5 flex-1" />
            </div>
          </div>
        )}
        {!isCollapsed && (
          <DroppableGroup id={group.id}>
            <SortableContext items={items.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {items.map((s) => (
                <SortableSubtaskRow
                  key={s.id}
                  subtask={s}
                  onToggle={(c) => onToggleSubtask(s.id, c)}
                  onDelete={() => onDeleteSubtask(s.id)}
                  onRename={(t) => onUpdateSubtask(s.id, { title: t })}
                />
              ))}
            </SortableContext>
            {renderAddBox(group.id)}
          </DroppableGroup>
        )}
      </div>
    );
  };

  const ungrouped = grouped.get(UNGROUPED) || [];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-3">
        {!groupsLoading && groups.map(renderGroup)}

        {/* Ungrouped */}
        {!subtasksLoading && (ungrouped.length > 0 || activeAddItem === UNGROUPED) && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/50">
              <CheckSquare className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm flex-1">Subtarefas</h4>
              <span className="text-xs text-muted-foreground">
                {ungrouped.filter((s) => s.is_completed).length}/{ungrouped.length}
              </span>
            </div>
            <DroppableGroup id={UNGROUPED}>
              <SortableContext items={ungrouped.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {ungrouped.map((s) => (
                  <SortableSubtaskRow
                    key={s.id}
                    subtask={s}
                    onToggle={(c) => onToggleSubtask(s.id, c)}
                    onDelete={() => onDeleteSubtask(s.id)}
                    onRename={(t) => onUpdateSubtask(s.id, { title: t })}
                  />
                ))}
              </SortableContext>
              {renderAddBox(UNGROUPED)}
            </DroppableGroup>
          </div>
        )}

        {subtasksLoading && (
          <div className="flex justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <DragOverlay>
        {activeId ? (
          <div className="bg-card border border-border rounded px-2 py-1 text-sm shadow-lg opacity-90">
            {subtasks.find((s) => s.id === activeId)?.title || '...'}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
