// Company admin: connect the company's own Claude API key. Members then write "@ewvonai ..." in a sector or group chat.
// The key goes straight to the `ewvon-ai` edge function, which validates and encrypts it; this screen never reads it back.
import { BrandTile } from '@/components/integrations/BrandMark';
import { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { appConfirm } from '@/lib/appDialog';
import { toast } from 'sonner';
import { GuideDropdown } from '@/components/integrations/IntegrationGuides';

export type AiRow = { enabled: boolean; config: { model?: string; daily_limit?: number; hint?: string } | null; last_status: string | null; last_error: string | null; last_used_at: string | null };

const MODELS: { id: string; label: string; note: string }[] = [
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', note: 'Equilibrado (recomendado)' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', note: 'Mais rápido e barato' },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', note: 'Mais capaz e mais caro' },
];

async function call(route: string, body: unknown) {
  const { data, error } = await supabase.functions.invoke(`ewvon-ai/${route}`, { body });
  if (error) { let msg = 'Não foi possível concluir.'; try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch { /* ignore */ } throw new Error(msg); }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

export function AiCard({ row, onChanged }: { row?: AiRow; onChanged: () => void }) {
  const [key, setKey] = useState('');
  const [enabled, setEnabled] = useState(row?.enabled ?? true);
  const [model, setModel] = useState(row?.config?.model ?? 'claude-sonnet-5-5');
  const [limit, setLimit] = useState(String(row?.config?.daily_limit ?? 30));
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { setEnabled(row?.enabled ?? true); setModel(row?.config?.model ?? 'claude-sonnet-5-5'); setLimit(String(row?.config?.daily_limit ?? 30)); }, [row]);

  const save = async () => {
    setBusy('save');
    try { await call('save', { key: key || undefined, model, enabled, daily_limit: Number(limit) || 30 }); setKey(''); toast.success('ewvon AI salvo.'); onChanged(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };
  const remove = async () => {
    if (!(await appConfirm({ title: 'Desconectar o EwvonAI?', message: 'A chave é apagada e o @ewvonai para de responder nos chats da empresa.', confirmText: 'Desconectar', danger: true }))) return;
    setBusy('remove');
    try { await call('remove', {}); toast.success('EwvonAI desconectado.'); onChanged(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  return (
    <div className="dk-panel dk-pad">
      <div className="dk-hd">
        <BrandTile id="claude" name="Claude" />
        <div>
          <h2>EwvonAI (Claude)</h2>
          <span className={`dk-stt${row && row.last_status !== 'erro' ? ' on' : ''}`}>{!row ? 'Não conectado' : row.last_status === 'erro' ? 'Último uso falhou' : `Conectado · chave ${row.config?.hint || ''}`}</span>
        </div>
        {row ? <span className="dk-sp"><Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Ativar" /></span> : null}
      </div>
      {row?.last_status === 'erro' && row.last_error ? <div className="dk-err">{row.last_error}</div> : null}
      <p className="dk-tx">Com a chave da sua empresa, qualquer pessoa pode escrever <b>@ewvonai</b> em um setor ou grupo para tirar dúvidas ou pedir ações, como <i>“@ewvonai crie uma tarefa para revisar o contrato até sexta, prioridade alta”</i>. O ewvon AI cria o card com descrição, prazo, prioridade e subtarefas, só nos murais que a pessoa já pode usar. O custo de uso vai direto para a sua conta da Anthropic.</p>

      <GuideDropdown title="Como conseguir a chave (passo a passo)">
        <ol className="list-decimal space-y-1.5 pl-5 text-[13px]">
          <li>Acesse <b>console.anthropic.com</b> e entre (ou crie a conta da empresa).</li>
          <li>Em <b>Billing</b>, adicione um cartão e uma quantia de créditos.</li>
          <li>Em <b>API Keys</b>, clique em <b>Create Key</b>, dê um nome (por exemplo, “ewvon”) e copie a chave que começa com <code>sk-ant-</code>.</li>
          <li>Cole a chave abaixo e clique em <b>{row ? 'Salvar alterações' : 'Conectar'}</b>. Ela é guardada criptografada e nunca mais aparece.</li>
        </ol>
      </GuideDropdown>

      <div>
        <p className="lbl" style={{ marginBottom: 6 }}>Chave de API do Claude{row ? ' · já salva, preencha só para trocar' : ''}</p>
        <Input type="password" autoComplete="off" placeholder={row ? '••••••••••••' : 'sk-ant-…'} value={key} onChange={(e) => setKey(e.target.value.trim())} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="lbl" style={{ marginBottom: 8 }}>Modelo</p>
          <div className="flex flex-wrap gap-1.5">
            {MODELS.map((m) => <button key={m.id} type="button" title={m.note} onClick={() => setModel(m.id)} className="ui-chip" aria-pressed={model === m.id}>{m.label}</button>)}
          </div>
          <p className="dk-hp">{MODELS.find((m) => m.id === model)?.note}</p>
        </div>
        <div>
          <p className="lbl" style={{ marginBottom: 6 }}>Pedidos por pessoa por dia</p>
          <Input inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, '').slice(0, 3))} />
          <p className="dk-hp">Ajuda a manter o gasto sob controle.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="dk-btn pri" type="button" onClick={() => void save()} disabled={busy !== null}>{busy === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{row ? 'Salvar alterações' : 'Conectar'}</button>
        {row ? <button className="dk-btn" style={{ color: '#8E1B10' }} type="button" onClick={() => void remove()} disabled={busy !== null}><Trash2 className="mr-2 h-4 w-4" />Desconectar</button> : null}
      </div>
    </div>
  );
}
