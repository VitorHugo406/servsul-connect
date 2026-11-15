// Builds and downloads the standard evaluation PDF (experience 45/90 days or development) from an evaluation.
import { supabase } from '@/integrations/supabase/client';
import type { EvalItem, EvalRow } from '@/lib/evaluations';
import { previousExperienceScores } from '@/lib/evaluations';
import { brDate, contractDates, getEmployeeRecord } from '@/lib/employeeRecord';
import { buildEvaluationPdf, type EvalPdfItem } from '@/lib/pdf/evaluationPdf';
import { companyLogoImage, ewvonLogoImage } from '@/lib/pdf/pdfAssets';
import type { EvalKind, FormType } from '@/lib/evalPresets';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const fmtCnpj = (v?: string | null) => { const d = (v || '').replace(/\D/g, ''); return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : v || ''; };
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** 45-day scores to compare with: the manager's RPC, or the person's own copy (RLS) when they are the one reading. */
async function previousScores(ev: EvalRow) {
  const viaRpc = await previousExperienceScores(ev.evaluatedId);
  if (viaRpc) return viaRpc;
  const { data: row } = await sb.from('evaluations').select('id, overall_score, sent_at').eq('evaluated_id', ev.evaluatedId).eq('form_type', 'exp45').neq('status', 'draft').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!row) return null;
  const { data: its } = await sb.from('evaluation_items').select('score, competency_id').eq('evaluation_id', row.id);
  const ids = ((its || []) as { competency_id: string }[]).map((i) => i.competency_id);
  const { data: comps } = ids.length ? await sb.from('eval_competencies').select('id, name').in('id', ids) : { data: [] };
  const N = new Map<string, string>(((comps || []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  return { evaluationId: row.id as string, average: row.overall_score == null ? null : Number(row.overall_score), date: row.sent_at as string | null, items: ((its || []) as { score: number | null; competency_id: string }[]).map((i) => ({ name: N.get(i.competency_id) || '', score: i.score == null ? null : Number(i.score) })) };
}

export interface EvalPdfOverrides { items?: EvalItem[]; feedback?: string | null; strengths?: string | null; improvements?: string | null; average?: number | null }

export async function buildEvaluationDocument(ev: EvalRow, baseItems: EvalItem[], over: EvalPdfOverrides = {}) {
  const kind: EvalKind = ev.kind === 'development' ? 'development' : 'experience';
  const formType: FormType = ev.formType ?? (kind === 'experience' ? (ev.phase === 90 ? 'exp90' : ev.phase === 45 ? 'exp45' : 'expExtra') : 'devExtra');
  const items = over.items ?? baseItems;
  const [{ data: company }, { data: prof }, record, ewvonLogo] = await Promise.all([
    sb.from('companies').select('name, logo_url, primary_color, billing_data').eq('id', ev.companyId).maybeSingle(),
    sb.from('profiles').select('name, display_name, registration_number, sector_id').eq('id', ev.evaluatedId).maybeSingle(),
    getEmployeeRecord(ev.evaluatedId),
    ewvonLogoImage(),
  ]);
  const logo = await companyLogoImage(company?.logo_url);
  const prev = formType === 'exp90' ? await previousScores(ev) : null;
  const prevByName = new Map((prev?.items || []).map((i) => [i.name, i.score]));
  const pdfItems: EvalPdfItem[] = items.map((i) => ({ name: i.name, description: i.description || undefined, group: i.group || undefined, score: i.score, prev: prev ? prevByName.get(i.name) ?? null : undefined }));
  const scored = items.filter((i) => i.score != null);
  const average = over.average ?? (scored.length ? scored.reduce((s, i) => s + (i.score || 0), 0) / scored.length : ev.score);
  const dates = contractDates(record);
  const number = ev.docNumber ?? 0, key = ev.docKey ?? '';
  const doc = await buildEvaluationPdf({
    kind, formType,
    companyName: company?.name || 'Empresa', cnpj: fmtCnpj(company?.billing_data?.cnpj), primaryColor: company?.primary_color, logo, ewvonLogo,
    doc: { number, key, issuedAt: new Date(ev.createdAt), version: ev.version, url: `${window.location.origin}/validar?k=${encodeURIComponent(key)}` },
    employee: {
      name: ev.evaluatedName, registration: record.registration || prof?.registration_number || '', admission: brDate(record.admission_date),
      job: record.job_title || '', department: ev.evaluatedSector || '', manager: ev.evaluatorName,
      contractStart: brDate(dates.start), end1: brDate(dates.end1), end2: brDate(dates.end2),
      periodFrom: '', periodTo: '', lastEval: '',
    },
    evaluationDate: new Date(ev.sentAt || ev.createdAt).toLocaleDateString('pt-BR'),
    items: pdfItems, average, prevAverage: prev?.average ?? null,
    strengths: over.strengths ?? ev.strengths, improvements: over.improvements ?? ev.improvements, feedback: over.feedback ?? ev.feedback, employeeComment: ev.evaluatedComment,
    evaluatorName: ev.evaluatorName,
  });
  return { doc, fileName: `avaliacao-${kind === 'experience' ? 'experiencia' : 'desenvolvimento'}-${slug(ev.evaluatedName)}-${String(number).padStart(5, '0')}.pdf` };
}

export async function downloadEvaluationPdf(ev: EvalRow, items: EvalItem[], over: EvalPdfOverrides = {}) {
  const { doc, fileName } = await buildEvaluationDocument(ev, items, over);
  doc.save(fileName);
}
