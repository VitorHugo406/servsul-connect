// Integrações › Webhooks: the admin registers https URLs (Zapier, Make, n8n, own system) that receive company events
// (cards, comments, notices, meetings, War Room, collaborators) signed with HMAC-SHA256. Rows: company_webhooks (RLS:
// company admins). The database triggers live in migrations 20261119020000 and 20261119030000.
import { useCallback, useEffect, useState } from 'react';
import { Copy, Loader2, Plus, Send, Trash2, Webhook } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Sel } from '@/components/ui/Sel';
import { appConfirm } from '@/lib/appDialog';

const db = supabase as any;
type Hook = { id: string; url: string; events: string[]; secret: string; enabled: boolean; description: string | null; last_at: string | null; format: string };
/** delivery formats: plain signed JSON for automation tools, or a ready chat message for team chat apps */
const FORMATS: { id: string; label: string; ph: string; ok: RegExp; help: string }[] = [
  { id: 'json', label: 'JSON (Zapier, Make, n8n, sistema próprio)', ph: 'https://hooks.exemplo.com/…', ok: /^https:\/\//, help: 'Recebe o evento completo em JSON, assinado com a chave secreta.' },
  { id: 'discord', label: 'Discord (mensagem no canal)', ph: 'https://discord.com/api/webhooks/…', ok: /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//, help: 'No Discord: Configurações do canal › Integrações › Webhooks › Novo webhook › Copiar URL.' },
  { id: 'gchat', label: 'Google Chat (mensagem no espaço)', ph: 'https://chat.googleapis.com/v1/spaces/…', ok: /^https:\/\/chat\.googleapis\.com\//, help: 'No Google Chat: no espaço, Apps e integrações › Webhooks › Adicionar webhook › copie a URL.' },
  { id: 'telegram', label: 'Telegram (mensagem no grupo)', ph: 'https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<ID>', ok: /^https:\/\/api\.telegram\.org\/bot[^/]+\/sendMessage\?chat_id=-?\w+/, help: 'Crie um bot com o @BotFather, adicione-o ao grupo e use https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<ID do grupo>.' },
  { id: 'slack', label: 'Slack (mensagem no canal)', ph: 'https://hooks.slack.com/services/…', ok: /^https:\/\/hooks\.slack\.com\//, help: 'No Slack: crie um app com “Incoming Webhooks” e copie a URL do canal.' },
];
const GROUPS: [string, [string, string][]][] = [
  ['Cards', [['task.created', 'Card criado'], ['task.moved', 'Card mudou de coluna'], ['task.completed', 'Card concluído'], ['task.assigned', 'Responsável definido'], ['task.due_changed', 'Prazo alterado'], ['task.deleted', 'Card excluído'], ['comment.created', 'Comentário no card']]],
  ['Colaboradores', [['employee.created', 'Colaborador cadastrado'], ['employee.deactivated', 'Colaborador desativado'], ['employee.reactivated', 'Colaborador reativado']]],
  ['Avisos', [['announcement.published', 'Aviso publicado']]],
  ['Salas de reunião', [['meeting.booked', 'Reunião agendada'], ['meeting.cancelled', 'Reunião cancelada']]],
  ['War Room', [['war_room.opened', 'War Room aberta'], ['war_room.closed', 'War Room encerrada']]],
];
const EV: [string, string][] = GROUPS.flatMap((g) => g[1]);

export function WebhooksCard() {
  const [list, setList] = useState<Hook[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState(''); const [format, setFormat] = useState('json'); const [desc, setDesc] = useState(''); const [events, setEvents] = useState<string[]>(['task.created', 'task.moved', 'task.completed']);
  const [busy, setBusy] = useState<string | null>(null);
  const [show, setShow] = useState<string | null>(null);
  const load = useCallback(async () => { const { data } = await db.from('company_webhooks').select('id,url,events,secret,enabled,description,last_at,format').order('created_at'); setList((data || []) as Hook[]); setLoading(false); }, []);
  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    const u = url.trim();
    if (!/^https:\/\/[^\s/]+\.[^\s/]+/.test(u)) { toast.error('Informe um endereço que comece com https://'); return; }
    const f = FORMATS.find((x) => x.id === format) || FORMATS[0];
    if (!f.ok.test(u)) { toast.error(`Esse endereço não parece de ${f.label.split(' (')[0]}. ${f.help}`); return; }
    if (!events.length) { toast.error('Escolha pelo menos um evento'); return; }
    setBusy('add');
    const { error } = await db.from('company_webhooks').insert({ url: u, events, format, description: desc.trim() || null });
    setBusy(null);
    if (error) { toast.error(/check/i.test(error.message || '') ? 'Endereço não permitido. Use o endereço público (https) do serviço.' : 'Não foi possível salvar o webhook.'); return; }
    setUrl(''); setDesc(''); toast.success('Webhook adicionado'); void load();
  };
  const [editing, setEditing] = useState<string | null>(null);
  const setHookEvents = async (h: Hook, ev: string[]) => { if (!ev.length) { toast.error('Deixe pelo menos um evento'); return; } setList((l) => l.map((x) => (x.id === h.id ? { ...x, events: ev } : x))); const { error } = await db.from('company_webhooks').update({ events: ev }).eq('id', h.id); if (error) { toast.error('Não foi possível salvar os eventos.'); void load(); } };
  const toggle = async (h: Hook) => { await db.from('company_webhooks').update({ enabled: !h.enabled }).eq('id', h.id); void load(); };
  const remove = async (h: Hook) => { if (!(await appConfirm({ title: 'Remover webhook?', message: h.url, confirmText: 'Remover', danger: true }))) return; await db.from('company_webhooks').delete().eq('id', h.id); void load(); };
  const test = async (h: Hook) => { setBusy(h.id); const { data, error } = await db.rpc('send_test_webhook', { _id: h.id }); setBusy(null); if (error || !data) toast.error('Não foi possível enviar o teste.'); else { toast.success('Teste enviado. Confira no serviço de destino.'); void load(); } };

  return (
    <div className="dk-panel dk-pad space-y-4">
      <div className="flex items-start gap-3"><Webhook className="mt-0.5 h-5 w-5" /><div><b>Webhooks e avisos em outros apps</b><p className="dk-hp" style={{ margin: 0 }}>Avise outros sistemas quando algo acontecer no ewvon: cards (criado, movido, concluído, responsável, prazo, excluído, comentário), colaborador cadastrado/desativado/reativado, aviso publicado, reunião agendada/cancelada e War Room aberta/encerrada. Funciona com Zapier, Make, n8n ou o sistema da sua empresa (receba em um endereço https). Cada envio é assinado: o cabeçalho <code>X-Ewvon-Signature</code> traz <code>sha256=</code> + HMAC-SHA256 do corpo com a chave secreta.</p></div></div>
      <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-muted-foreground">Enviar para</span>
        <Sel value={format} onChange={(e) => setFormat(e.target.value)} className="ui-sel min-w-[280px]">{FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</Sel>
      </div>
      <p className="dk-hp" style={{ margin: 0 }}>{FORMATS.find((f) => f.id === format)?.help}</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={FORMATS.find((f) => f.id === format)?.ph} aria-label="Endereço do webhook" />
        <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Nome (opcional)" maxLength={60} aria-label="Nome do webhook" />
      </div>
      <div className="space-y-2">
        {GROUPS.map(([g, list]) => { const all = list.every(([k]) => events.includes(k)); return (
          <div key={g} className="flex flex-wrap items-center gap-1.5">
            <button type="button" className="w-[132px] text-left text-xs font-semibold text-muted-foreground hover:text-foreground" title={all ? 'Desmarcar todos' : 'Marcar todos'} onClick={() => setEvents(all ? events.filter((e) => !list.some(([k]) => k === e)) : [...new Set([...events, ...list.map(([k]) => k)])])}>{g}</button>
            {list.map(([k, l]) => { const on = events.includes(k); return <button key={k} type="button" className="ui-chip" aria-pressed={on} onClick={() => setEvents(on ? events.filter((e) => e !== k) : [...events, k])}>{l}</button>; })}
          </div>); })}
        <div className="flex justify-end"><button className="dk-btn pri" type="button" onClick={() => void add()} disabled={busy !== null}>{busy === 'add' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Adicionar</button></div>
      </div>
      {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : !list.length ? <p className="dk-hp">Nenhum webhook cadastrado.</p> : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {list.map((h) => (
            <div key={h.id} className="space-y-2 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${h.enabled ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                <b className="min-w-0 flex-1 truncate">{h.description || new URL(h.url).host}</b>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{(FORMATS.find((f) => f.id === h.format) || FORMATS[0]).label.split(' (')[0]}</span>
                <button className="dk-btn" type="button" onClick={() => void test(h)} disabled={busy !== null || !h.enabled}>{busy === h.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}Enviar teste</button>
                <button className="dk-btn" type="button" onClick={() => setEditing(editing === h.id ? null : h.id)}>{editing === h.id ? 'Fechar eventos' : 'Eventos'}</button>
                <button className="dk-btn" type="button" onClick={() => void toggle(h)}>{h.enabled ? 'Pausar' : 'Ativar'}</button>
                <button className="dk-btn" type="button" style={{ color: '#8E1B10' }} onClick={() => void remove(h)} aria-label="Remover"><Trash2 className="h-4 w-4" /></button>
              </div>
              <p className="truncate text-xs text-muted-foreground">{`${new URL(h.url).host} · `}{h.events.map((e) => EV.find((x) => x[0] === e)?.[1] || e).join(', ')}{h.last_at ? ` · último envio ${new Date(h.last_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}</p>
              {editing === h.id ? (
                <div className="space-y-1.5 rounded-lg bg-muted/40 p-2">
                  {GROUPS.map(([g, list]) => (
                    <div key={g} className="flex flex-wrap items-center gap-1.5"><span className="w-[132px] text-xs font-semibold text-muted-foreground">{g}</span>
                      {list.map(([k, l]) => { const on = h.events.includes(k); return <button key={k} type="button" className="ui-chip" aria-pressed={on} onClick={() => void setHookEvents(h, on ? h.events.filter((e) => e !== k) : [...h.events, k])}>{l}</button>; })}
                    </div>))}
                </div>) : null}
              <div className="flex items-center gap-2 text-xs"><span className="text-muted-foreground">Chave secreta:</span>
                <code className="rounded bg-muted px-1.5 py-0.5">{show === h.id ? h.secret : '••••••••••••'}</code>
                <button type="button" className="underline" onClick={() => setShow(show === h.id ? null : h.id)}>{show === h.id ? 'Ocultar' : 'Mostrar'}</button>
                <button type="button" aria-label="Copiar chave" onClick={() => { void navigator.clipboard.writeText(h.secret); toast.success('Chave copiada'); }}><Copy className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
