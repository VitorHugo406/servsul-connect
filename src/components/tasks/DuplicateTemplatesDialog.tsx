// Coluna de template › "Duplicar todos os cards": cria de uma vez um card de verdade para cada card-template da coluna,
// já preenchido com os campos do mural informados aqui (ex.: Colaborador, Último dia, Tipo) e com os prazos
// calculados: prazo final = data de referência − antecedência; cada card vence N dias antes/depois desse prazo final
// (tasks.template_offset_days / template_start_offset_days, definidos no próprio card-template). Copia descrição,
// prioridade, capa, responsável e co-responsáveis, etiquetas, checklists, valores de campos e as dependências entre
// os cards do conjunto. A pergunta da antecedência e a data de referência ficam salvas na coluna
// (task_board_columns.template_*), migration 20261124010000.
import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { withCompany } from '@/lib/companyScope';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sel } from '@/components/ui/Sel';
import type { CustomField } from '@/hooks/useBoardExtras';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
type Col = { id: string; title: string; color?: string | null; is_template_column?: boolean | null; is_conclusion?: boolean | null };
type Tpl = { id: string; title: string; description: string | null; priority: string | null; cover_image: string | null; assigned_to: string | null; position: number | null; template_offset_days: number | null; template_start_offset_days: number | null };
type ColCfg = { template_ref_field: string | null; template_lead_days: number; template_lead_label: string | null; template_title_field: string | null };

const pad = (n: number) => String(n).padStart(2, '0');
const ymdOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const at = (d: Date, h: number) => { const x = new Date(d); x.setHours(h, 0, 0, 0); return x; };
const br = (d: Date) => d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
export const offsetText = (n: number | null | undefined) => n == null ? 'sem prazo' : n === 0 ? 'no prazo final' : n < 0 ? `${-n} ${n === -1 ? 'dia' : 'dias'} antes do prazo final` : `${n} ${n === 1 ? 'dia' : 'dias'} depois do prazo final`;

