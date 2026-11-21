// "Lixeira" tab of the mural's Arquivados panel: cards deleted in the last 30 days (task_trash, migration
// 20261120010000). Restaurar puts the card back with its checklists, comments, labels, people, fields and links
// (restore_trashed_task); "Excluir de vez" removes it from the trash (owner/admin of the mural or who deleted it).
import { useCallback, useEffect, useState } from 'react';
import { Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { appConfirm } from '@/lib/appDialog';

type Row = { id: string; task_number: number | null; title: string; deleted_by_name: string | null; deleted_at: string };
const DAY = 864e5;

export function TrashList({ boardId, onRestored }: { boardId: string; onRestored: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).from('task_trash').select('id,task_number,title,deleted_by_name,deleted_at').eq('board_id', boardId).order('deleted_at', { ascending: false }).limit(300);
    setRows(error ? [] : (data || []));
  }, [boardId]);
  useEffect(() => { void load(); }, [load]);

  const restore = async (r: Row) => {
    setBusy(r.id);
    const { error } = await (supabase as any).rpc('restore_trashed_task', { _id: r.id });
    setBusy(null);
    if (error) { toast.error(/NO_BOARD/.test(error.message) ? 'O mural deste card não existe mais.' : 'Não foi possível restaurar o card.'); return; }
    toast.success('Card restaurado');
    setRows((x) => (x || []).filter((y) => y.id !== r.id)); onRestored();
  };
  const purge = async (r: Row) => {
    if (!(await appConfirm({ title: 'Excluir de vez?', message: `O card "${r.title}" sai da lixeira e não poderá mais ser recuperado.`, confirmText: 'Excluir de vez', danger: true }))) return;
    setBusy(r.id);
    const { error } = await (supabase as any).rpc('purge_trashed_task', { _id: r.id });
    setBusy(null);
    if (error) { toast.error('Só o dono ou administrador do mural, ou quem excluiu, pode apagar de vez.'); return; }
    setRows((x) => (x || []).filter((y) => y.id !== r.id));
  };

  if (rows === null) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!rows.length) return <p className="py-8 text-center text-sm text-muted-foreground">A lixeira está vazia.<br /><span className="text-xs">Cards excluídos ficam aqui por 30 dias.</span></p>;
  return (
    <div className="w-full space-y-2">
      <p className="text-xs text-muted-foreground">Cards excluídos ficam aqui por 30 dias e voltam com checklists, comentários, etiquetas e campos.</p>
      {rows.map((r) => {
        const left = Math.max(0, 30 - Math.floor((Date.now() - +new Date(r.deleted_at)) / DAY));
        return (
          <div key={r.id} className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">{r.task_number ? `#${r.task_number} ` : ''}{r.title}</p>
              <p className="truncate text-xs text-muted-foreground">{r.deleted_by_name ? `${r.deleted_by_name} · ` : ''}{new Date(r.deleted_at).toLocaleDateString('pt-BR')} · {left} dia(s) restante(s)</p>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" disabled={busy === r.id} onClick={() => void restore(r)} title="Restaurar" aria-label="Restaurar">{busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}</Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 text-destructive" disabled={busy === r.id} onClick={() => void purge(r)} title="Excluir de vez" aria-label="Excluir de vez"><Trash2 className="h-4 w-4" /></Button>
          </div>);
      })}
    </div>
  );
}
