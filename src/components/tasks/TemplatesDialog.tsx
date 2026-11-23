// Tarefas › "Modelos": ready-made murals by area (src/lib/boardTemplates.ts). Left: areas; middle: the area's models;
// right: preview (columns with the example cards) + what the model brings (fields, automations, dependencies, form)
// and the new mural's name. "Usar modelo" creates a NEW mural owned by the person (importBoard), sets the cover and
// adds the model's extras (applyTemplateExtras), then opens it. Styles: src/styles/templates.css (prefix tp-).
import { useMemo, useState } from 'react';
import {
  Briefcase, CalendarDays, Check, ClipboardList, Code, FileSignature, Flag, GitBranch, Handshake, Headset, LayoutGrid, Loader2,
  Megaphone, Receipt, Rocket, Search, ShoppingCart, SlidersHorizontal, Target, UserMinus, UserPlus, UserSearch, Wrench, Zap, ListChecks, type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { importBoard } from '@/lib/boardImport';
import { BOARD_TEMPLATES, TEMPLATE_AREAS, applyTemplateExtras, templateSummary, templateToBoard, type BoardTemplate } from '@/lib/boardTemplates';
import '@/styles/templates.css';

const ICONS: Record<string, LucideIcon> = {
  'user-plus': UserPlus, 'user-minus': UserMinus, 'user-search': UserSearch, briefcase: Briefcase, headset: Headset, handshake: Handshake,
  megaphone: Megaphone, target: Target, wrench: Wrench, 'calendar-days': CalendarDays, 'shopping-cart': ShoppingCart, receipt: Receipt,
  'file-signature': FileSignature, rocket: Rocket, code: Code, flag: Flag,
};
const Ico = ({ t, className }: { t: BoardTemplate; className?: string }) => { const I = ICONS[t.icon] || LayoutGrid; return <I className={className} />; };
const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

export function TemplatesDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: (boardId: string) => void }) {
  const { user, profile } = useAuth();
  const [area, setArea] = useState<string>('');
  const [q, setQ] = useState('');
  const [pick, setPick] = useState<BoardTemplate>(BOARD_TEMPLATES[0]);
  const [name, setName] = useState(BOARD_TEMPLATES[0].name);
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    const f = q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return BOARD_TEMPLATES.filter((t) => (!area || t.area === area) && (!f || `${t.name} ${t.desc} ${t.area}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(f)));
  }, [area, q]);
  const choose = (t: BoardTemplate) => { setPick(t); setName(t.name); };
  const s = templateSummary(pick);

  const create = async () => {
    if (!user || !profile?.company_id) return;
    setBusy(true);
    try {
      const r = await importBoard(templateToBoard(pick), { userId: user.id, profileId: profile.id, companyId: profile.company_id }, name.trim() || pick.name, () => {});
      await (supabase as any).from('task_boards').update({ background_image: pick.cover }).eq('id', r.boardId);
      try { await applyTemplateExtras(r.boardId, pick, profile.id); } catch { toast.error('O mural foi criado, mas alguns campos ou automações do modelo não puderam ser adicionados.'); }
      toast.success('Mural criado a partir do modelo');
      onOpenChange(false); onDone(r.boardId);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível criar o mural.'); }
    setBusy(false);
  };

  const includes: [LucideIcon, string, string][] = [
    [LayoutGrid, plural(pick.columns.length, 'coluna', 'colunas') + ' e ' + plural(pick.labels.length, 'etiqueta', 'etiquetas'), pick.columns.map((c) => c[0]).join(' → ')],
    s.proc ? [ListChecks, `Coluna “Modelo do processo” com ${plural(s.cards, 'card-template', 'cards-template')}`, 'Use “Duplicar todos os cards” na coluna: preencha os dados e os prazos são calculados'] : [ListChecks, plural(s.cards, 'card de exemplo', 'cards de exemplo'), s.checklists ? plural(s.checklists, 'checklist pronto', 'checklists prontos') : 'Edite ou apague à vontade'],
  ];
  if (s.fields) includes.push([SlidersHorizontal, plural(s.fields, 'campo personalizado', 'campos personalizados'), (pick.fields || []).map((f) => f.n).join(', ')]);
  if (s.rules) includes.push([Zap, plural(s.rules, 'automação', 'automações'), (pick.rules || []).map((r) => r.label).join(' · ')]);
  if (s.deps) includes.push([GitBranch, plural(s.deps, 'dependência', 'dependências') + ' entre cards', 'Um card só pode ser concluído depois do anterior — veja na Linha do tempo']);
  if (s.form) includes.push([ClipboardList, 'Formulário público pronto', `"${pick.form!.title}" — começa pausado; ative em Compartilhar › Formulário`]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="tp-dlg max-w-[1080px] gap-0 overflow-hidden p-0">
        <div className="tp-head">
          <div><DialogTitle className="tp-title">Modelos de mural</DialogTitle><p className="tp-sub">Comece com colunas, campos, automações e cards de exemplo prontos para a sua área.</p></div>
        </div>
        <div className="tp-body">
          <nav className="tp-areas" aria-label="Áreas">
            <label className="tp-search"><Search className="h-4 w-4" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar modelo" aria-label="Buscar modelo" /></label>
            <button type="button" className={`tp-area ${!area ? 'on' : ''}`} onClick={() => setArea('')}>Todos<span>{BOARD_TEMPLATES.length}</span></button>
            {TEMPLATE_AREAS.map((a) => <button key={a} type="button" className={`tp-area ${area === a ? 'on' : ''}`} onClick={() => setArea(a)}>{a}<span>{BOARD_TEMPLATES.filter((t) => t.area === a).length}</span></button>)}
          </nav>
          <div className="tp-list">
            {!list.length ? <p className="tp-empty">Nenhum modelo encontrado.</p> : list.map((t) => {
              const m = templateSummary(t);
              return (
                <button key={t.id} type="button" className={`tp-item ${pick.id === t.id ? 'on' : ''}`} onClick={() => choose(t)}>
                  <span className="tp-ico"><Ico t={t} className="h-[18px] w-[18px]" /></span>
                  <span className="tp-it">
                    <b>{t.name}</b>
                    <small>{t.area}</small>
                    <em>{[plural(t.columns.length, 'coluna', 'colunas'), m.fields ? plural(m.fields, 'campo', 'campos') : '', m.rules ? plural(m.rules, 'automação', 'automações') : '', m.form ? 'formulário' : ''].filter(Boolean).join(' · ')}</em>
                  </span>
                  {pick.id === t.id ? <Check className="tp-ck h-4 w-4" /> : null}
                </button>);
            })}
          </div>
          <section className="tp-prev" aria-label="Pré-visualização">
            <div className="tp-ph">
              <span className="tp-ico lg"><Ico t={pick} className="h-5 w-5" /></span>
              <div className="min-w-0"><h3>{pick.name}</h3><p>{pick.desc}</p></div>
            </div>
            <div className="tp-board" aria-hidden>
              {pick.columns.map(([c, color], i) => {
                const cards = pick.cards.filter((k) => k.col === i);
                return (
                  <div key={c} className="tp-col">
                    <div className="tp-colh"><i style={{ background: color }} /><span>{c}</span><small>{cards.length}</small></div>
                    {cards.slice(0, 3).map((k) => <div key={k.t} className="tp-card">{k.t}</div>)}
                    {cards.length > 3 ? <div className="tp-more">+{cards.length - 3}</div> : null}
                  </div>);
              })}
            </div>
            <h4 className="tp-h4">O que vem no modelo</h4>
            <ul className="tp-inc">
              {includes.map(([I, a, b]) => <li key={a}><I className="h-4 w-4" /><div><b>{a}</b><span>{b}</span></div></li>)}
            </ul>
          </section>
        </div>
        <div className="tp-foot">
          <label className="tp-name"><span>Nome do mural</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} aria-label="Nome do mural" /></label>
          <button type="button" className="tp-btn" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</button>
          <button type="button" className="tp-btn tp-pri" onClick={() => void create()} disabled={busy || !name.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Usar modelo</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
