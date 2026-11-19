// "Formulário do mural" inside the board's Share dialog: the owner/admin builds a public form (board_forms) whose link
// /f/<token> anyone can fill; each answer becomes a card (public_form_submit). Editor: title, intro, questions (label,
// type, required, options; the FIRST question is the card title), destination column, priority, due in N days,
// thank-you text. Copy/open link, pause, new link.
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ClipboardList, Copy, ExternalLink, Loader2, Pause, Play, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sel } from '@/components/ui/Sel';
import { appConfirm } from '@/lib/appDialog';

const db = supabase as any;
type Q = { id: string; label: string; type: string; required?: boolean; options?: string[] };
type Form = { id: string; token: string; enabled: boolean; title: string; intro: string | null; questions: Q[]; column_id: string | null; priority: string; due_days: number | null; thank_you: string | null; submissions: number };
const TYPES: [string, string][] = [['text', 'Texto curto'], ['long', 'Texto longo'], ['email', 'E-mail'], ['phone', 'Telefone'], ['number', 'Número'], ['date', 'Data'], ['select', 'Escolha']];
const SEL = 'id,token,enabled,title,intro,questions,column_id,priority,due_days,thank_you,submissions';

export function BoardFormSection({ boardId, boardName, canManage, columns }: { boardId: string; boardName: string; canManage: boolean; columns: { id: string; title: string }[] }) {
  const [f, setF] = useState<Form | null>(null);
  const [busy, setBusy] = useState(true); const [edit, setEdit] = useState(false); const [saving, setSaving] = useState(false);
  const load = async () => { setBusy(true); const { data } = await db.from('board_forms').select(SEL).eq('board_id', boardId).order('created_at', { ascending: false }).limit(1).maybeSingle(); setF(data || null); setBusy(false); };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [boardId]);
  if (!canManage && !f) return null;
  const url = f ? `${window.location.origin}/f/${f.token}` : '';
  const create = async () => {
    setBusy(true);
    const { data, error } = await db.from('board_forms').insert({ board_id: boardId, title: `Solicitação — ${boardName}`.slice(0, 120), intro: 'Preencha os campos abaixo. Sua solicitação vira um card para a equipe.' }).select(SEL).single();
    setBusy(false);
    if (error) { toast.error('Só o dono ou administrador do mural pode criar o formulário.'); return; }
    setF(data); setEdit(true); toast.success('Formulário criado. Personalize e copie o link.');
  };
  const save = async (p: Partial<Form>) => { if (!f) return false; const { error } = await db.from('board_forms').update(p).eq('id', f.id); if (error) { toast.error('Não foi possível salvar o formulário.'); return false; } setF({ ...f, ...p }); return true; };
  const newLink = async () => {
    if (!f || !(await appConfirm({ title: 'Gerar novo link?', message: 'O link atual para de funcionar. Atualize onde ele foi divulgado.', confirmText: 'Gerar novo', danger: true }))) return;
    const token = Array.from(crypto.getRandomValues(new Uint8Array(12))).map((b) => b.toString(16).padStart(2, '0')).join('');
    if (await save({ token } as Partial<Form>)) toast.success('Novo link gerado');
  };
  const setQ = (i: number, p: Partial<Q>) => f && setF({ ...f, questions: f.questions.map((q, j) => (j === i ? { ...q, ...p } : q)) });
  const move = (i: number, d: number) => { if (!f) return; const a = [...f.questions]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setF({ ...f, questions: a }); };
  const saveAll = async () => {
    if (!f) return;
    const qs = f.questions.map((q) => ({ ...q, label: q.label.trim(), options: q.type === 'select' ? (q.options || []).map((o) => o.trim()).filter(Boolean) : undefined })).filter((q) => q.label);
    if (!qs.length) { toast.error('Deixe pelo menos uma pergunta.'); return; }
    if (qs.some((q) => q.type === 'select' && !(q.options || []).length)) { toast.error('Perguntas de escolha precisam de opções.'); return; }
    setSaving(true);
    const ok = await save({ title: f.title.trim() || 'Formulário', intro: f.intro?.trim() || null, questions: qs, column_id: f.column_id, priority: f.priority, due_days: f.due_days, thank_you: f.thank_you?.trim() || null });
    setSaving(false); if (ok) { toast.success('Formulário salvo'); setEdit(false); }
  };

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center gap-2 text-sm font-medium"><ClipboardList className="h-4 w-4" />Formulário do mural</div>
      <p className="text-xs text-muted-foreground">Um link público com formulário: clientes, fornecedores ou colegas preenchem e cada resposta vira um card neste mural. Não precisa de login nem de site.</p>
      {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : !f ? (
        <Button variant="outline" className="w-full" onClick={() => void create()}><ClipboardList className="mr-2 h-4 w-4" />Criar formulário</Button>
      ) : (
        <>
          <div className="flex gap-2"><Input readOnly value={url} className={`font-mono text-xs ${f.enabled ? '' : 'opacity-50 line-through'}`} aria-label="Link do formulário" />
            <Button variant="outline" size="icon" onClick={() => { void navigator.clipboard.writeText(url); toast.success('Link copiado'); }} aria-label="Copiar link"><Copy className="h-4 w-4" /></Button>
            <Button asChild variant="outline" size="icon"><a href={url} target="_blank" rel="noreferrer" aria-label="Abrir formulário"><ExternalLink className="h-4 w-4" /></a></Button></div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{f.submissions} resposta(s) recebida(s)</span><span className="flex-1" />
            {canManage ? <>
              <Button variant="outline" size="sm" onClick={() => setEdit(!edit)}>{edit ? 'Fechar edição' : 'Editar formulário'}</Button>
              <Button variant="outline" size="sm" onClick={() => void save({ enabled: !f.enabled })}>{f.enabled ? <><Pause className="mr-1.5 h-4 w-4" />Pausar</> : <><Play className="mr-1.5 h-4 w-4" />Ativar</>}</Button>
              <Button variant="outline" size="sm" onClick={() => void newLink()} aria-label="Novo link"><RefreshCw className="h-4 w-4" /></Button>
            </> : null}
          </div>
          {edit && canManage ? (
            <div className="space-y-3 rounded-lg bg-muted/40 p-3">
              <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} placeholder="Título do formulário" aria-label="Título" />
              <Textarea value={f.intro || ''} onChange={(e) => setF({ ...f, intro: e.target.value })} maxLength={1000} rows={2} placeholder="Texto de apresentação (opcional)" aria-label="Apresentação" />
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Perguntas — a primeira vira o título do card</p>
                {f.questions.map((q, i) => (
                  <div key={q.id} className="space-y-1.5 rounded-md border border-border bg-background p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input value={q.label} onChange={(e) => setQ(i, { label: e.target.value })} maxLength={120} className="h-8 min-w-0 flex-1 text-sm" aria-label="Pergunta" />
                      <Sel value={q.type} onChange={(e) => setQ(i, { type: e.target.value })} className="ui-sel min-w-[130px]">{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Sel>
                      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={!!q.required} onChange={(e) => setQ(i, { required: e.target.checked })} />Obrigatória</label>
                      <button type="button" onClick={() => move(i, -1)} aria-label="Subir"><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" onClick={() => move(i, 1)} aria-label="Descer"><ArrowDown className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setF({ ...f, questions: f.questions.filter((_, j) => j !== i) })} aria-label="Remover pergunta"><Trash2 className="h-4 w-4 text-destructive" /></button>
                    </div>
                    {q.type === 'select' ? <Input value={(q.options || []).join(', ')} onChange={(e) => setQ(i, { options: e.target.value.split(',') })} className="h-8 text-xs" placeholder="Opções separadas por vírgula (ex.: Baixa, Média, Alta)" aria-label="Opções" /> : null}
                  </div>))}
                {f.questions.length < 15 ? <Button variant="outline" size="sm" onClick={() => setF({ ...f, questions: [...f.questions, { id: 'q' + Date.now().toString(36), label: 'Nova pergunta', type: 'text', required: false }] })}><Plus className="mr-1.5 h-4 w-4" />Adicionar pergunta</Button> : null}
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="flex flex-col gap-1 text-xs"><span className="text-muted-foreground">Coluna de entrada</span>
                  <Sel className="ui-sel" value={f.column_id || ''} onChange={(e) => setF({ ...f, column_id: e.target.value || null })}><option value="">Primeira coluna</option>{columns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Sel></label>
                <label className="flex flex-col gap-1 text-xs"><span className="text-muted-foreground">Prioridade</span>
                  <Sel className="ui-sel" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="urgent">Urgente</option></Sel></label>
                <label className="flex flex-col gap-1 text-xs"><span className="text-muted-foreground">Prazo (dias após o envio)</span>
                  <Input type="number" min={0} max={365} value={f.due_days ?? ''} onChange={(e) => setF({ ...f, due_days: e.target.value === '' ? null : Math.max(0, Math.min(365, +e.target.value)) })} placeholder="Sem prazo" className="h-9" /></label>
              </div>
              <Textarea value={f.thank_you || ''} onChange={(e) => setF({ ...f, thank_you: e.target.value })} maxLength={500} rows={2} placeholder="Mensagem depois do envio (opcional)" aria-label="Mensagem de agradecimento" />
              <div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => { setEdit(false); void load(); }}>Cancelar</Button><Button size="sm" onClick={() => void saveAll()} disabled={saving}>{saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}Salvar formulário</Button></div>
            </div>) : null}
        </>
      )}
    </div>
  );
}
