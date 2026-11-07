// Performance evaluations — shared logic for the desktop tab and the mobile app.
// Flow: Rascunho (avaliador preenche) → Aguardando ciência (colaborador lê)
//   → Concluída (colaborador deu ciência)   ou   → Revisão pedida → avaliador ajusta e reenvia.
// Each criterion gets a 1–5 score; the overall score is the average (computed by a DB trigger).
import { supabase } from '@/integrations/supabase/client';
import { withCompany } from '@/lib/companyScope';
import type { ReportSpec, Tone } from '@/lib/reports';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type EvalStatus = 'draft' | 'sent' | 'contested' | 'finalized';

export interface Criterion { id: string; name: string; description: string | null; is_active: boolean }
export interface EvalItem { id: string; competency_id: string; name: string; description: string | null; score: number | null; comment: string | null }
export interface EvalRow {
  id: string; status: EvalStatus;
  evaluatorId: string; evaluatorName: string;
  evaluatedId: string; evaluatedName: string; evaluatedSector: string | null; evaluatedAvatar: string | null;
  period: string; score: number | null;
  feedback: string | null; strengths: string | null; improvements: string | null;
  evaluatedComment: string | null;
  createdAt: string; sentAt: string | null; finishedAt: string | null; version: number;
}

export const STATUS_LABEL: Record<EvalStatus, string> = { draft: 'Rascunho', sent: 'Aguardando ciência', contested: 'Revisão pedida', finalized: 'Concluída' };
export const STATUS_TONE: Record<EvalStatus, Tone> = { draft: 'neutral', sent: 'warn', contested: 'bad', finalized: 'good' };

export const SCALE = [
  { v: 1, label: 'Insuficiente' },
  { v: 2, label: 'Abaixo do esperado' },
  { v: 3, label: 'Atende' },
  { v: 4, label: 'Supera' },
  { v: 5, label: 'Excepcional' },
];
export const scaleLabel = (v: number | null | undefined) => (v ? SCALE.find((s) => s.v === Math.round(v))?.label ?? '' : '');
export const scoreTone = (v: number | null | undefined): Tone => (v == null ? 'neutral' : v >= 4 ? 'good' : v >= 3 ? 'info' : v >= 2 ? 'warn' : 'bad');
export const fmtScore = (v: number | null | undefined) => (v == null ? '—' : Number(v).toFixed(1).replace('.', ','));

export const SUGGESTED_CRITERIA: { name: string; description: string }[] = [
  { name: 'Qualidade do trabalho', description: 'Entregas corretas, caprichadas e sem retrabalho.' },
  { name: 'Produtividade e prazos', description: 'Cumpre o combinado no tempo certo.' },
  { name: 'Comunicação', description: 'Se expressa com clareza e mantém todos informados.' },
  { name: 'Trabalho em equipe', description: 'Colabora, ajuda os colegas e respeita as pessoas.' },
  { name: 'Proatividade', description: 'Antecipa problemas e propõe soluções.' },
  { name: 'Organização', description: 'Planeja as atividades e mantém tudo em ordem.' },
  { name: 'Assiduidade e pontualidade', description: 'Presença e horários respeitados.' },
];

export function normStatus(s: string | null | undefined): EvalStatus {
  if (s === 'sent' || s === 'contested' || s === 'finalized') return s;
  if (s === 'approved' || s === 'approved_with_obs' || s === 'archived') return 'finalized';
  if (s === 'in_review') return 'contested';
  return 'draft';
}

