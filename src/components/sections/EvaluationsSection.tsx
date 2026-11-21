// "Avaliações" tab — simple performance evaluations.
// Gestores (admin/gerente/supervisor/diretoria) criam avaliações a partir de uma
// lista de critérios, dão nota de 1 a 5 em cada um e escrevem o feedback.
// O colaborador recebe, lê e dá ciência (ou pede revisão). Logic in src/lib/evaluations.ts.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Plus, Search, FileText, Send, Save, Trash2, Check, RotateCcw, Pencil, Sparkles, Star, Eye, EyeOff, TrendingUp, TrendingDown, Download, Loader2 } from 'lucide-react';
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
import { appConfirm } from '@/lib/appDialog';
import { downloadEvaluationPdf } from '@/lib/evalDocument';
import { CriteriaModelPanel } from '@/components/evaluations/CriteriaModelPanel';
import { FORM_TYPES, formTypeLabel, type FormType } from '@/lib/evalPresets';
import { brDate, contractDates, daysSinceAdmission, getEmployeeRecord, type EmployeeRecord } from '@/lib/employeeRecord';
import { Sel } from '@/components/ui/Sel';
import { ExportMenu } from '@/components/ui/ExportMenu';

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
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'team' | 'mine' | 'criteria'>(canManage ? 'team' : 'mine');
  const [filter, setFilter] = useState<'all' | EvalStatus>('all');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await E.listEvaluations());
    } catch (e) { toast.error((e as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const mine = useMemo(() => list.filter((e) => e.evaluatedId === profile?.id && e.status !== 'draft'), [list, profile?.id]);
  const team = useMemo(() => list.filter((e) => e.evaluatedId !== profile?.id), [list, profile?.id]);
  const base = tab === 'mine' ? mine : team;
  const shown = base.filter((e) => (filter === 'all' || e.status === filter) && (!q.trim() || [e.evaluatedName, e.evaluatorName, e.period, e.evaluatedSector || ''].some((x) => x.toLowerCase().includes(q.trim().toLowerCase()))));
  const scored = base.filter((e) => e.score != null && e.status !== 'draft');
  const avg = scored.length ? scored.reduce((s, e) => s + (e.score || 0), 0) / scored.length : null;
  const pendingMine = mine.filter((e) => e.status === 'sent').length;
  const current = list.find((e) => e.id === openId) || null;

  const [periodF, setPeriodF] = useState('all');
  const [recs, setRecs] = useState<Record<string, EmployeeRecord | null>>({});
  const periods = useMemo(() => Array.from(new Set(base.map((e) => e.period).filter(Boolean))), [base]);
  const shown2 = shown.filter((e) => periodF === 'all' || e.period === periodF);
  // Dias de experiência vêm da data de admissão (dado protegido): busca só das pessoas em avaliação de experiência que aparecem na lista.
  const needIds = useMemo(() => Array.from(new Set(shown2.filter((e) => e.kind === 'experience').map((e) => e.evaluatedId))).filter((id) => !(id in recs)).slice(0, 40), [shown2, recs]);
  useEffect(() => {
    if (!needIds.length || !canManage) return;
    let live = true;
    Promise.all(needIds.map((id) => getEmployeeRecord(id).then((r) => [id, r] as const).catch(() => [id, null] as const))).then((rs) => { if (live) setRecs((prev) => ({ ...prev, ...Object.fromEntries(rs) })); });
    return () => { live = false; };
  }, [needIds, canManage]);

  const chipCls: Record<EvalStatus, string> = { draft: 'dk-c-n', sent: 'dk-c-a', contested: 'dk-c-r', finalized: 'dk-c-g' };
  const scoreCls = (v: number | null) => (v == null ? 'nn' : v >= 4 ? 'g' : v >= 3 ? 'b' : 'nn');
  const COLORS = ['#DDE6F8', '#F6E3D3', '#DCEBDD', '#F3DDE6', '#E4DDF3'];
  const tint = (n: string) => COLORS[Array.from(n).reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
  const phaseLabel = (e: EvalRow) => (e.formType === 'exp45' ? '1º período · 45 dias' : e.formType === 'exp90' ? '2º período · 90 dias' : e.formType ? formTypeLabel(e.formType) : e.period);
  const expCell = (e: EvalRow) => {
    if (e.kind !== 'experience') return <span>—</span>;
    const r = recs[e.evaluatedId]; const d = r ? daysSinceAdmission(r) : null;
    if (r == null || d == null) return <span>—</span>;
    const end = brDate(contractDates(r).end2).slice(0, 5);
    return <div><div className="dk-pr"><div className="dk-rb w90"><i style={{ width: `${Math.max(0, Math.min(100, (d / 90) * 100))}%` }} /></div>Dia {Math.min(d, 90)} de 90</div><div className="dk-sub">{d >= 90 ? `Encerrada em ${end}` : `Termina em ${end}`}</div></div>;
  };

  return (
    <div className="dk-pg">
      <div className="dk-top">
        {canManage ? (
          <div className="dk-seg" role="group" aria-label="Visão">
            {([['team', 'Equipe'], ['mine', 'Minhas'], ['criteria', 'Critérios']] as const).map(([id, label]) => (
              <button key={id} aria-pressed={tab === id} className={tab === id ? 'on' : ''} onClick={() => { setTab(id); setFilter('all'); setPeriodF('all'); }}>{label}{id === 'mine' && pendingMine ? ` (${pendingMine})` : ''}</button>
            ))}
          </div>
        ) : <div className="dk-ti" style={{ fontSize: 16 }}>Minhas avaliações</div>}
        <div className="dk-flt">
          {base.length && tab !== 'criteria' ? <button className="dk-btn" onClick={() => { if (!openReport(E.summaryReport(base, tab === 'mine' ? 'Minhas avaliações' : 'Avaliações da equipe'))) toast.error('Permita pop-ups para abrir o relatório.'); }}><FileText size={15} />Relatório</button> : null}
          {canManage ? <button className="dk-btn pri" onClick={() => setCreating(true)}><Plus size={15} />Nova avaliação</button> : null}
        </div>
      </div>

      {tab !== 'criteria' ? (
        <div className="dk-kp">
          <div className="dk-k"><i className="dk-dt" style={{ background: 'hsl(var(--primary))' }} /><span className="l">{tab === 'mine' ? 'Recebidas' : 'Avaliações'}</span><span className="v">{base.length}</span></div>
          <div className="dk-k"><i className="dk-dt" style={{ background: '#B7791F' }} /><span className="l">Aguardando ciência</span><span className="v">{base.filter((e) => e.status === 'sent').length}</span></div>
          <div className="dk-k"><i className="dk-dt" style={{ background: '#0A6B3D' }} /><span className="l">Concluídas</span><span className="v">{base.filter((e) => e.status === 'finalized').length}</span></div>
          <div className="dk-k"><span className="l">Nota média</span><span className="v">{E.fmtScore(avg)}</span>{avg != null ? <span className="s">{E.scaleLabel(avg)}</span> : null}</div>
        </div>
      ) : null}

      {pendingMine && tab !== 'mine' ? (
        <button onClick={() => { setTab('mine'); setFilter('sent'); }} className="dk-err" style={{ background: '#FEF5E4', borderColor: '#E3C48F', color: '#7A4300', textAlign: 'left', cursor: 'pointer' }}>
          <Star size={16} /><span><b>{pendingMine} {pendingMine === 1 ? 'avaliação sua aguarda' : 'avaliações suas aguardam'}</b> sua ciência. Clique para ver.</span>
        </button>
      ) : null}

      {tab === 'criteria' ? <div className="dk-panel dk-pad"><CriteriaModelPanel isAdmin={isAdmin} /></div> : (
        <div className="dk-panel">
          <div className="dk-bar">
            <div className="dk-tabs" role="group" aria-label="Situação">
              {FILTERS.filter((f) => tab === 'team' || f.id !== 'draft').map((f) => {
                const n = f.id === 'all' ? base.length : base.filter((e) => e.status === f.id).length;
                return <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)} className={`dk-tab${filter === f.id ? ' on' : ''}`}>{f.label}<b>{n}</b></button>;
              })}
            </div>
            <div className="dk-flt">
              <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pessoa ou período" aria-label="Buscar pessoa ou período" />
              <Sel aria-label="Período" value={periodF} onChange={(e) => setPeriodF(e.target.value)}><option value="all">Período: todos</option>{periods.map((p) => <option key={p} value={p}>{p}</option>)}</Sel>
              <ExportMenu className="dk-btn" disabled={!shown2.length} getData={() => ({ name: 'avaliacoes', sheet: 'Avaliações', headers: ['Colaborador', 'Setor', 'Avaliador', 'Período', 'Nota', 'Conceito', 'Situação', 'Data'],
                rows: shown2.map((e) => [e.evaluatedName, e.evaluatedSector || '', e.evaluatorName, phaseLabel(e), e.score != null ? E.fmtScore(e.score) : '', e.score != null ? E.scaleLabel(e.score) : '', E.STATUS_LABEL[e.status], new Date(e.sentAt || e.createdAt).toLocaleDateString('pt-BR')]) })} />
            </div>
          </div>
          {loading ? <div style={{ padding: 24 }}><Skeleton className="h-14 w-full" /><Skeleton className="mt-3 h-14 w-full" /><Skeleton className="mt-3 h-14 w-full" /></div>
            : !shown2.length ? <div className="dk-empty"><b>{tab === 'mine' ? 'Você ainda não recebeu avaliações' : 'Nenhuma avaliação por aqui'}</b><div className="dk-sub" style={{ marginTop: 6 }}>{tab === 'mine' ? 'Quando seu gestor enviar uma avaliação, ela aparece aqui para você ler e dar ciência.' : 'Crie uma nova avaliação escolhendo a pessoa da sua equipe e o tipo (experiência ou desenvolvimento).'}</div></div>
            : (
              <div className="dk-scroll"><table className="dk-table">
                <thead><tr><th>{tab === 'mine' ? 'Avaliador' : 'Colaborador'}</th><th>Período avaliado</th><th>Experiência</th><th>Nota</th><th>Situação</th><th>Data</th><th style={{ width: 96 }} /></tr></thead>
                <tbody>
                  {shown2.map((e) => {
                    const who = tab === 'mine' ? e.evaluatorName : e.evaluatedName;
                    return (
                      <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => setOpenId(e.id)}>
                        <td><div className="dk-pe"><div className="dk-av sm" style={{ background: tint(who) }}>{(tab !== 'mine' && e.evaluatedAvatar) ? <img src={e.evaluatedAvatar} alt="" /> : initials(who)}</div><div><div className="dk-ti">{who}</div><div className="dk-su">{tab === 'mine' ? 'Gestor' : e.evaluatedSector || '—'}</div></div></div></td>
                        <td><div className="dk-ti" style={{ fontSize: 13.5 }}>{phaseLabel(e)}</div><div className="dk-su">Avaliador: {e.evaluatorName}</div></td>
                        <td>{expCell(e)}</td>
                        <td><div className="dk-nt"><span className={`dk-sc ${scoreCls(e.score)}`}>{E.fmtScore(e.score)}</span><span className="dk-cl">{e.score != null ? E.scaleLabel(e.score) : 'Sem nota'}</span></div></td>
                        <td><span className={`dk-chp ${chipCls[e.status]}`}>{E.STATUS_LABEL[e.status]}</span></td>
                        <td>{new Date(e.sentAt || e.createdAt).toLocaleDateString('pt-BR')}</td>
                        <td className="dk-ac"><button className="dk-ic" aria-label="Ver" onClick={(ev) => { ev.stopPropagation(); setOpenId(e.id); }}><Eye size={17} /></button>{canManage && e.status === 'draft' ? <button className="dk-ic" aria-label="Editar" onClick={(ev) => { ev.stopPropagation(); setOpenId(e.id); }}><Pencil size={17} /></button> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            )}
          <div className="dk-ft"><span>Exibindo {shown2.length} de {base.length} avaliações</span><span>Notas de 1 a 5 · Supera a partir de 4,0</span></div>
        </div>
      )}

      {creating && profile ? (
        <NewEvaluationDialog meId={profile.id} onClose={() => setCreating(false)} onCreated={async (id) => { setCreating(false); await load(); setOpenId(id); }} />
      ) : null}
      {current && profile ? (
        <EvaluationDialog ev={current} meId={profile.id} canManage={canManage} isAdmin={isAdmin} onClose={() => setOpenId(null)} onChanged={load} />
      ) : null}
    </div>
  );
}

// ---------- new evaluation ----------
function NewEvaluationDialog({ meId, onClose, onCreated }: { meId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [people, setPeople] = useState<{ id: string; name: string; sector: string }[] | null>(null);
  const [who, setWho] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [period, setPeriod] = useState(E.currentPeriod());
  const [formType, setFormType] = useState<FormType | null>(null);
  const [hint, setHint] = useState<string>('');
  const [prev, setPrev] = useState<E.PreviousScores | null | undefined>(undefined);
  const [existing, setExisting] = useState<{ form_type: string; status: string }[]>([]);
  const [devModel, setDevModel] = useState<E.ModelCriterion[]>([]);
  const [selCrit, setSelCrit] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const blocked = useMemo(() => E.blockedFormTypes(existing), [existing]);

  useEffect(() => { E.listTeamPeople().then(setPeople).catch((e) => { toast.error((e as Error).message); setPeople([]); }); }, []);

  // Picking the person suggests the form from the admission date (experience until 90 days, development after).
  useEffect(() => {
    if (!who) return;
    setHint(''); setPrev(undefined); setExisting([]);
    void (async () => {
      const ex = await E.personForms(who); setExisting(ex);
      const bl = E.blockedFormTypes(ex);
      const rec = await getEmployeeRecord(who);
      const d = daysSinceAdmission(rec);
      if (d == null) { setHint('Data de admissão não cadastrada: escolha o tipo manualmente.'); setFormType((cur) => (cur && bl[cur] ? null : cur)); return; }
      if (d <= 90 && !bl.exp45 && !bl.exp90) { setFormType(d <= 52 && !bl.exp45 ? 'exp45' : 'exp90'); setHint(`Admitido há ${d} dia(s): ainda no contrato de experiência (${contractDates(rec).end1 ? 'sugestão: ' + (d <= 52 ? '45' : '90') + ' dias' : ''}).`); }
      else { setFormType(d <= 150 ? 'devPos' : 'devSemestral'); setHint(d > 90 ? `Admitido há ${d} dias: já passou da experiência, use a avaliação de desenvolvimento.` : 'As avaliações de experiência desta pessoa já foram feitas: use as de desenvolvimento (pós-experiência).'); }
    })();
  }, [who]);
  useEffect(() => {
    if (!formType || !formType.startsWith('dev')) return;
    void E.listModel('development').then((m) => { setDevModel(m); setSelCrit(m.map((c) => c.id)); }).catch((e) => toast.error((e as Error).message));
  }, [formType]);
  useEffect(() => { setPrev(undefined); if (who && formType === 'exp90') void E.previousExperienceScores(who).then(setPrev); }, [who, formType]);

  const filtered = (people || []).filter((p) => !q.trim() || (p.name + ' ' + p.sector).toLowerCase().includes(q.trim().toLowerCase()));
  const create = async () => {
    if (!who || !formType) return toast.error('Escolha a pessoa e o tipo da avaliação.');
    setBusy(true);
    try { onCreated(await E.createEvaluation({ evaluatedId: who, formType, period, meProfileId: meId, criteriaIds: formType.startsWith('dev') ? selCrit : undefined })); toast.success('Avaliação criada. Agora preencha as notas.'); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const groupBtn = (kind: 'experience' | 'development', title: string) => (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {FORM_TYPES.filter((f) => f.kind === kind).map((f) => (
          <button key={f.id} type="button" aria-pressed={formType === f.id} disabled={!!blocked[f.id]} title={blocked[f.id]} onClick={() => setFormType(f.id)}
            className={cn('rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through', formType === f.id ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900' : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800')}>{f.label}</button>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl rounded-3xl">
        <DialogHeader><DialogTitle>Nova avaliação</DialogTitle><DialogDescription>Só o gestor da equipe pode avaliar quem está nela. Escolha a pessoa e o tipo; os critérios e o PDF seguem o modelo padrão.</DialogDescription></DialogHeader>
        {people && !people.length ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">Você não é gestor de nenhuma equipe com pessoas. Para avaliar alguém, a pessoa precisa estar numa equipe que você lidera (Gestão &gt; Equipes).</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label>1. Quem será avaliado (sua equipe)</Label>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pessoa" className="rounded-xl" />
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border p-1">
                {!people ? <p className="p-3 text-center text-xs text-zinc-500">Carregando…</p> : filtered.map((p) => (
                  <button key={p.id} onClick={() => setWho(p.id)} className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm', who === p.id ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800')}>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-semibold text-zinc-700">{initials(p.name)}</span>
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="truncate text-xs opacity-70">{p.sector}</span>
                  </button>
                ))}
                {people && !filtered.length ? <p className="p-3 text-center text-xs text-zinc-500">Ninguém encontrado</p> : null}
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>2. Tipo da avaliação</Label>
                {groupBtn('experience', 'Contrato de experiência')}
                {groupBtn('development', 'Desempenho e desenvolvimento')}
                {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
                {Object.keys(blocked).length ? <p className="text-xs text-amber-700 dark:text-amber-300">{blocked.exp90 ? 'A avaliação de 90 dias desta pessoa já foi feita: só avaliações de desenvolvimento (pós-experiência).' : 'A avaliação de 45 dias desta pessoa já foi feita.'}</p> : null}
                {formType === 'exp90' && prev === null ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">Não há avaliação de 45 dias enviada para esta pessoa: a comparação de evolução não vai aparecer.</p> : null}
                {formType === 'exp90' && prev ? <p className="rounded-xl bg-zinc-100 p-2 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">Vamos comparar com a avaliação de 45 dias (média {E.fmtScore(prev.average)}).</p> : null}
              </div>
              {formType?.startsWith('dev') && devModel.length ? (
                <div className="space-y-2">
                  <Label>3. Critérios ({selCrit.length})</Label>
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border p-2">
                    {devModel.map((c) => (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                        <Checkbox checked={selCrit.includes(c.id)} onCheckedChange={(v) => setSelCrit((x) => (v ? [...x, c.id] : x.filter((i) => i !== c.id)))} />{c.name}
                      </label>
                    ))}
                  </div>
                </div>
              ) : formType ? <p className="rounded-xl bg-zinc-100 p-2 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">Os critérios da avaliação de experiência seguem o modelo cadastrado pelo administrador da empresa.</p> : null}
              <div className="space-y-2"><Label>{formType?.startsWith('dev') ? '4' : '3'}. Período</Label><Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Ex.: 1º semestre de 2026" className="rounded-xl" /></div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={onClose}>Cancelar</Button>
          <Button className="rounded-xl" disabled={busy || !who || !formType || (formType.startsWith('dev') && !selCrit.length)} onClick={() => void create()}>Criar e preencher</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Evolution({ prev, cur }: { prev: number; cur: number | null }) {
  const d = cur == null ? 0 : cur - prev;
  return (
    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-zinc-500" title="Evolução desde a avaliação de 45 dias">
      <div className="w-24 space-y-0.5">
        <div className="flex items-center gap-1"><div className="h-1.5 rounded-full bg-zinc-300" style={{ width: `${(prev / 5) * 100}%` }} /><span>{prev}</span></div>
        <div className="flex items-center gap-1"><div className="h-1.5 rounded-full bg-zinc-900 dark:bg-white" style={{ width: `${((cur ?? 0) / 5) * 100}%` }} /><span className="font-semibold text-foreground">{cur ?? '–'}</span></div>
      </div>
      {cur != null ? <span className={cn('font-semibold', d > 0 ? 'text-emerald-600' : d < 0 ? 'text-amber-600' : 'text-zinc-500')}>{d > 0 ? `▲ +${d}` : d < 0 ? `▼ −${Math.abs(d)}` : '= igual'}</span> : null}
      <span>45 dias → agora</span>
    </div>
  );
}

function EvaluationDialog({ ev, meId, canManage, isAdmin, onClose, onChanged }: { ev: EvalRow; meId: string; canManage: boolean; isAdmin: boolean; onClose: () => void; onChanged: () => Promise<void> }) {
  const [items, setItems] = useState<EvalItem[] | null>(null);
  const [feedback, setFeedback] = useState(ev.feedback || '');
  const [strengths, setStrengths] = useState(ev.strengths || '');
  const [improvements, setImprovements] = useState(ev.improvements || '');
  const [reply, setReply] = useState('');
  const [mode, setMode] = useState<'view' | 'review'>('view');
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [prev, setPrev] = useState<E.PreviousScores | null>(null);
  const editable = (ev.evaluatorId === meId || isAdmin || canManage) && (ev.status === 'draft' || ev.status === 'contested') && ev.evaluatedId !== meId;
  const isEvaluated = ev.evaluatedId === meId;

  useEffect(() => { E.getItems(ev.id, ev.kind).then(setItems).catch((e) => toast.error((e as Error).message)); }, [ev.id, ev.kind]);
  useEffect(() => { if (ev.formType === 'exp90') void E.previousExperienceScores(ev.evaluatedId).then(setPrev); }, [ev.formType, ev.evaluatedId]);

  const patch = (): E.DraftPatch => ({ items: (items || []).map((i) => ({ id: i.id, score: i.score, comment: i.comment })), feedback, strengths, improvements });
  const live = items?.filter((i) => i.score != null) || [];
  const liveAvg = live.length ? live.reduce((s, i) => s + (i.score || 0), 0) / live.length : null;
  const run = async (fn: () => Promise<unknown>, ok: string, close = true) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await onChanged(); if (close) onClose(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const report = async () => {
    if (!items) return;
    setPdfBusy(true);
    try { await downloadEvaluationPdf(ev, items, { items, feedback, strengths, improvements, average: editable ? liveAvg : ev.score }); toast.success('PDF gerado.'); if (cmp) toast(cmp.delta > 0.04 ? `Evolução: a média subiu ${E.fmtScore(Math.abs(cmp.delta))} desde os 45 dias.` : cmp.delta < -0.04 ? `Atenção: a média caiu ${E.fmtScore(Math.abs(cmp.delta))} desde os 45 dias.` : 'A média ficou igual à dos 45 dias.'); }
    catch (e) { console.error(e); toast.error('Não foi possível gerar o PDF.'); } finally { setPdfBusy(false); }
  };
  const curAvg = editable ? liveAvg : ev.score;
  const cmp = prev && prev.average != null && curAvg != null ? { prev: prev.average, cur: curAvg, delta: curAvg - prev.average } : null;
  const prevOf = (name: string) => prev?.items.find((i) => i.name === name)?.score ?? null;
  const send = async () => {
    if (cmp && cmp.delta < -0.04 && !(await appConfirm({ title: 'A média ficou menor que a de 45 dias', message: `A média atual (${E.fmtScore(cmp.cur)}) é menor que a da avaliação de 45 dias (${E.fmtScore(cmp.prev)}). Deseja enviar mesmo assim?`, confirmText: 'Enviar mesmo assim' }))) return;
    await run(() => E.sendEvaluation(ev, patch(), meId), ev.status === 'contested' ? 'Avaliação reenviada' : 'Avaliação enviada ao colaborador');
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-3xl">
        <DialogHeader>
          <div className="flex items-start gap-4 pr-6">
            <ScoreBadge v={editable ? liveAvg : ev.score} big />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-[.16em] text-zinc-500">{[ev.formType ? (ev.kind === 'experience' ? 'Experiência' : 'Desenvolvimento') + ' · ' + formTypeLabel(ev.formType) : '', ev.period].filter(Boolean).join(' · ')}</p>
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

        {cmp ? (
          <div className={cn('flex items-center gap-3 rounded-2xl border p-3 text-sm', cmp.delta < -0.04 ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100' : cmp.delta > 0.04 ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100' : 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300')}>
            {cmp.delta < -0.04 ? <TrendingDown className="h-5 w-5 shrink-0" /> : <TrendingUp className="h-5 w-5 shrink-0" />}
            <span><b>{cmp.delta < -0.04 ? 'Atenção: a média está menor que a de 45 dias' : cmp.delta > 0.04 ? 'A média está maior que a de 45 dias' : 'A média está igual à de 45 dias'}</b> · 45 dias: {E.fmtScore(cmp.prev)} → agora: {E.fmtScore(cmp.cur)} ({cmp.delta >= 0 ? '+' : '−'}{E.fmtScore(Math.abs(cmp.delta))})</span>
          </div>
        ) : ev.formType === 'exp90' && !prev ? <p className="rounded-2xl border border-zinc-200 p-3 text-xs text-zinc-500 dark:border-zinc-700">Não há avaliação de 45 dias enviada para comparar.</p> : null}

        {!items ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div> : (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Critérios</p>
            {items.map((it, idx) => (
              <div key={it.id} className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{it.name}</p>
                    {it.description ? <p className="text-xs text-zinc-500">{it.description}</p> : null}
                    {prev && prevOf(it.name) != null ? <Evolution prev={prevOf(it.name)!} cur={it.score} /> : null}
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
            {items?.length ? <Button variant="outline" className="rounded-xl" disabled={pdfBusy} onClick={() => void report()}>{pdfBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}PDF</Button> : null}
            {(isAdmin || (ev.evaluatorId === meId && ev.status === 'draft')) ? <Button variant="ghost" className="rounded-xl text-rose-600" disabled={busy} onClick={async () => { if (await appConfirm({ title: 'Excluir esta avaliação?', message: 'Esta ação não pode ser desfeita.', confirmText: 'Excluir', danger: true })) void run(() => E.deleteEvaluation(ev.id), 'Avaliação excluída'); }}><Trash2 className="mr-2 h-4 w-4" />Excluir</Button> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {editable ? <>
              <Button variant="outline" className="rounded-xl" disabled={busy || !items} onClick={() => void run(() => E.saveDraft(ev.id, patch()), 'Rascunho salvo', false)}><Save className="mr-2 h-4 w-4" />Salvar rascunho</Button>
              <Button className="rounded-xl" disabled={busy || !items} onClick={() => void send()}><Send className="mr-2 h-4 w-4" />{ev.status === 'contested' ? 'Reenviar' : 'Enviar ao colaborador'}</Button>
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
