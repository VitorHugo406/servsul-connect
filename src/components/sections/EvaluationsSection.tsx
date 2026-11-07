// "Avaliações" tab — simple performance evaluations.
// Gestores (admin/gerente/supervisor/diretoria) criam avaliações a partir de uma
// lista de critérios, dão nota de 1 a 5 em cada um e escrevem o feedback.
// O colaborador recebe, lê e dá ciência (ou pede revisão). Logic in src/lib/evaluations.ts.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Plus, Search, FileText, Send, Save, Trash2, Check, RotateCcw, Pencil, Sparkles, Star, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getActiveCompanyId } from '@/lib/companyScope';
import { openReport } from '@/lib/reports';
import { cn } from '@/lib/utils';
import * as E from '@/lib/evaluations';
import type { Criterion, EvalItem, EvalRow, EvalStatus } from '@/lib/evaluations';

const MANAGER_LEVELS = ['admin', 'gerente', 'supervisor', 'diretoria'];
const FILTERS: { id: 'all' | EvalStatus; label: string }[] = [
  { id: 'all', label: 'Todas' }, { id: 'draft', label: 'Rascunhos' }, { id: 'sent', label: 'Aguardando ciência' },
  { id: 'contested', label: 'Revisão pedida' }, { id: 'finalized', label: 'Concluídas' },
];
const TONE_CLS: Record<string, string> = {
  good: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
  info: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30',
  warn: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
  bad: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30',
  neutral: 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
};
const SOLID: Record<string, string> = { good: '#16a34a', info: '#0284c7', warn: '#d97706', bad: '#e11d48', neutral: '#52525b' };
const initials = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

function StatusPill({ s }: { s: EvalStatus }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1', TONE_CLS[E.STATUS_TONE[s]])}>{E.STATUS_LABEL[s]}</span>;
}
function ScoreBadge({ v, big }: { v: number | null; big?: boolean }) {
  return (
    <div className={cn('flex shrink-0 flex-col items-center justify-center rounded-2xl ring-1', TONE_CLS[E.scoreTone(v)], big ? 'h-20 w-20' : 'h-12 w-12')}>
      <b className={big ? 'text-2xl' : 'text-base'}>{E.fmtScore(v)}</b>
      {big ? <span className="text-[10px] font-medium opacity-80">de 5</span> : null}
    </div>
  );
}

