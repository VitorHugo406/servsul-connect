// "Comunicados" message sent to the super admin 30 days after a company's trial ended without a plan:
// situation + two buttons (delete the company's data / keep it). The message carries `ewvon-delete:<id>`;
// the details and the decision live in company_deletion_requests (deletion only runs in the database, on the button).
import { useEffect, useState } from 'react';
import { Trash2, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { appConfirm } from '@/lib/appDialog';

export const parseDeletion = (content?: string | null): string | null => content?.match(/ewvon-delete:([0-9a-f-]{36})/)?.[1] ?? null;

type Row = { id: string; company_name: string; trial_ends_at: string | null; people: number; storage_bytes: number; status: 'pending' | 'approved' | 'declined' | 'failed'; result: any };
const db = supabase as any;
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');
const mb = (b: number) => (b >= 1024 ** 3 ? (b / 1024 ** 3).toFixed(1) + ' GB' : Math.max(1, Math.round(b / 1024 ** 2)) + ' MB');

export function DeletionRequestCard({ id }: { id: string }) {
  const [row, setRow] = useState<Row | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const load = async () => { const { data } = await db.from('company_deletion_requests').select('id,company_name,trial_ends_at,people,storage_bytes,status,result').eq('id', id).maybeSingle(); setRow((data as Row) ?? null); };
  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const decide = async (approve: boolean) => {
    if (!row || busy) return;
    if (approve && !(await appConfirm({ title: `Excluir os dados de ${row.company_name}?`, message: `Todos os dados da empresa serão apagados definitivamente: ${row.people} pessoa(s), conversas, tarefas, arquivos e acessos. Isso não pode ser desfeito.`, confirmText: 'Excluir definitivamente', danger: true }))) return;
    setBusy(true);
    const { data, error } = await db.rpc('resolve_company_deletion', { _request_id: row.id, _approve: approve });
    setBusy(false);
    if (error) { toast.error('Não foi possível concluir: ' + error.message); return; }
    if (data?.note) toast.message(data.note);
    else toast.success(approve ? 'Dados da empresa excluídos.' : 'Empresa mantida.');
    void load();
  };

  if (row === undefined) return <div className="ewvon-delcard"><small>Carregando…</small></div>;
  if (row === null) return <div className="ewvon-delcard"><small>Pedido de exclusão indisponível.</small></div>;
  return (
    <div className="ewvon-delcard" onClick={(e) => e.stopPropagation()}>
      <div className="ewvon-delcard-hd"><span className="ewvon-delcard-ic"><Trash2 className="h-4 w-4" /></span><b>Excluir os dados de {row.company_name}?</b></div>
      <p>A avaliação terminou em <b>{date(row.trial_ends_at)}</b> e já se passaram 30 dias sem assinatura. A empresa tem <b>{row.people}</b> pessoa(s) e usa <b>{mb(row.storage_bytes)}</b> de arquivos.</p>
      {row.status === 'pending' ? (
        <div className="ewvon-delcard-btns">
          <button type="button" className="is-danger" disabled={busy} onClick={() => void decide(true)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Excluir dados</button>
          <button type="button" disabled={busy} onClick={() => void decide(false)}><ShieldCheck className="h-4 w-4" /> Manter empresa</button>
        </div>
      ) : <p className="ewvon-delcard-done">{row.status === 'approved' ? '✔ Dados excluídos.' : row.status === 'declined' ? (row.result?.note || '✔ Empresa mantida; nada foi excluído.') : 'Não foi possível concluir.'}</p>}
    </div>
  );
}
