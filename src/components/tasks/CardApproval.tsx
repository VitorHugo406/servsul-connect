// "Aprovação" section of the card dialog (task_approvals, migration 20261120010000). Anyone in the mural asks a
// colleague to approve the card (optional message and columns to move to on approve / on reject); the approver
// is notified, sees Aprovar / Recusar here and the card moves by itself. Only one pending request per card.
// Hidden when the card never had an approval and the person did not open it from "Mais".
import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sel } from '@/components/ui/Sel';
import { appPrompt } from '@/lib/appDialog';

type A = { id: string; requested_by: string; approver_id: string; message: string | null; status: 'pending' | 'approved' | 'rejected' | 'cancelled'; decision_note: string | null; decided_at: string | null; created_at: string; on_approve_column: string | null; on_reject_column: string | null };
type U = { id: string; name: string; display_name?: string | null };
const db = supabase as any;
const ST: Record<string, [string, string]> = { approved: ['Aprovado', '#15803d'], rejected: ['Recusado', '#d92d20'], cancelled: ['Cancelado', '#6b7280'], pending: ['Aguardando', '#b45309'] };

export function CardApproval({ taskId, columns, users, readOnly, forceOpen, onClose }: { taskId: string; columns: { id: string; title: string }[]; users: U[]; readOnly?: boolean; forceOpen?: boolean; onClose?: () => void }) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<A[] | null>(null);
  const [form, setForm] = useState({ approver: '', message: '', ok: '', no: '' });
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data } = await db.from('task_approvals').select('id,requested_by,approver_id,message,status,decision_note,decided_at,created_at,on_approve_column,on_reject_column').eq('task_id', taskId).order('created_at', { ascending: false }).limit(10);
    setRows(data || []);
  }, [taskId]);
  useEffect(() => { void load(); }, [load]);

  const who = (id: string) => { if (id === profile?.id) return 'Você'; const u = users.find((x) => x.id === id); return u ? (u.display_name || u.name) : 'Colaborador'; };
  const colName = (id: string | null) => columns.find((c) => c.id === id)?.title;
  const pending = rows?.find((r) => r.status === 'pending');
  const history = (rows || []).filter((r) => r.status !== 'pending').slice(0, 3);
  if (rows === null) return null;
  if (!rows.length && !forceOpen) return null;

  const ask = async () => {
    if (!form.approver) { toast.error('Escolha quem vai aprovar.'); return; }
    setBusy(true);
    const { error } = await db.from('task_approvals').insert({ task_id: taskId, approver_id: form.approver, message: form.message.trim() || null, on_approve_column: form.ok || null, on_reject_column: form.no || null });
    setBusy(false);
    if (error) { toast.error(/APPROVAL_PENDING/.test(error.message) ? 'Este card já tem um pedido de aprovação aguardando.' : 'Não foi possível pedir a aprovação.'); return; }
    toast.success('Pedido de aprovação enviado'); setForm({ approver: '', message: '', ok: '', no: '' }); void load();
  };
  const decide = async (approve: boolean) => {
    if (!pending) return;
    let note: string | null = null;
    if (!approve) { note = await appPrompt({ title: 'Recusar aprovação', message: 'Explique o motivo (opcional).', placeholder: 'Ex.: falta anexar o orçamento', confirmText: 'Recusar' }); if (note === null) return; }
    setBusy(true);
    const { error } = await db.rpc('task_approval_decide', { _id: pending.id, _approve: approve, _note: note || null });
    setBusy(false);
    if (error) { toast.error(/CARD_BLOCKED/.test(error.message) ? 'Aprovado, mas o card não pôde ser movido: ele espera outro card terminar.' : 'Não foi possível registrar a decisão.'); void load(); return; }
    toast.success(approve ? 'Card aprovado' : 'Card recusado'); void load();
  };
  const cancel = async () => { if (!pending) return; const { error } = await db.rpc('task_approval_cancel', { _id: pending.id }); if (error) toast.error('Não foi possível cancelar.'); void load(); };

  return (
    <div className="px-4 py-2">
      <h4 className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aprovação
        {forceOpen && !rows.length && onClose ? <button type="button" className="ml-auto normal-case tracking-normal text-muted-foreground hover:text-foreground" onClick={onClose} aria-label="Fechar"><X className="h-3.5 w-3.5" /></button> : null}</h4>
      {pending ? (
        <div className="rounded-lg border border-amber-300/70 bg-amber-50 p-3 text-sm dark:border-amber-700/60 dark:bg-amber-950/30">
          <p><b>{who(pending.requested_by)}</b> pediu aprovação de <b>{who(pending.approver_id)}</b></p>
          {pending.message ? <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{pending.message}</p> : null}
          {(colName(pending.on_approve_column) || colName(pending.on_reject_column)) ? <p className="mt-1 text-xs text-muted-foreground">{colName(pending.on_approve_column) ? `Aprovado → ${colName(pending.on_approve_column)}` : ''}{colName(pending.on_approve_column) && colName(pending.on_reject_column) ? ' · ' : ''}{colName(pending.on_reject_column) ? `Recusado → ${colName(pending.on_reject_column)}` : ''}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {pending.approver_id === profile?.id ? <>
              <Button size="sm" className="h-8" disabled={busy} onClick={() => void decide(true)}>{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <BadgeCheck className="mr-1.5 h-4 w-4" />}Aprovar</Button>
              <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => void decide(false)}>Recusar</Button>
            </> : <span className="text-xs text-muted-foreground">Aguardando a decisão.</span>}
            {pending.requested_by === profile?.id ? <Button size="sm" variant="ghost" className="h-8" disabled={busy} onClick={() => void cancel()}>Cancelar pedido</Button> : null}
          </div>
        </div>
      ) : !readOnly && (forceOpen || history.length) ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
            <label className="flex flex-col gap-1 text-xs"><span className="text-muted-foreground">Quem aprova</span>
              <Sel className="ui-sel" value={form.approver} onChange={(e) => setForm({ ...form, approver: e.target.value })}><option value="">Escolher pessoa</option>{users.filter((u) => u.id !== profile?.id).map((u) => <option key={u.id} value={u.id}>{u.display_name || u.name}</option>)}</Sel></label>
            <span />
            <label className="flex flex-col gap-1 text-xs"><span className="text-muted-foreground">Se aprovar, mover para</span>
              <Sel className="ui-sel" value={form.ok} onChange={(e) => setForm({ ...form, ok: e.target.value })}><option value="">Não mover</option>{columns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Sel></label>
            <label className="flex flex-col gap-1 text-xs"><span className="text-muted-foreground">Se recusar, mover para</span>
              <Sel className="ui-sel" value={form.no} onChange={(e) => setForm({ ...form, no: e.target.value })}><option value="">Não mover</option>{columns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Sel></label>
          </div>
          <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={2} maxLength={1000} placeholder="Mensagem para quem aprova (opcional)" />
          <div className="flex justify-end"><Button size="sm" className="h-8" disabled={busy || !form.approver} onClick={() => void ask()}>{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}Pedir aprovação</Button></div>
        </div>
      ) : null}
      {history.length ? (
        <ul className="mt-2 space-y-1 text-xs">
          {history.map((h) => { const [l, c] = ST[h.status]; return (
            <li key={h.id} className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
              <span className="rounded px-1.5 py-0.5 font-medium" style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}>{l}</span>
              <span>{h.status === 'cancelled' ? `pedido de ${who(h.requested_by)}` : `por ${who(h.approver_id)}`} · {new Date(h.decided_at || h.created_at).toLocaleDateString('pt-BR')}</span>
              {h.decision_note ? <span className="w-full pl-1 text-foreground/80">“{h.decision_note}”</span> : null}
            </li>); })}
        </ul>) : null}
    </div>
  );
}