export function EvaluationsSection() {
  const { profile, isAdmin } = useAuth();
  const canManage = isAdmin || MANAGER_LEVELS.includes(profile?.autonomy_level || '');
  const [list, setList] = useState<EvalRow[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'team' | 'mine' | 'criteria'>(canManage ? 'team' : 'mine');
  const [filter, setFilter] = useState<'all' | EvalStatus>('all');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [evs, crs] = await Promise.all([E.listEvaluations(), canManage ? E.listCriteria(true) : Promise.resolve([])]);
      setList(evs); setCriteria(crs);
    } catch (e) { toast.error((e as Error).message); } finally { setLoading(false); }
  }, [canManage]);
  useEffect(() => { void load(); }, [load]);

  const mine = useMemo(() => list.filter((e) => e.evaluatedId === profile?.id && e.status !== 'draft'), [list, profile?.id]);
  const team = useMemo(() => list.filter((e) => e.evaluatedId !== profile?.id), [list, profile?.id]);
  const base = tab === 'mine' ? mine : team;
  const shown = base.filter((e) => (filter === 'all' || e.status === filter) && (!q.trim() || [e.evaluatedName, e.evaluatorName, e.period, e.evaluatedSector || ''].some((x) => x.toLowerCase().includes(q.trim().toLowerCase()))));
  const scored = base.filter((e) => e.score != null && e.status !== 'draft');
  const avg = scored.length ? scored.reduce((s, e) => s + (e.score || 0), 0) / scored.length : null;
  const pendingMine = mine.filter((e) => e.status === 'sent').length;
  const current = list.find((e) => e.id === openId) || null;
  const activeCriteria = criteria.filter((c) => c.is_active);

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader
        icon={<ClipboardCheck />} eyebrow="Desempenho" title="Avaliações"
        subtitle={canManage ? 'Avalie sua equipe por critérios simples, de 1 a 5, e acompanhe a ciência de cada pessoa.' : 'Veja as avaliações que você recebeu, as notas e os feedbacks.'}
        actions={<>
          {base.length ? <Button variant="outline" className="rounded-xl" onClick={() => { if (!openReport(E.summaryReport(base, tab === 'mine' ? 'Minhas avaliações' : 'Avaliações da equipe'))) toast.error('Permita pop-ups para abrir o relatório.'); }}><FileText className="mr-2 h-4 w-4" />Relatório</Button> : null}
          {canManage ? <Button className="rounded-xl" onClick={() => { if (!activeCriteria.length) { setTab('criteria'); toast('Cadastre os critérios antes de avaliar.'); return; } setCreating(true); }}><Plus className="mr-2 h-4 w-4" />Nova avaliação</Button> : null}
        </>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { l: tab === 'mine' ? 'Recebidas' : 'Avaliações', v: base.length },
          { l: 'Aguardando ciência', v: base.filter((e) => e.status === 'sent').length },
          { l: 'Concluídas', v: base.filter((e) => e.status === 'finalized').length },
          { l: 'Nota média', v: E.fmtScore(avg), sub: E.scaleLabel(avg) },
        ].map((k) => (
          <div key={k.l} className="ewvon-glass-panel rounded-2xl border border-white/80 p-4 shadow-[0_8px_30px_rgba(24,24,27,0.04)]">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{k.l}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{k.v}</p>
            {k.sub ? <p className="text-xs text-zinc-500">{k.sub}</p> : null}
          </div>
        ))}
      </div>

      {pendingMine && tab !== 'mine' ? (
        <button onClick={() => { setTab('mine'); setFilter('sent'); }} className="flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <Star className="h-4 w-4" /><span><b>{pendingMine} {pendingMine === 1 ? 'avaliação sua aguarda' : 'avaliações suas aguardam'}</b> sua ciência. Clique para ver.</span>
        </button>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {canManage ? (
          <div className="inline-flex w-fit rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
            {([['team', 'Equipe'], ['mine', 'Minhas'], ['criteria', 'Critérios']] as const).map(([id, label]) => (
              <button key={id} onClick={() => { setTab(id); setFilter('all'); }} className={cn('rounded-lg px-4 py-1.5 text-sm font-medium transition', tab === id ? 'bg-white text-foreground shadow-sm dark:bg-zinc-950' : 'text-zinc-500 hover:text-foreground')}>
                {label}{id === 'mine' && pendingMine ? <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[10px] text-white">{pendingMine}</span> : null}
              </button>
            ))}
          </div>
        ) : <div />}
        {tab !== 'criteria' ? (
          <label className="relative block w-full lg:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pessoa ou período" className="rounded-xl pl-9" />
          </label>
        ) : null}
      </div>

      {tab === 'criteria' ? (
        <CriteriaPanel criteria={criteria} userId={profile?.user_id || ''} onChange={load} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {FILTERS.filter((f) => tab === 'team' || f.id !== 'draft').map((f) => {
              const n = f.id === 'all' ? base.length : base.filter((e) => e.status === f.id).length;
              return <button key={f.id} onClick={() => setFilter(f.id)} className={cn('rounded-full border px-3 py-1 text-xs font-medium transition', filter === f.id ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800')}>{f.label} · {n}</button>;
            })}
          </div>
          {loading ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
          ) : !shown.length ? (
            <div className="ewvon-glass-panel flex flex-col items-center gap-2 rounded-2xl border border-white/80 px-6 py-14 text-center">
              <ClipboardCheck className="h-8 w-8 text-zinc-400" />
              <p className="font-medium text-foreground">{tab === 'mine' ? 'Você ainda não recebeu avaliações' : 'Nenhuma avaliação por aqui'}</p>
              <p className="max-w-sm text-sm text-zinc-500">{tab === 'mine' ? 'Quando seu gestor enviar uma avaliação, ela aparece aqui para você ler e dar ciência.' : 'Crie uma nova avaliação escolhendo a pessoa e os critérios.'}</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((e) => (
                <button key={e.id} onClick={() => setOpenId(e.id)} className="ewvon-glass-panel group flex flex-col gap-3 rounded-2xl border border-white/80 p-4 text-left shadow-[0_8px_30px_rgba(24,24,27,0.04)] transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900">{initials(tab === 'mine' ? e.evaluatorName : e.evaluatedName)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">{tab === 'mine' ? e.period : e.evaluatedName}</p>
                      <p className="truncate text-xs text-zinc-500">{tab === 'mine' ? `Avaliado por ${e.evaluatorName}` : [e.evaluatedSector, e.period].filter(Boolean).join(' · ')}</p>
                    </div>
                    <ScoreBadge v={e.score} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <StatusPill s={e.status} />
                    <span className="text-xs text-zinc-500">{new Date(e.sentAt || e.createdAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {creating && profile ? (
        <NewEvaluationDialog criteria={activeCriteria} meId={profile.id} onClose={() => setCreating(false)} onCreated={async (id) => { setCreating(false); await load(); setOpenId(id); }} />
      ) : null}
      {current && profile ? (
        <EvaluationDialog ev={current} meId={profile.id} canManage={canManage} isAdmin={isAdmin} onClose={() => setOpenId(null)} onChanged={load} />
      ) : null}
    </div>
  );
}

// ---------- new evaluation ----------
function NewEvaluationDialog({ criteria, meId, onClose, onCreated }: { criteria: Criterion[]; meId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [people, setPeople] = useState<{ id: string; name: string; sector: string }[]>([]);
  const [who, setWho] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [period, setPeriod] = useState(E.currentPeriod());
  const [sel, setSel] = useState<string[]>(criteria.map((c) => c.id));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any).from('profiles').select('id, name, display_name, sector_id').eq('is_active', true).order('name');
      const cid = getActiveCompanyId(); if (cid) query = query.eq('company_id', cid);
      const [{ data }, { data: secs }] = await Promise.all([query, supabase.from('sectors').select('id, name')]);
      const S = new Map((secs || []).map((s) => [s.id, s.name]));
      setPeople(((data || []) as { id: string; name: string; display_name: string | null; sector_id: string | null }[]).filter((p) => p.id !== meId).map((p) => ({ id: p.id, name: p.display_name || p.name, sector: (p.sector_id && S.get(p.sector_id)) || '' })));
    })();
  }, [meId]);

  const filtered = people.filter((p) => !q.trim() || (p.name + ' ' + p.sector).toLowerCase().includes(q.trim().toLowerCase()));
  const create = async () => {
    if (!who) return toast.error('Escolha quem será avaliado.');
    setBusy(true);
    try { onCreated(await E.createEvaluation({ evaluatedId: who, period, criteriaIds: sel, meProfileId: meId })); toast.success('Avaliação criada. Agora preencha as notas.'); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl rounded-3xl">
        <DialogHeader><DialogTitle>Nova avaliação</DialogTitle><DialogDescription>Escolha a pessoa, o período e os critérios. Você preenche as notas em seguida.</DialogDescription></DialogHeader>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label>1. Quem será avaliado</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pessoa" className="rounded-xl" />
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border p-1">
              {filtered.map((p) => (
                <button key={p.id} onClick={() => setWho(p.id)} className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm', who === p.id ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800')}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-semibold text-zinc-700">{initials(p.name)}</span>
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="truncate text-xs opacity-70">{p.sector}</span>
                </button>
              ))}
              {!filtered.length ? <p className="p-3 text-center text-xs text-zinc-500">Ninguém encontrado</p> : null}
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2"><Label>2. Período</Label><Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Ex.: 1º semestre de 2026" className="rounded-xl" /></div>
            <div className="space-y-2">
              <Label>3. Critérios ({sel.length})</Label>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border p-2">
                {criteria.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <Checkbox checked={sel.includes(c.id)} onCheckedChange={(v) => setSel((s) => (v ? [...s, c.id] : s.filter((x) => x !== c.id)))} />{c.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={onClose}>Cancelar</Button>
          <Button className="rounded-xl" disabled={busy || !who || !sel.length} onClick={() => void create()}>Criar e preencher</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- detail / fill / respond ----------
function EvaluationDialog({ ev, meId, canManage, isAdmin, onClose, onChanged }: { ev: EvalRow; meId: string; canManage: boolean; isAdmin: boolean; onClose: () => void; onChanged: () => Promise<void> }) {
  const [items, setItems] = useState<EvalItem[] | null>(null);
  const [feedback, setFeedback] = useState(ev.feedback || '');
  const [strengths, setStrengths] = useState(ev.strengths || '');
  const [improvements, setImprovements] = useState(ev.improvements || '');
  const [reply, setReply] = useState('');
  const [mode, setMode] = useState<'view' | 'review'>('view');
  const [busy, setBusy] = useState(false);
  const editable = (ev.evaluatorId === meId || isAdmin || canManage) && (ev.status === 'draft' || ev.status === 'contested') && ev.evaluatedId !== meId;
  const isEvaluated = ev.evaluatedId === meId;

  useEffect(() => { E.getItems(ev.id).then(setItems).catch((e) => toast.error((e as Error).message)); }, [ev.id]);

  const patch = (): E.DraftPatch => ({ items: (items || []).map((i) => ({ id: i.id, score: i.score, comment: i.comment })), feedback, strengths, improvements });
  const live = items?.filter((i) => i.score != null) || [];
  const liveAvg = live.length ? live.reduce((s, i) => s + (i.score || 0), 0) / live.length : null;
  const run = async (fn: () => Promise<unknown>, ok: string, close = true) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await onChanged(); if (close) onClose(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const report = () => { if (items && !openReport(E.evaluationReport({ ...ev, feedback, strengths, improvements, score: editable ? liveAvg : ev.score }, items))) toast.error('Permita pop-ups para abrir o relatório.'); };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-3xl">
        <DialogHeader>
          <div className="flex items-start gap-4 pr-6">
            <ScoreBadge v={editable ? liveAvg : ev.score} big />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-[.16em] text-zinc-500">{ev.period}</p>
              <DialogTitle className="mt-1 text-2xl">{ev.evaluatedName}</DialogTitle>
              <DialogDescription className="mt-1">{[ev.evaluatedSector, `Avaliador: ${ev.evaluatorName}`].filter(Boolean).join(' · ')}</DialogDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2"><StatusPill s={ev.status} />{(editable ? liveAvg : ev.score) != null ? <span className="text-xs text-zinc-500">{E.scaleLabel(editable ? liveAvg : ev.score)}</span> : null}</div>
            </div>
          </div>
        </DialogHeader>

        {ev.status === 'contested' && ev.evaluatedComment ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            <b>Pedido de revisão:</b> {ev.evaluatedComment}
          </div>
        ) : null}

        {!items ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div> : (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Critérios</p>
            {items.map((it, idx) => (
              <div key={it.id} className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{it.name}</p>
                    {it.description ? <p className="text-xs text-zinc-500">{it.description}</p> : null}
                  </div>
                  {editable ? (
                    <div className="flex shrink-0 gap-1">
                      {E.SCALE.map((s) => (
                        <button key={s.v} title={s.label} aria-pressed={it.score === s.v} onClick={() => setItems((xs) => xs!.map((x, i) => (i === idx ? { ...x, score: s.v } : x)))}
                          style={it.score === s.v ? { background: SOLID[E.scoreTone(s.v)], color: '#fff', boxShadow: `0 6px 16px -6px ${SOLID[E.scoreTone(s.v)]}` } : undefined}
                          className={cn('h-9 w-9 rounded-xl text-sm font-semibold transition', it.score === s.v ? 'scale-105' : 'text-zinc-500 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:ring-zinc-700 dark:hover:bg-zinc-800')}>{s.v}</button>
                      ))}
                    </div>
                  ) : (
                    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ring-1', TONE_CLS[E.scoreTone(it.score)])}>{it.score ?? '—'} <span className="text-xs font-medium opacity-80">{E.scaleLabel(it.score)}</span></span>
                  )}
                </div>
                {editable ? (
                  <Input className="mt-2 rounded-xl" placeholder="Comentário sobre este critério (opcional)" value={it.comment || ''} onChange={(e) => setItems((xs) => xs!.map((x, i) => (i === idx ? { ...x, comment: e.target.value } : x)))} />
                ) : it.comment ? <p className="mt-2 rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">{it.comment}</p> : null}
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <FeedbackField label="Pontos fortes" value={strengths} onChange={setStrengths} editable={editable} placeholder="O que essa pessoa faz muito bem" />
          <FeedbackField label="Pontos a desenvolver" value={improvements} onChange={setImprovements} editable={editable} placeholder="O que pode melhorar e como" />
        </div>
        <FeedbackField label="Feedback geral" value={feedback} onChange={setFeedback} editable={editable} placeholder="Mensagem final para o colaborador (obrigatório para enviar)" rows={4} />

        {ev.status === 'finalized' && ev.evaluatedComment ? <FeedbackField label="Comentário do colaborador" value={ev.evaluatedComment} editable={false} /> : null}
        {ev.status === 'finalized' && ev.finishedAt ? <p className="text-xs text-zinc-500"><Check className="mr-1 inline h-3.5 w-3.5" />Ciência dada em {new Date(ev.finishedAt).toLocaleString('pt-BR')}</p> : null}

        {isEvaluated && ev.status === 'sent' ? (
          <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
            <p className="text-sm font-semibold text-foreground">{mode === 'review' ? 'O que precisa ser revisado?' : 'Sua resposta'}</p>
            <Textarea rows={3} className="rounded-xl bg-background" value={reply} onChange={(e) => setReply(e.target.value)} placeholder={mode === 'review' ? 'Explique o que você não concorda (obrigatório)' : 'Comentário opcional para o avaliador'} />
          </div>
        ) : null}

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex gap-2">
            {items?.length ? <Button variant="outline" className="rounded-xl" onClick={report}><FileText className="mr-2 h-4 w-4" />PDF</Button> : null}
            {(isAdmin || (ev.evaluatorId === meId && ev.status === 'draft')) ? <Button variant="ghost" className="rounded-xl text-rose-600" disabled={busy} onClick={() => { if (window.confirm('Excluir esta avaliação?')) void run(() => E.deleteEvaluation(ev.id), 'Avaliação excluída'); }}><Trash2 className="mr-2 h-4 w-4" />Excluir</Button> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {editable ? <>
              <Button variant="outline" className="rounded-xl" disabled={busy || !items} onClick={() => void run(() => E.saveDraft(ev.id, patch()), 'Rascunho salvo', false)}><Save className="mr-2 h-4 w-4" />Salvar rascunho</Button>
              <Button className="rounded-xl" disabled={busy || !items} onClick={() => void run(() => E.sendEvaluation(ev, patch(), meId), ev.status === 'contested' ? 'Avaliação reenviada' : 'Avaliação enviada ao colaborador')}><Send className="mr-2 h-4 w-4" />{ev.status === 'contested' ? 'Reenviar' : 'Enviar ao colaborador'}</Button>
            </> : null}
            {isEvaluated && ev.status === 'sent' ? (mode === 'view' ? <>
              <Button variant="outline" className="rounded-xl" onClick={() => setMode('review')}><RotateCcw className="mr-2 h-4 w-4" />Pedir revisão</Button>
              <Button className="rounded-xl" disabled={busy} onClick={() => void run(() => E.respondEvaluation(ev.id, true, reply), 'Ciência registrada')}><Check className="mr-2 h-4 w-4" />Dar ciência</Button>
            </> : <>
              <Button variant="outline" className="rounded-xl" onClick={() => setMode('view')}>Voltar</Button>
              <Button className="rounded-xl" disabled={busy || !reply.trim()} onClick={() => void run(() => E.respondEvaluation(ev.id, false, reply), 'Pedido de revisão enviado')}><Send className="mr-2 h-4 w-4" />Enviar pedido</Button>
            </>) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FeedbackField({ label, value, onChange, editable, placeholder, rows = 3 }: { label: string; value: string; onChange?: (v: string) => void; editable: boolean; placeholder?: string; rows?: number }) {
  if (!editable && !value) return null;
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold">{label}</Label>
      {editable ? <Textarea rows={rows} className="rounded-xl" value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} />
        : <p className="whitespace-pre-wrap rounded-2xl bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">{value}</p>}
    </div>
  );
}

// ---------- criteria ----------
function CriteriaPanel({ criteria, userId, onChange }: { criteria: Criterion[]; userId: string; onChange: () => Promise<void> }) {
  const [edit, setEdit] = useState<{ id?: string; name: string; description: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); setEdit(null); await onChange(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <div className="ewvon-glass-panel flex flex-col gap-3 rounded-2xl border border-white/80 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-foreground">Critérios de avaliação</p>
          <p className="text-sm text-zinc-500">São os itens que recebem nota de 1 a 5. Ao criar uma avaliação você escolhe quais usar.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl" disabled={busy} onClick={() => void run(async () => { const n = await E.addSuggestedCriteria(userId, criteria.map((c) => c.name)); if (!n) throw new Error('Os critérios sugeridos já foram adicionados.'); }, 'Critérios sugeridos adicionados')}><Sparkles className="mr-2 h-4 w-4" />Usar sugeridos</Button>
          <Button className="rounded-xl" onClick={() => setEdit({ name: '', description: '' })}><Plus className="mr-2 h-4 w-4" />Novo critério</Button>
        </div>
      </div>
      {!criteria.length ? <p className="py-10 text-center text-sm text-zinc-500">Nenhum critério ainda. Clique em <b>Usar sugeridos</b> para começar rápido.</p> : null}
      <div className="grid gap-2 md:grid-cols-2">
        {criteria.map((c) => (
          <div key={c.id} className={cn('flex items-start gap-3 rounded-2xl border border-zinc-200 bg-background p-3 dark:border-zinc-800', !c.is_active && 'opacity-60')}>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{c.name}{!c.is_active ? <span className="ml-2 text-xs text-zinc-500">(desativado)</span> : null}</p>
              {c.description ? <p className="text-xs text-zinc-500">{c.description}</p> : null}
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" title="Editar" onClick={() => setEdit({ id: c.id, name: c.name, description: c.description || '' })}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" title={c.is_active ? 'Desativar' : 'Ativar'} disabled={busy} onClick={() => void run(() => E.setCriterionActive(c.id, !c.is_active), c.is_active ? 'Critério desativado' : 'Critério ativado')}>{c.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
          </div>
        ))}
      </div>
      {edit ? (
        <Dialog open onOpenChange={(o) => { if (!o) setEdit(null); }}>
          <DialogContent className="max-w-md rounded-3xl">
            <DialogHeader><DialogTitle>{edit.id ? 'Editar critério' : 'Novo critério'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Nome</Label><Input className="rounded-xl" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Ex.: Atendimento ao cliente" /></div>
              <div className="space-y-1.5"><Label>O que é avaliado</Label><Textarea className="rounded-xl" rows={3} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} placeholder="Explique em uma frase" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-xl" onClick={() => setEdit(null)}>Cancelar</Button>
              <Button className="rounded-xl" disabled={busy || !edit.name.trim()} onClick={() => void run(() => E.saveCriterion(edit, userId), 'Critério salvo')}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
