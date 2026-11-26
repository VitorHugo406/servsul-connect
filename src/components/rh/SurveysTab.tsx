// Pesquisas de clima / eNPS (anonymous). Managers create (models eNPS, Clima or blank), choose sectors and a closing
// date, then open the survey: everyone in the audience is notified. Answers go through survey_submit, which stores
// them without the person (only "already answered" is kept, in survey_participants), and survey_results shows totals
// only from 3 answers on; the breakdown by sector only for sectors with 5+ answers. Migration 20261121010000.
import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Check, ChevronDown, Loader2, Plus, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sel } from '@/components/ui/Sel';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { SectorPicker } from '@/components/announcements/AnnouncementExtras';
import { appConfirm } from '@/lib/appDialog';
import { cn } from '@/lib/utils';
import { RhEmpty, RhHead, RhSec, RhSt, db, fmtD } from './rhShared';
import '@/styles/chat-extras.css';

type Q = { id: string; type: 'enps' | 'scale' | 'choice' | 'text'; label: string; options?: string[] };
type S = { id: string; title: string; intro: string | null; kind: string; questions: Q[]; target_sectors: string[] | null; status: 'draft' | 'open' | 'closed'; closes_at: string | null; created_by: string; created_at: string };
const rid = () => Math.random().toString(36).slice(2, 9);
const MODELS: Record<string, { title: string; kind: string; questions: Omit<Q, 'id'>[] }> = {
  enps: { title: 'eNPS — quanto você recomendaria a empresa?', kind: 'enps', questions: [
    { type: 'enps', label: 'De 0 a 10, quanto você recomendaria esta empresa como um bom lugar para trabalhar?' },
    { type: 'text', label: 'O que mais pesou na sua nota?' },
    { type: 'text', label: 'O que poderíamos melhorar?' }] },
  clima: { title: 'Pesquisa de clima', kind: 'clima', questions: [
    { type: 'scale', label: 'Tenho clareza sobre o que se espera do meu trabalho.' },
    { type: 'scale', label: 'Recebo reconhecimento quando faço um bom trabalho.' },
    { type: 'scale', label: 'Meu gestor me dá feedback com frequência.' },
    { type: 'scale', label: 'Tenho as ferramentas e informações de que preciso.' },
    { type: 'scale', label: 'Consigo equilibrar trabalho e vida pessoal.' },
    { type: 'scale', label: 'A comunicação entre as áreas funciona bem.' },
    { type: 'enps', label: 'De 0 a 10, quanto você recomendaria esta empresa como um bom lugar para trabalhar?' },
    { type: 'text', label: 'Deixe um comentário ou sugestão (opcional).' }] },
  custom: { title: '', kind: 'custom', questions: [{ type: 'scale', label: '' }] },
};
const QT: Record<Q['type'], string> = { enps: 'Nota de 0 a 10 (eNPS)', scale: 'Escala de 1 a 5', choice: 'Múltipla escolha', text: 'Resposta aberta' };