export function currentPeriod(d = new Date()) {
  const m = d.toLocaleDateString('pt-BR', { month: 'long' });
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} de ${d.getFullYear()}`;
}

const err = (e: unknown, fallback: string) => { const m = (e as { message?: string })?.message; return new Error(m && !/violates|permission|policy/i.test(m) ? m : fallback); };

// ---------- criteria ----------
export async function listCriteria(includeInactive = false): Promise<Criterion[]> {
  let q = sb.from('eval_competencies').select('id, name, description, is_active').order('name');
  if (!includeInactive) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw err(error, 'Não foi possível carregar os critérios.');
  return (data || []) as Criterion[];
}
export async function saveCriterion(c: { id?: string; name: string; description?: string | null }, userId: string) {
  const row = { name: c.name.trim(), description: c.description?.trim() || null };
  const { error } = c.id
    ? await sb.from('eval_competencies').update(row).eq('id', c.id)
    : await sb.from('eval_competencies').insert(withCompany({ ...row, category: 'general', is_active: true, created_by: userId }));
  if (error) throw err(error, 'Não foi possível salvar o critério.');
}
export async function setCriterionActive(id: string, active: boolean) {
  const { error } = await sb.from('eval_competencies').update({ is_active: active }).eq('id', id);
  if (error) throw err(error, 'Não foi possível atualizar o critério.');
}
export async function addSuggestedCriteria(userId: string, existing: string[]) {
  const have = new Set(existing.map((n) => n.trim().toLowerCase()));
  const rows = SUGGESTED_CRITERIA.filter((c) => !have.has(c.name.toLowerCase())).map((c) => withCompany({ ...c, category: 'general', is_active: true, created_by: userId }));
  if (!rows.length) return 0;
  const { error } = await sb.from('eval_competencies').insert(rows);
  if (error) throw err(error, 'Não foi possível adicionar os critérios.');
  return rows.length;
}

// ---------- evaluations ----------
interface DbEval { id: string; status: string; evaluator_id: string; evaluated_id: string; period_label: string | null; overall_score: number | null; overall_comment: string | null; strengths: string | null; improvements: string | null; evaluated_comment: string | null; created_at: string; sent_at: string | null; finalized_at: string | null; version: number | null }

export async function listEvaluations(filter?: { evaluatedId?: string }): Promise<EvalRow[]> {
  let q = sb.from('evaluations').select('*').order('created_at', { ascending: false });
  if (filter?.evaluatedId) q = q.eq('evaluated_id', filter.evaluatedId);
  const { data, error } = await q;
  if (error) throw err(error, 'Não foi possível carregar as avaliações.');
  const rows = (data || []) as DbEval[];
  if (!rows.length) return [];
  const ids = [...new Set(rows.flatMap((r) => [r.evaluator_id, r.evaluated_id]))];
  const [{ data: profs }, { data: secs }] = await Promise.all([
    sb.from('profiles').select('id, name, display_name, sector_id, avatar_url').in('id', ids),
    sb.from('sectors').select('id, name'),
  ]);
  const P = new Map<string, { name: string; display_name: string | null; sector_id: string | null; avatar_url: string | null }>((profs || []).map((p: { id: string }) => [p.id, p]));
  const S = new Map<string, string>((secs || []).map((s: { id: string; name: string }) => [s.id, s.name]));
  const nm = (id: string) => { const p = P.get(id); return p ? p.display_name || p.name : 'Usuário'; };
  return rows.map((r) => {
    const ev = P.get(r.evaluated_id);
    const status = normStatus(r.status);
    return {
      id: r.id, status,
      evaluatorId: r.evaluator_id, evaluatorName: nm(r.evaluator_id),
      evaluatedId: r.evaluated_id, evaluatedName: nm(r.evaluated_id),
      evaluatedSector: ev?.sector_id ? S.get(ev.sector_id) ?? null : null, evaluatedAvatar: ev?.avatar_url ?? null,
      period: r.period_label || new Date(r.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      score: r.overall_score == null ? null : Number(r.overall_score),
      feedback: r.overall_comment, strengths: r.strengths, improvements: r.improvements,
      evaluatedComment: r.evaluated_comment,
      createdAt: r.created_at, sentAt: r.sent_at, finishedAt: status === 'finalized' ? r.finalized_at : null, version: r.version || 1,
    };
  });
}

export async function getItems(evaluationId: string): Promise<EvalItem[]> {
  const { data, error } = await sb.from('evaluation_items').select('id, competency_id, score, evaluator_comment, created_at').eq('evaluation_id', evaluationId).order('created_at');
  if (error) throw err(error, 'Não foi possível carregar os critérios da avaliação.');
  const items = (data || []) as { id: string; competency_id: string; score: number | null; evaluator_comment: string | null }[];
  if (!items.length) return [];
  const { data: comps } = await sb.from('eval_competencies').select('id, name, description').in('id', items.map((i) => i.competency_id));
  const C = new Map<string, { name: string; description: string | null }>((comps || []).map((c: { id: string }) => [c.id, c]));
  return items.map((i) => ({ id: i.id, competency_id: i.competency_id, name: C.get(i.competency_id)?.name || 'Critério', description: C.get(i.competency_id)?.description ?? null, score: i.score == null ? null : Number(i.score), comment: i.evaluator_comment }));
}

async function history(evaluationId: string, meProfileId: string, action: string, oldStatus: string | null, newStatus: string, details?: string | null) {
  await Promise.resolve(sb.from('evaluation_history').insert({ evaluation_id: evaluationId, action, performed_by: meProfileId, old_status: oldStatus, new_status: newStatus, details: details || null })).catch(() => undefined);
}

export async function createEvaluation(p: { evaluatedId: string; period: string; criteriaIds: string[]; meProfileId: string }) {
  if (!p.criteriaIds.length) throw new Error('Escolha pelo menos um critério.');
  const { data, error } = await sb.from('evaluations').insert(withCompany({ evaluator_id: p.meProfileId, evaluated_id: p.evaluatedId, period_label: p.period.trim() || currentPeriod(), status: 'draft' })).select('id').single();
  if (error || !data) throw err(error, 'Não foi possível criar a avaliação.');
  const { error: e2 } = await sb.from('evaluation_items').insert(p.criteriaIds.map((cid) => ({ evaluation_id: data.id, competency_id: cid, weight: 1, score: null })));
  if (e2) { await sb.from('evaluations').delete().eq('id', data.id); throw err(e2, 'Não foi possível criar a avaliação.'); }
  await history(data.id, p.meProfileId, 'created', null, 'draft');
  return data.id as string;
}

export interface DraftPatch { items: { id: string; score: number | null; comment: string | null }[]; feedback: string; strengths: string; improvements: string; period?: string }

export async function saveDraft(id: string, d: DraftPatch) {
  for (const it of d.items) {
    const { error } = await sb.from('evaluation_items').update({ score: it.score, evaluator_comment: it.comment?.trim() || null, classification: it.score == null ? null : it.score >= 4 ? 'excellent' : it.score >= 3 ? 'good' : 'needs_improvement' }).eq('id', it.id);
    if (error) throw err(error, 'Não foi possível salvar as notas.');
  }
  const patch: Record<string, unknown> = { overall_comment: d.feedback.trim() || null, strengths: d.strengths.trim() || null, improvements: d.improvements.trim() || null };
  const scored = d.items.filter((i) => i.score != null);
  // Same value the DB trigger computes; set here too so the row is consistent right away.
  patch.overall_score = scored.length ? Math.round((scored.reduce((a, i) => a + (i.score || 0), 0) / scored.length) * 100) / 100 : null;
  if (d.period?.trim()) patch.period_label = d.period.trim();
  const { error } = await sb.from('evaluations').update(patch).eq('id', id);
  if (error) throw err(error, 'Não foi possível salvar a avaliação.');
}

export async function sendEvaluation(ev: EvalRow, d: DraftPatch, meProfileId: string) {
  if (d.items.some((i) => i.score == null)) throw new Error('Dê uma nota para todos os critérios antes de enviar.');
  if (!d.feedback.trim()) throw new Error('Escreva um feedback geral antes de enviar.');
  await saveDraft(ev.id, d);
  const resend = ev.status === 'contested';
  const { error } = await sb.from('evaluations').update({ status: 'sent', sent_at: new Date().toISOString(), version: resend ? ev.version + 1 : ev.version }).eq('id', ev.id);
  if (error) throw err(error, 'Não foi possível enviar a avaliação.');
  await history(ev.id, meProfileId, resend ? 'resent' : 'sent', ev.status, 'sent');
}

export async function respondEvaluation(id: string, accept: boolean, comment: string) {
  const { error } = await sb.rpc('evaluation_respond', { _id: id, _accept: accept, _comment: comment || null });
  if (error) throw err(error, 'Não foi possível registrar sua resposta.');
}

export async function deleteEvaluation(id: string) {
  const { error } = await sb.from('evaluations').delete().eq('id', id);
  if (error) throw err(error, 'Não foi possível excluir a avaliação.');
}

// ---------- reports ----------
const dt = (s: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');

export function evaluationReport(ev: EvalRow, items: EvalItem[]): ReportSpec {
  return {
    eyebrow: 'Avaliação de desempenho',
    title: ev.evaluatedName,
    subtitle: [ev.evaluatedSector, ev.period].filter(Boolean).join(' · '),
    meta: [`Avaliador: ${ev.evaluatorName}`, `Status: ${STATUS_LABEL[ev.status]}`, ev.sentAt ? `Enviada em ${dt(ev.sentAt)}` : ''].filter(Boolean),
    fileName: `avaliacao-${ev.evaluatedName}`,
    blocks: [
      { type: 'kpis', items: [
        { label: 'Nota geral', value: `${fmtScore(ev.score)} / 5`, tone: scoreTone(ev.score), hint: scaleLabel(ev.score) },
        { label: 'Critérios', value: items.length },
        { label: 'Melhor critério', value: items.length ? [...items].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0].name : '—' },
        { label: 'Status', value: STATUS_LABEL[ev.status], tone: STATUS_TONE[ev.status] },
      ] },
      { type: 'bars', title: 'Notas por critério', items: items.map((i) => ({ label: i.name, value: i.score ?? 0, max: 5, tone: scoreTone(i.score) })) },
      { type: 'table', title: 'Detalhamento', headers: ['Critério', 'Nota', 'Comentário do avaliador'], widths: ['30%', '18%', '52%'],
        rows: items.map((i) => [{ text: i.name, strong: true, sub: i.description || undefined }, { text: i.score == null ? '—' : `${i.score} · ${scaleLabel(i.score)}`, tone: scoreTone(i.score) }, i.comment || '—']) },
      ...(ev.strengths ? [{ type: 'text' as const, title: 'Pontos fortes', body: ev.strengths }] : []),
      ...(ev.improvements ? [{ type: 'text' as const, title: 'Pontos a desenvolver', body: ev.improvements }] : []),
      ...(ev.feedback ? [{ type: 'text' as const, title: 'Feedback geral', body: ev.feedback }] : []),
      ...(ev.evaluatedComment ? [{ type: 'text' as const, title: ev.status === 'contested' ? 'Pedido de revisão do colaborador' : 'Comentário do colaborador', body: ev.evaluatedComment }] : []),
      { type: 'info', title: 'Registro', items: [
        { label: 'Criada em', value: dt(ev.createdAt) }, { label: 'Enviada em', value: dt(ev.sentAt) },
        { label: 'Ciência em', value: dt(ev.finishedAt) }, { label: 'Versão', value: ev.version },
      ] },
      { type: 'signatures', items: [ev.evaluatorName + ' · avaliador', ev.evaluatedName + ' · colaborador'] },
    ],
  };
}

export function summaryReport(list: EvalRow[], title = 'Resumo das avaliações'): ReportSpec {
  const done = list.filter((e) => e.score != null && e.status !== 'draft');
  const avg = done.length ? done.reduce((s, e) => s + (e.score || 0), 0) / done.length : null;
  const bySector = new Map<string, number[]>();
  done.forEach((e) => { const k = e.evaluatedSector || 'Sem setor'; bySector.set(k, [...(bySector.get(k) || []), e.score || 0]); });
  return {
    eyebrow: 'Avaliações de desempenho', title, subtitle: `${list.length} avaliações`, landscape: true, fileName: 'avaliacoes',
    blocks: [
      { type: 'kpis', items: [
        { label: 'Avaliações', value: list.length },
        { label: 'Concluídas', value: list.filter((e) => e.status === 'finalized').length, tone: 'good' },
        { label: 'Aguardando ciência', value: list.filter((e) => e.status === 'sent').length, tone: 'warn' },
        { label: 'Nota média', value: fmtScore(avg), tone: scoreTone(avg), hint: scaleLabel(avg) },
      ] },
      ...(bySector.size ? [{ type: 'bars' as const, title: 'Nota média por setor', items: [...bySector].map(([label, v]) => ({ label, value: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10, max: 5, tone: scoreTone(v.reduce((a, b) => a + b, 0) / v.length) })) }] : []),
      { type: 'table', title: 'Avaliações', headers: ['Colaborador', 'Setor', 'Período', 'Avaliador', 'Nota', 'Status'], empty: 'Nenhuma avaliação',
        rows: list.map((e) => [{ text: e.evaluatedName, strong: true }, e.evaluatedSector || '—', e.period, e.evaluatorName, { text: fmtScore(e.score), tone: scoreTone(e.score) }, { text: STATUS_LABEL[e.status], tone: STATUS_TONE[e.status] }]) },
    ],
  };
}
