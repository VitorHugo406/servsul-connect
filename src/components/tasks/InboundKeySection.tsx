// "Receber cards de fora" inside the board's Share dialog: a mural key (board_inbound_keys) that lets forms, Zapier/Make/
// n8n or the company's own system CREATE cards through the `cards-in` edge function. Owner/admin only; the key can be
// paused, regenerated and pointed at a column. Shows a ready curl example and an HTML form snippet.
import { useEffect, useState } from 'react';
import { Copy, Inbox, Loader2, Pause, Play, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sel } from '@/components/ui/Sel';
import { appConfirm } from '@/lib/appDialog';

const db = supabase as any;
const FN = 'https://scslfueixmuolkmgdslk.supabase.co/functions/v1/cards-in';
type Key = { id: string; token: string; enabled: boolean; column_id: string | null; uses: number; last_at: string | null; scope?: string };

export function InboundKeySection({ boardId, canManage, columns }: { boardId: string; canManage: boolean; columns: { id: string; title: string }[] }) {
  const [k, setK] = useState<Key | null>(null);
  const [busy, setBusy] = useState(true);
  const [show, setShow] = useState<'' | 'curl' | 'form'>('');
  const load = async () => { setBusy(true); const { data } = await db.from('board_inbound_keys').select('id,token,enabled,column_id,uses,last_at,scope').eq('board_id', boardId).order('created_at', { ascending: false }).limit(1).maybeSingle(); setK(data || null); setBusy(false); };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [boardId]);
  if (!canManage && !k) return null;
  const create = async () => {
    if (k && !(await appConfirm({ title: 'Gerar nova chave?', message: 'A chave atual para de funcionar na hora. Atualize os formulários e automações que usam ela.', confirmText: 'Gerar nova', danger: true }))) return;
    setBusy(true);
    if (k) await db.from('board_inbound_keys').delete().eq('id', k.id);
    const { data, error } = await db.from('board_inbound_keys').insert({ board_id: boardId, column_id: k?.column_id ?? null }).select('id,token,enabled,column_id,uses,last_at,scope').single();
    setBusy(false);
    if (error) { toast.error('Só o dono ou administrador do mural pode criar a chave.'); return; }
    setK(data); toast.success('Chave criada');
  };
  const patch = async (p: Partial<Key>) => { if (!k) return; const { error } = await db.from('board_inbound_keys').update(p).eq('id', k.id); if (error) { toast.error('Não foi possível salvar.'); return; } setK({ ...k, ...p }); };
  const copy = (t: string, m = 'Copiado') => { void navigator.clipboard.writeText(t); toast.success(m); };
  const curl = k ? `curl -X POST ${FN} \\\n  -H "X-Ewvon-Key: ${k.token}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"Novo pedido","description":"Detalhes","due_date":"30/11/2026 18:00","priority":"alta","assignee_email":"pessoa@empresa.com","labels":"Cliente"}'` : '';
  const form = k ? `<form action="${FN}?key=${k.token}" method="post">\n  <input name="title" placeholder="Assunto" required>\n  <textarea name="description" placeholder="Descreva o pedido"></textarea>\n  <input type="hidden" name="redirect" value="https://seusite.com/obrigado">\n  <button>Enviar</button>\n</form>` : '';
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center gap-2 text-sm font-medium"><Inbox className="h-4 w-4" />Receber cards de fora (API e formulários)</div>
      <p className="text-xs text-muted-foreground">Formulários do seu site, Zapier, Make, n8n ou o sistema da empresa podem criar cards neste mural com a chave abaixo. Por padrão a chave só cria cards; com "API completa" ela também lista, lê e altera os cards deste mural.</p>
      {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : k ? (
        <>
          <div className="flex gap-2"><Input readOnly value={k.token} className={`font-mono text-xs ${k.enabled ? '' : 'opacity-50 line-through'}`} aria-label="Chave do mural" />
            <Button variant="outline" size="icon" onClick={() => copy(k.token, 'Chave copiada')} aria-label="Copiar chave"><Copy className="h-4 w-4" /></Button></div>
          <div className="flex items-center gap-2 text-xs"><span className="text-muted-foreground">Cards entram em</span>
            <Sel value={k.column_id || ''} onChange={(e) => void patch({ column_id: e.target.value || null })} disabled={!canManage} className="min-w-[160px]">
              <option value="">Primeira coluna</option>{columns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Sel>
            <span className="ml-auto text-muted-foreground">{k.uses} card(s) recebidos</span></div>
          {canManage ? <label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5" checked={k.scope === 'full'} onChange={(e) => void patch({ scope: e.target.checked ? 'full' : 'create' })} />
            <span><b>API completa</b> — permitir que esta chave também liste, leia e altere (mova, conclua, mude prazo) os cards deste mural. <a href="/desenvolvedores" target="_blank" rel="noreferrer" className="underline">Ver documentação</a></span></label> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setShow(show === 'curl' ? '' : 'curl')}>Exemplo para sistemas</Button>
            <Button variant="outline" size="sm" onClick={() => setShow(show === 'form' ? '' : 'form')}>Formulário HTML</Button>
            {canManage ? <>
              <Button variant="outline" size="sm" onClick={() => void patch({ enabled: !k.enabled })}>{k.enabled ? <><Pause className="mr-1.5 h-4 w-4" />Pausar</> : <><Play className="mr-1.5 h-4 w-4" />Ativar</>}</Button>
              <Button variant="outline" size="sm" onClick={() => void create()}><RefreshCw className="mr-1.5 h-4 w-4" />Nova chave</Button>
            </> : null}
          </div>
          {show ? (
            <div className="relative">
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2 text-[11px] leading-relaxed">{show === 'curl' ? curl : form}</pre>
              <Button variant="outline" size="icon" className="absolute right-1 top-1 h-7 w-7" onClick={() => copy(show === 'curl' ? curl : form)} aria-label="Copiar exemplo"><Copy className="h-3.5 w-3.5" /></Button>
              <p className="mt-1 text-[11px] text-muted-foreground">Campos: title (obrigatório), description, due_date (dd/mm/aaaa ou dd/mm/aaaa hh:mm), priority (urgente, alta, média, baixa), assignee_email (colaborador da empresa) e labels (nomes de etiquetas que já existem no mural).</p>
            </div>) : null}
        </>
      ) : <Button variant="outline" className="w-full" onClick={() => void create()}><Inbox className="mr-2 h-4 w-4" />Criar chave para receber cards</Button>}
    </div>
  );
}