export function SurveysTab({ isManager }: { isManager: boolean }) {
  const { profile, isAdmin } = useAuth();
  const [list, setList] = useState<S[] | null>(null);
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<S | null>(null);
  const [answer, setAnswer] = useState<S | null>(null);
  const [results, setResults] = useState<S | null>(null);
  const load = useCallback(async () => {
    const [{ data }, { data: mine }] = await Promise.all([
      db.from('surveys').select('*').order('created_at', { ascending: false }).limit(100),
      db.from('survey_participants').select('survey_id'),
    ]);
    setList(data || []); setAnswered(new Set(((mine || []) as { survey_id: string }[]).map((r) => r.survey_id)));
  }, []);
  useEffect(() => { void load(); }, [load]);
  const canEdit = (s: S) => s.created_by === profile?.id || isAdmin;
  const isOpen = (s: S) => s.status === 'open' && (!s.closes_at || +new Date(s.closes_at) > Date.now());
  const openSurveys = (list || []).filter((s) => isOpen(s));
  const toAnswer = openSurveys.filter((s) => !answered.has(s.id));
  const managed = (list || []).filter(canEdit);

  const newFrom = (m: keyof typeof MODELS) => setEdit({ id: '', title: MODELS[m].title, intro: 'Sua resposta é anônima: ninguém vê quem respondeu o quê.', kind: MODELS[m].kind, questions: MODELS[m].questions.map((q) => ({ ...q, id: rid() })), target_sectors: null, status: 'draft', closes_at: null, created_by: profile?.id || '', created_at: '' });
  const setStatus = async (s: S, status: S['status']) => {
    if (status === 'open' && !(await appConfirm({ title: 'Abrir a pesquisa?', message: 'Todas as pessoas do público recebem um aviso para responder. Depois de aberta, as perguntas não mudam.', confirmText: 'Abrir pesquisa' }))) return;
    if (status === 'closed' && !(await appConfirm({ title: 'Encerrar a pesquisa?', message: 'Ninguém mais poderá responder.', confirmText: 'Encerrar' }))) return;
    const { error } = await db.from('surveys').update({ status }).eq('id', s.id);
    if (error) toast.error('Não foi possível alterar a pesquisa.'); else void load();
  };
  const remove = async (s: S) => {
    if (!(await appConfirm({ title: 'Excluir a pesquisa?', message: 'As respostas também serão apagadas.', confirmText: 'Excluir', danger: true }))) return;
    const { error } = await db.from('surveys').delete().eq('id', s.id);
    if (error) toast.error('Não foi possível excluir.'); else void load();
  };
  const stOf = (s: S) => (s.status === 'draft' ? <RhSt k="mut">Rascunho</RhSt> : isOpen(s) ? <RhSt k="ok">Aberta</RhSt> : <RhSt k="wait">Encerrada</RhSt>);
  const meta = (s: S) => [`${s.questions.length} ${s.questions.length === 1 ? 'pergunta' : 'perguntas'}`, s.status === 'draft' ? `criada em ${fmtD(s.created_at)}` : s.closes_at ? (isOpen(s) ? `responda até ${fmtD(s.closes_at)}` : `encerrou em ${fmtD(s.closes_at)}`) : 'sem prazo', 'anônima'].join(' · ');
  const doneByMe = openSurveys.filter((s) => answered.has(s.id));
  const newBtn = isManager ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><button type="button" className="dk-btn pri"><Plus size={16} />Nova pesquisa<ChevronDown size={15} /></button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {([['enps', 'eNPS', 'Uma nota de 0 a 10 e duas perguntas abertas. Leva 1 minuto.'], ['clima', 'Pesquisa de clima', '6 afirmações de 1 a 5, a nota eNPS e um comentário.'], ['custom', 'Em branco', 'Monte suas próprias perguntas.']] as const).map(([k, t, d]) => (
          <DropdownMenuItem key={k} className="flex-col items-start gap-0.5 py-2" onSelect={() => newFrom(k)}><span className="text-sm font-medium">{t}</span><span className="text-xs text-muted-foreground">{d}</span></DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  return (
    <div className="rh-area">
      <RhHead title="Pesquisas" desc="Pesquisas de clima e eNPS. As respostas são anônimas e os resultados só aparecem a partir de 3 respostas.">{newBtn}</RhHead>
      <RhSec title="Para você responder" n={toAnswer.length || undefined} attn={toAnswer.length > 0}>
        {list === null ? <div className="rh-empty"><Loader2 className="h-5 w-5 animate-spin" /></div> : toAnswer.length ? (
          <div className="rh-list">{toAnswer.map((s) => (
            <div key={s.id} className="rh-row rh-click" onClick={() => setAnswer(s)}>
              <span className="rh-ico"><BarChart3 size={18} /></span>
              <div className="rh-main"><div className="rh-t">{s.title}</div><div className="rh-m">{meta(s)}</div></div>
              <div className="rh-end"><button type="button" className="dk-btn pri" onClick={(e) => { e.stopPropagation(); setAnswer(s); }}>Responder</button></div>
            </div>))}</div>
        ) : <RhEmpty title={doneByMe.length ? 'Tudo respondido' : 'Nenhuma pesquisa aberta'} text={doneByMe.length ? 'Você já respondeu todas as pesquisas abertas. Obrigado!' : 'Quando o RH ou seu gestor abrir uma pesquisa, ela aparece aqui e você recebe um aviso.'} />}
      </RhSec>
      {doneByMe.length ? (
        <RhSec title="Já respondidas" n={doneByMe.length}>
          <div className="rh-list">{doneByMe.map((s) => (
            <div key={s.id} className="rh-row">
              <span className="rh-ico"><Check size={18} /></span>
              <div className="rh-main"><div className="rh-t">{s.title}</div><div className="rh-m">{meta(s)}</div></div>
              <div className="rh-end"><RhSt k="ok">Respondida</RhSt></div>
            </div>))}</div>
        </RhSec>
      ) : null}
      {isManager || managed.length ? (
        <RhSec title="Pesquisas que você gerencia" n={managed.length || undefined}>
          {managed.length ? <div className="rh-list">{managed.map((s) => (
            <div key={s.id} className="rh-row rh-click" onClick={() => (s.status === 'draft' ? setEdit(s) : setResults(s))}>
              <span className="rh-ico"><BarChart3 size={18} /></span>
              <div className="rh-main"><div className="rh-t">{s.title}</div><div className="rh-m">{meta(s)}</div></div>
              <div className="rh-end" onClick={(e) => e.stopPropagation()}>
                {stOf(s)}
                {s.status === 'draft' ? <><button type="button" className="dk-btn" onClick={() => setEdit(s)}>Editar</button><button type="button" className="dk-btn pri" onClick={() => void setStatus(s, 'open')}>Abrir para respostas</button></> : null}
                {s.status !== 'draft' ? <button type="button" className="dk-btn" onClick={() => setResults(s)}>Ver resultados</button> : null}
                {s.status === 'open' && isOpen(s) ? <button type="button" className="rh-link" onClick={() => void setStatus(s, 'closed')}>Encerrar</button> : null}
                <button type="button" className="dk-ic" aria-label="Excluir" title="Excluir" onClick={() => void remove(s)}><Trash2 size={16} /></button>
              </div>
            </div>))}</div>
            : <RhEmpty title="Você ainda não criou pesquisas" text="Comece por um modelo pronto: o eNPS leva 1 minuto para responder. A pesquisa fica em rascunho até você abrir." action={newBtn} />}
        </RhSec>
      ) : null}
      <SurveyEditor value={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void load(); }} />
      <SurveyAnswer s={answer} onClose={() => setAnswer(null)} onDone={() => { setAnswer(null); void load(); }} />
      <SurveyResults s={results} onClose={() => setResults(null)} />
    </div>
  );
}

function SurveyEditor({ value, onClose, onSaved }: { value: S | null; onClose: () => void; onSaved: () => void }) {
  const [s, setS] = useState<S | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setS(value ? { ...value, questions: value.questions.map((q) => ({ ...q })) } : null); }, [value]);
  if (!s) return null;
  const setQ = (id: string, p: Partial<Q>) => setS({ ...s, questions: s.questions.map((q) => (q.id === id ? { ...q, ...p } : q)) });
  const ok = s.title.trim() && s.questions.length && s.questions.every((q) => q.label.trim() && (q.type !== 'choice' || (q.options || []).filter((o) => o.trim()).length >= 2));
  const save = async () => {
    if (!ok) return;
    setBusy(true);
    const row = { title: s.title.trim(), intro: s.intro?.trim() || null, kind: s.kind, questions: s.questions.map((q) => ({ id: q.id, type: q.type, label: q.label.trim(), ...(q.type === 'choice' ? { options: (q.options || []).map((o) => o.trim()).filter(Boolean) } : {}) })), target_sectors: s.target_sectors?.length ? s.target_sectors : null, closes_at: s.closes_at || null };
    const { error } = s.id ? await db.from('surveys').update(row).eq('id', s.id) : await db.from('surveys').insert(row);
    setBusy(false);
    if (error) { toast.error('Não foi possível salvar. Só gestores e administradores criam pesquisas.'); return; }
    toast.success('Pesquisa salva como rascunho. Abra quando estiver pronta.'); onSaved();
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{s.id ? 'Editar pesquisa' : 'Nova pesquisa'}</DialogTitle><DialogDescription>As respostas são anônimas. Os resultados aparecem a partir de 3 respostas.</DialogDescription></DialogHeader>
        <div className="cx-form max-h-[62vh] overflow-auto pr-1">
          <div><label className="cx-l" htmlFor="sv-t">Título</label><Input id="sv-t" value={s.title} maxLength={160} onChange={(e) => setS({ ...s, title: e.target.value })} /></div>
          <div><label className="cx-l" htmlFor="sv-i">Apresentação</label><Textarea id="sv-i" rows={2} maxLength={2000} value={s.intro || ''} onChange={(e) => setS({ ...s, intro: e.target.value })} /></div>
          <div><label className="cx-l">Quem responde</label><SectorPicker value={s.target_sectors || []} onChange={(v) => setS({ ...s, target_sectors: v })} /></div>
          <div className="cx-two"><div><label className="cx-l" htmlFor="sv-c">Encerra em</label><Input id="sv-c" type="date" value={s.closes_at ? s.closes_at.slice(0, 10) : ''} onChange={(e) => setS({ ...s, closes_at: e.target.value ? new Date(`${e.target.value}T23:59:00`).toISOString() : null })} /></div></div>
          <label className="cx-l">Perguntas</label>
          {s.questions.map((q, i) => (
            <div key={q.id} className="rounded-[12px] border border-border p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">{i + 1}.</span>
                <Sel className="ui-sel" value={q.type} onChange={(e) => setQ(q.id, { type: e.target.value as Q['type'], options: e.target.value === 'choice' ? (q.options?.length ? q.options : ['', '']) : undefined })} aria-label="Tipo da pergunta">{Object.entries(QT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Sel>
                <span className="flex-1" />
                {s.questions.length > 1 ? <button type="button" className="cx-iconbtn" onClick={() => setS({ ...s, questions: s.questions.filter((x) => x.id !== q.id) })} aria-label="Remover pergunta"><Trash2 className="h-4 w-4" /></button> : null}
              </div>
              <Input className="mt-2" value={q.label} maxLength={300} onChange={(e) => setQ(q.id, { label: e.target.value })} placeholder="Escreva a pergunta" aria-label={`Pergunta ${i + 1}`} />
              {q.type === 'choice' ? <div className="mt-2 flex flex-col gap-1.5">{(q.options || []).map((o, j) => <div key={j} className="cx-optrow"><Input value={o} maxLength={120} placeholder={`Opção ${j + 1}`} onChange={(e) => { const op = [...(q.options || [])]; op[j] = e.target.value; setQ(q.id, { options: op }); }} aria-label={`Opção ${j + 1}`} />{(q.options || []).length > 2 ? <button type="button" className="cx-iconbtn" onClick={() => setQ(q.id, { options: (q.options || []).filter((_, k) => k !== j) })} aria-label="Remover opção"><Trash2 className="h-4 w-4" /></button> : null}</div>)}
                {(q.options || []).length < 10 ? <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setQ(q.id, { options: [...(q.options || []), ''] })}><Plus className="mr-1 h-4 w-4" />Opção</Button> : null}</div> : null}
            </div>
          ))}
          {s.questions.length < 40 ? <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setS({ ...s, questions: [...s.questions, { id: rid(), type: 'scale', label: '' }] })}><Plus className="mr-1.5 h-4 w-4" />Adicionar pergunta</Button> : null}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button><Button onClick={() => void save()} disabled={busy || !ok}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar rascunho</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SurveyAnswer({ s, onClose, onDone }: { s: S | null; onClose: () => void; onDone: () => void }) {
  const [a, setA] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { setA({}); }, [s]);
  if (!s) return null;
  const missing = s.questions.filter((q) => q.type !== 'text' && !a[q.id]).length;
  const send = async () => {
    setBusy(true);
    const answers: Record<string, string | number> = {};
    for (const q of s.questions) { const v = a[q.id]; if (v == null || v === '') continue; answers[q.id] = q.type === 'enps' || q.type === 'scale' ? Number(v) : v.slice(0, 2000); }
    const { error } = await db.rpc('survey_submit', { _id: s.id, _answers: answers });
    setBusy(false);
    if (error) { toast.error(/SURVEY_ANSWERED/.test(error.message) ? 'Você já respondeu esta pesquisa.' : /SURVEY_CLOSED/.test(error.message) ? 'A pesquisa já foi encerrada.' : 'Não foi possível enviar.'); return; }
    toast.success('Obrigado! Sua resposta foi registrada de forma anônima.'); onDone();
  };
  const scale = (q: Q, from: number, to: number) => (
    <div className="flex flex-wrap gap-1.5">{Array.from({ length: to - from + 1 }, (_, i) => from + i).map((n) => <button key={n} type="button" aria-pressed={a[q.id] === String(n)} onClick={() => setA({ ...a, [q.id]: String(n) })} className={cn('h-9 min-w-9 rounded-[10px] border px-2 text-sm font-semibold', a[q.id] === String(n) ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}>{n}</button>)}</div>
  );
  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{s.title}</DialogTitle><DialogDescription>{s.intro || 'Sua resposta é anônima.'}</DialogDescription></DialogHeader>
        <div className="flex max-h-[60vh] flex-col gap-4 overflow-auto pr-1">
          {s.questions.map((q, i) => (
            <div key={q.id}>
              <div className="mb-2 text-sm font-medium">{i + 1}. {q.label}</div>
              {q.type === 'enps' ? <>{scale(q, 0, 10)}<div className="mt-1 flex justify-between text-[11px] text-muted-foreground"><span>Nada provável</span><span>Muito provável</span></div></>
                : q.type === 'scale' ? <>{scale(q, 1, 5)}<div className="mt-1 flex justify-between text-[11px] text-muted-foreground" style={{ maxWidth: 230 }}><span>Discordo</span><span>Concordo</span></div></>
                : q.type === 'choice' ? <div className="flex flex-wrap gap-1.5">{(q.options || []).map((o) => <button key={o} type="button" className="ui-chip" aria-pressed={a[q.id] === o} onClick={() => setA({ ...a, [q.id]: o })}>{o}</button>)}</div>
                : <Textarea rows={3} maxLength={2000} value={a[q.id] || ''} onChange={(e) => setA({ ...a, [q.id]: e.target.value })} placeholder="Opcional" />}
            </div>
          ))}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose} disabled={busy}>Depois</Button><Button onClick={() => void send()} disabled={busy || missing > 0}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{missing ? `Faltam ${missing}` : 'Enviar respostas'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type RQ = { id: string; type: string; label: string; n?: number; avg?: number; score?: number | null; promoters?: number; passives?: number; detractors?: number; dist?: { v: number; n: number }[]; by_sector?: { sector: string; n: number; avg: number; score: number }[]; options?: string[]; counts?: number[]; answers?: string[] };
function SurveyResults({ s, onClose }: { s: S | null; onClose: () => void }) {
  const [r, setR] = useState<{ total: number; invited: number; min: number; questions: RQ[] } | null>(null);
  useEffect(() => { setR(null); if (!s) return; void db.rpc('survey_results', { _id: s.id }).then(({ data, error }: any) => setR(error ? { total: 0, invited: 0, min: 3, questions: [] } : data)); }, [s]);
  if (!s) return null;
  const bar = (n: number, max: number) => <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${max ? Math.round((n / max) * 100) : 0}%` }} /></div>;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Resultados</DialogTitle><DialogDescription>{s.title}{r ? ` · ${r.total} de ${r.invited} pessoas responderam` : ''}</DialogDescription></DialogHeader>
        {!r ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          : r.total < r.min ? <p className="py-8 text-center text-sm text-muted-foreground">Para proteger o anonimato, os resultados aparecem a partir de {r.min} respostas. Até agora: {r.total}.</p>
          : <div className="flex max-h-[62vh] flex-col gap-4 overflow-auto pr-1">
            <div className="self-end"><ExportMenu className="dk-btn" getData={() => ({ name: `resultados-${s.title}`, sheet: 'Resultados', headers: ['Pergunta', 'Tipo', 'Respostas', 'Média', 'eNPS', 'Detalhe'], rows: r.questions.map((q) => [q.label, QT[q.type as Q['type']] || q.type, q.n ?? (q.answers?.length ?? (q.counts || []).reduce((a, b) => a + b, 0)), q.avg ?? '', q.score ?? '', q.type === 'choice' ? (q.options || []).map((o, i) => `${o}: ${q.counts?.[i] ?? 0}`).join(' | ') : q.type === 'text' ? (q.answers || []).join(' | ') : (q.dist || []).map((d) => `${d.v}: ${d.n}`).join(' | ')]) })} /></div>
            {r.questions.map((q, i) => (
              <section key={q.id} className="rounded-[12px] border border-border p-3">
                <div className="mb-2 text-sm font-medium">{i + 1}. {q.label}</div>
                {q.type === 'enps' ? <>
                  <div className="flex items-end gap-4"><div><div className="text-3xl font-semibold">{q.score ?? '—'}</div><div className="text-xs text-muted-foreground">eNPS (−100 a 100)</div></div>
                    <div className="flex-1 space-y-1 text-xs">{([['Promotores (9–10)', q.promoters], ['Neutros (7–8)', q.passives], ['Detratores (0–6)', q.detractors]] as const).map(([l, n]) => <div key={l} className="flex items-center gap-2"><span className="w-32 shrink-0">{l}</span>{bar(n || 0, q.n || 0)}<b className="w-6 text-right">{n || 0}</b></div>)}</div></div>
                </> : q.type === 'scale' ? <>
                  <div className="mb-2 text-2xl font-semibold">{q.avg ?? '—'}<span className="text-sm font-normal text-muted-foreground"> / 5 · {q.n} resposta(s)</span></div>
                  <div className="space-y-1 text-xs">{(q.dist || []).map((d) => <div key={d.v} className="flex items-center gap-2"><span className="w-4">{d.v}</span>{bar(d.n, q.n || 0)}<b className="w-6 text-right">{d.n}</b></div>)}</div>
                </> : q.type === 'choice' ? <div className="space-y-1 text-xs">{(q.options || []).map((o, k) => { const tot = (q.counts || []).reduce((a, b) => a + b, 0); return <div key={o} className="flex items-center gap-2"><span className="w-40 shrink-0 truncate">{o}</span>{bar(q.counts?.[k] || 0, tot)}<b className="w-6 text-right">{q.counts?.[k] || 0}</b></div>; })}</div>
                : (q.answers || []).length ? <ul className="flex flex-col gap-1.5">{(q.answers || []).map((t, k) => <li key={k} className="rounded-[10px] bg-muted/50 px-3 py-2 text-sm">{t}</li>)}</ul> : <p className="text-sm text-muted-foreground">Sem respostas abertas.</p>}
                {q.by_sector?.length ? <div className="mt-3 border-t border-border pt-2 text-xs"><div className="mb-1 font-semibold text-muted-foreground">Por setor (5 respostas ou mais)</div>{q.by_sector.map((b) => <div key={b.sector} className="flex justify-between py-0.5"><span>{b.sector} · {b.n}</span><b>{q.type === 'enps' ? b.score : b.avg}</b></div>)}</div> : null}
              </section>
            ))}
          </div>}
        <DialogFooter><Button variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