export function DuplicateTemplatesDialog({ open, onOpenChange, boardId, column, columns, canConfigure, onCreated }: {
  open: boolean; onOpenChange: (o: boolean) => void; boardId: string; column: Col; columns: Col[]; canConfigure: boolean; onCreated: () => void;
}) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [vals, setVals] = useState<Record<string, unknown>>({});
  const [cfg, setCfg] = useState<ColCfg>({ template_ref_field: null, template_lead_days: 0, template_lead_label: null, template_title_field: null });
  const [target, setTarget] = useState('');
  const [editQ, setEditQ] = useState(false);
  const targets = useMemo(() => columns.filter((c) => !c.is_template_column), [columns]);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setLoading(true); setEditQ(false);
    void (async () => {
      const [f, t, c] = await Promise.all([
        db.from('board_custom_fields').select('*').eq('board_id', boardId).order('position'),
        db.from('tasks').select('id,title,description,priority,cover_image,assigned_to,position,template_offset_days,template_start_offset_days').eq('board_id', boardId).eq('status', column.id).eq('is_template', true).eq('is_archived', false).order('position'),
        db.from('task_board_columns').select('template_ref_field,template_lead_days,template_lead_label,template_title_field').eq('id', column.id).maybeSingle(),
      ]);
      if (!live) return;
      const fs = ((f.data || []) as CustomField[]).map((x) => ({ ...x, options: Array.isArray(x.options) ? x.options : [] }));
      const ts = (t.data || []) as Tpl[];
      setFields(fs); setTpls(ts);
      if (c.data) setCfg({ template_ref_field: c.data.template_ref_field, template_lead_days: c.data.template_lead_days ?? 0, template_lead_label: c.data.template_lead_label, template_title_field: c.data.template_title_field });
      // prefill with the values the templates already carry (the model's example), except dates, which change every time
      const v: Record<string, unknown> = {};
      if (ts.length) {
        const { data: fv } = await db.from('task_field_values').select('task_id,field_id,value').in('task_id', ts.map((x) => x.id));
        for (const r of (fv || []) as { field_id: string; value: unknown }[]) { const fd = fs.find((x) => x.id === r.field_id); if (fd && fd.type !== 'date' && v[r.field_id] == null && r.value != null && r.value !== '') v[r.field_id] = r.value; }
      }
      if (!live) return;
      setVals(v);
      setTarget((cur) => cur || targets.find((x) => !x.is_conclusion)?.id || targets[0]?.id || '');
      setLoading(false);
    })();
    return () => { live = false; };
  }, [open, boardId, column.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dateFields = fields.filter((f) => f.type === 'date');
  const textFields = fields.filter((f) => f.type === 'text' || f.type === 'select');
  const refField = fields.find((f) => f.id === cfg.template_ref_field) || null;
  const refDate = refField ? parseYmd(String(vals[refField.id] || '')) : null;
  const finalDate = refDate ? addDays(refDate, -(cfg.template_lead_days || 0)) : null;
  const question = cfg.template_lead_label || (refField ? `Quantos dias antes de "${refField.name}" tudo precisa estar concluído?` : 'Antecedência (dias)');
  const titleVal = cfg.template_title_field ? String(vals[cfg.template_title_field] ?? '').trim() : '';
  const usesDates = tpls.some((t) => t.template_offset_days != null || t.template_start_offset_days != null);
  const dueOf = (t: Tpl) => (finalDate && t.template_offset_days != null ? at(addDays(finalDate, t.template_offset_days), 18) : null);
  const startOf = (t: Tpl) => (finalDate && t.template_start_offset_days != null ? at(addDays(finalDate, t.template_start_offset_days), 9) : null);
  const titleOf = (t: Tpl) => (titleVal ? `${t.title} — ${titleVal}` : t.title);

  const setVal = (id: string, v: unknown) => setVals((p) => ({ ...p, [id]: v }));
  const fieldInput = (f: CustomField) => {
    const v = vals[f.id];
    if (f.type === 'checkbox') return <label className="flex h-9 items-center gap-2 text-sm"><input type="checkbox" checked={!!v} onChange={(e) => setVal(f.id, e.target.checked)} />Sim</label>;
    if (f.type === 'select') return <Sel className="ui-sel w-full" value={String(v ?? '')} onChange={(e) => setVal(f.id, e.target.value || null)} aria-label={f.name}><option value="">—</option>{f.options.map((o) => <option key={o} value={o}>{o}</option>)}</Sel>;
    if (f.type === 'date') return <Input type="date" value={String(v ?? '')} onChange={(e) => setVal(f.id, e.target.value || null)} aria-label={f.name} />;
    if (f.type === 'number' || f.type === 'money') return <Input type="number" inputMode="decimal" value={v == null ? '' : String(v)} onChange={(e) => setVal(f.id, e.target.value === '' ? null : Number(e.target.value))} aria-label={f.name} />;
    return <Input value={String(v ?? '')} maxLength={300} onChange={(e) => setVal(f.id, e.target.value)} aria-label={f.name} />;
  };

  const run = async () => {
    if (!tpls.length) { toast.error('Esta coluna não tem cards-template.'); return; }
    if (!target) { toast.error('Escolha a coluna onde os cards vão ser criados.'); return; }
    if (usesDates && refField && !refDate) { toast.error(`Informe "${refField.name}" para calcular os prazos.`); return; }
    setBusy(true);
    try {
      if (canConfigure) await db.from('task_board_columns').update(cfg).eq('id', column.id);
      const ids = tpls.map((t) => t.id);
      const [asg, lbl, grp, sub, fv, dep, { data: inCol }] = await Promise.all([
        db.from('task_assignees').select('task_id,profile_id').in('task_id', ids),
        db.from('task_label_assignments').select('task_id,label_id').in('task_id', ids),
        db.from('subtask_groups').select('id,task_id,title,position').in('task_id', ids),
        db.from('task_subtasks').select('task_id,title,position,group_id').in('task_id', ids),
        db.from('task_field_values').select('task_id,field_id,value').in('task_id', ids),
        db.from('task_dependencies').select('task_id,depends_on').in('task_id', ids),
        db.from('tasks').select('id').eq('board_id', boardId).eq('status', target).eq('is_archived', false),
      ]);
      // ONE insert for all cards (position is unique per row, so returned rows map back to their template)
      const base = (inCol || []).length;
      const rows = tpls.map((t, i) => { const due = dueOf(t), start = startOf(t); return withCompany({
        board_id: boardId, title: titleOf(t).slice(0, 500), description: t.description, status: target, priority: t.priority || 'medium',
        cover_image: t.cover_image, assigned_to: t.assigned_to, position: base + i, created_by: profile?.id, is_template: false,
        due_date: due ? due.toISOString() : null, start_date: start ? start.toISOString() : null,
      }); });
      const { data: made, error: mkErr } = await db.from('tasks').insert(rows).select('id,position');
      if (mkErr || !made || made.length !== tpls.length) throw mkErr || new Error('insert');
      const map = new Map<string, string>();
      for (const r of made as { id: string; position: number }[]) { const t = tpls[r.position - base]; if (t) map.set(t.id, r.id); }
      const nid = (id: string) => map.get(id);
      const a = ((asg.data || []) as { task_id: string; profile_id: string }[]).map((r) => ({ task_id: nid(r.task_id), profile_id: r.profile_id })).filter((r) => r.task_id);
      if (a.length) await db.from('task_assignees').insert(a);
      const l = ((lbl.data || []) as { task_id: string; label_id: string }[]).map((r) => ({ task_id: nid(r.task_id), label_id: r.label_id })).filter((r) => r.task_id);
      if (l.length) await db.from('task_label_assignments').insert(l);
      const gmap = new Map<string, string>();
      const gsrc = ((grp.data || []) as { id: string; task_id: string; title: string; position: number }[]).filter((g) => nid(g.task_id));
      if (gsrc.length) {
        const { data: gnew } = await db.from('subtask_groups').insert(gsrc.map((g) => ({ task_id: nid(g.task_id), title: g.title, position: g.position }))).select('id,task_id,title,position');
        for (const g of gsrc) { const n = ((gnew || []) as { id: string; task_id: string; title: string; position: number }[]).find((x) => x.task_id === nid(g.task_id) && x.title === g.title && x.position === g.position); if (n) gmap.set(g.id, n.id); }
      }
      const s = ((sub.data || []) as { task_id: string; title: string; position: number; group_id: string | null }[])
        .map((r) => ({ task_id: nid(r.task_id), title: r.title, position: r.position, group_id: r.group_id ? gmap.get(r.group_id) || null : null })).filter((r) => r.task_id);
      if (s.length) await db.from('task_subtasks').insert(s);
      // field values: what was typed here wins over the template's own value
      const out: { task_id: string; field_id: string; value: unknown }[] = [];
      for (const t of tpls) {
        const tid = nid(t.id)!;
        const own = new Map(((fv.data || []) as { task_id: string; field_id: string; value: unknown }[]).filter((r) => r.task_id === t.id).map((r) => [r.field_id, r.value]));
        for (const f of fields) {
          const v = vals[f.id] != null && vals[f.id] !== '' ? vals[f.id] : own.get(f.id);
          if (v != null && v !== '') out.push({ task_id: tid, field_id: f.id, value: v });
        }
      }
      if (out.length) await db.from('task_field_values').insert(out);
      const d = ((dep.data || []) as { task_id: string; depends_on: string }[]).map((r) => ({ task_id: nid(r.task_id), depends_on: nid(r.depends_on) })).filter((r) => r.task_id && r.depends_on);
      if (d.length) await db.from('task_dependencies').insert(d);
      toast.success(`${tpls.length} ${tpls.length === 1 ? 'card criado' : 'cards criados'} em "${targets.find((c) => c.id === target)?.title || 'coluna'}".`);
      onCreated(); onOpenChange(false);
    } catch {
      toast.error('Não foi possível criar todos os cards. Confira o mural e tente de novo.');
      onCreated();
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogTitle className="flex items-center gap-2"><Copy className="h-5 w-5" />Duplicar todos os cards de “{column.title}”</DialogTitle>
        {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : !tpls.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Esta coluna ainda não tem cards-template. Crie os cards do processo nela e volte aqui.</p>
        ) : (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-muted-foreground">Preencha uma vez e o ewvon cria os {tpls.length} cards do processo já com essas informações e com os prazos calculados.</p>

            {fields.length ? (
              <section className="flex flex-col gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Informações</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {fields.map((f) => <label key={f.id} className="flex flex-col gap-1 text-sm"><span className="font-medium">{f.name}{f.id === cfg.template_ref_field ? <span className="ml-1 text-xs font-normal text-primary">(referência dos prazos)</span> : null}</span>{fieldInput(f)}</label>)}
                </div>
              </section>
            ) : <p className="rounded-[10px] bg-muted/50 px-3 py-2 text-xs text-muted-foreground">Este mural não tem campos personalizados. Crie campos (ex.: Colaborador, Data de admissão) em Configurar › Campos personalizados para preenchê-los aqui.</p>}

            <section className="flex flex-col gap-3 rounded-[12px] border border-border p-3">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><CalendarClock className="h-4 w-4" />Prazos</h3>
              {dateFields.length ? (
                <>
                  {canConfigure ? (
                    <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Data de referência</span>
                      <Sel className="ui-sel w-full" value={cfg.template_ref_field || ''} onChange={(e) => setCfg((c) => ({ ...c, template_ref_field: e.target.value || null }))} aria-label="Data de referência">
                        <option value="">Sem prazos (não calcular)</option>{dateFields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </Sel>
                    </label>
                  ) : null}
                  {refField ? (
                    <label className="flex flex-col gap-1 text-sm">
                      {editQ ? <Input value={cfg.template_lead_label || ''} maxLength={200} placeholder={question} onChange={(e) => setCfg((c) => ({ ...c, template_lead_label: e.target.value || null }))} aria-label="Pergunta da antecedência" />
                        : <span className="font-medium">{question}{canConfigure ? <button type="button" className="ml-2 text-xs font-normal text-primary underline" onClick={() => setEditQ(true)}>editar pergunta</button> : null}</span>}
                      <div className="flex items-center gap-2"><Input type="number" className="w-28" value={cfg.template_lead_days} onChange={(e) => setCfg((c) => ({ ...c, template_lead_days: Math.max(-3650, Math.min(3650, Math.round(Number(e.target.value) || 0))) }))} aria-label="Dias de antecedência" /><span className="text-muted-foreground">dias</span></div>
                      <span className="text-xs text-muted-foreground">{finalDate ? <>Prazo final do processo: <b className="text-foreground">{br(finalDate)}</b> ({refField.name} {cfg.template_lead_days ? `− ${cfg.template_lead_days} ${Math.abs(cfg.template_lead_days) === 1 ? 'dia' : 'dias'}` : ''}).</> : `Informe "${refField.name}" acima para calcular as datas.`}</span>
                    </label>
                  ) : <p className="text-xs text-muted-foreground">Sem data de referência os cards são criados sem prazo.</p>}
                </>
              ) : <p className="text-xs text-muted-foreground">Para calcular prazos, o mural precisa de um campo do tipo Data (ex.: “Último dia”, “Data de admissão”).</p>}
            </section>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Criar os cards na coluna</span>
                <Sel className="ui-sel w-full" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Coluna de destino">{targets.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Sel>
              </label>
              {canConfigure && textFields.length ? (
                <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Acrescentar ao título</span>
                  <Sel className="ui-sel w-full" value={cfg.template_title_field || ''} onChange={(e) => setCfg((c) => ({ ...c, template_title_field: e.target.value || null }))} aria-label="Campo no título">
                    <option value="">Nada</option>{textFields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </Sel>
                </label>
              ) : null}
            </div>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cards que serão criados</h3>
              <div className="divide-y divide-border rounded-[12px] border border-border">
                {tpls.map((t) => { const due = dueOf(t), st = startOf(t); return (
                  <div key={t.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{titleOf(t)}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{due ? <>{st ? `${st.toLocaleDateString('pt-BR')} → ` : ''}<b className="text-foreground">{due.toLocaleDateString('pt-BR')}</b></> : refField ? offsetText(t.template_offset_days) : 'sem prazo'}</span>
                  </div>); })}
              </div>
              {usesDates ? null : <p className="mt-2 text-xs text-muted-foreground">Dica: abra cada card-template e defina “Prazo no processo” (ex.: 3 dias antes do prazo final) para as datas serem calculadas.</p>}
            </section>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
              <Button onClick={() => void run()} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}Criar {tpls.length} {tpls.length === 1 ? 'card' : 'cards'}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OffsetRow({ label, v, set, readOnly }: { label: string; v: number | null; set: (n: number | null) => void; readOnly?: boolean }) {
  const dir = v == null ? 'none' : v < 0 ? 'before' : v > 0 ? 'after' : 'on';
  const n = v == null ? 0 : Math.abs(v);
  const put = (d: string, k: number) => set(d === 'none' ? null : d === 'on' ? 0 : d === 'before' ? -Math.max(1, k) : Math.max(1, k));
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      {dir === 'before' || dir === 'after' ? <Input type="number" min={1} className="h-8 w-20" value={n} disabled={readOnly} onChange={(e) => put(dir, Math.round(Number(e.target.value) || 1))} aria-label={`${label} em dias`} /> : null}
      <Sel className="ui-sel h-8" value={dir} disabled={readOnly} onChange={(e) => put(e.target.value, n || 1)} aria-label={label}>
        <option value="none">sem data</option><option value="before">dias antes do prazo final</option><option value="on">no prazo final</option><option value="after">dias depois do prazo final</option>
      </Sel>
    </div>
  );
}

/** "Prazo no processo" inside a template card: due/start offsets in days around the process final date. */
export function TemplateOffsetEditor({ taskId, readOnly }: { taskId: string; readOnly?: boolean }) {
  const [due, setDue] = useState<number | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let live = true;
    void db.from('tasks').select('template_offset_days,template_start_offset_days').eq('id', taskId).maybeSingle().then(({ data, error }: { data: { template_offset_days: number | null; template_start_offset_days: number | null } | null; error: unknown }) => {
      if (!live || error || !data) return; setDue(data.template_offset_days); setStart(data.template_start_offset_days); setOk(true);
    });
    return () => { live = false; };
  }, [taskId]);
  if (!ok) return null;
  const save = async (d: number | null, s: number | null) => {
    setDue(d); setStart(s);
    const { error } = await db.from('tasks').update({ template_offset_days: d, template_start_offset_days: s }).eq('id', taskId);
    if (error) toast.error('Não foi possível salvar o prazo do template.');
  };
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-[10px] border border-border bg-card p-3">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" />Prazo no processo</span>
      <OffsetRow label="Prazo" v={due} readOnly={readOnly} set={(x) => void save(x, start)} />
      <OffsetRow label="Início" v={start} readOnly={readOnly} set={(x) => void save(due, x)} />
      <span className="text-xs text-muted-foreground">Ao usar “Duplicar todos os cards” na coluna, a data é calculada a partir do prazo final do processo.</span>
    </div>
  );
}
