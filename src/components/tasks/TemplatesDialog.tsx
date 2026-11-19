// Tarefas › "Modelos": gallery of ready-made murals (src/lib/boardTemplates.ts). Picking one creates a NEW mural owned by
// the person with the template's columns, labels, example cards and checklists (importBoard), sets the template cover
// and opens it.
import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { importBoard } from '@/lib/boardImport';
import { BOARD_TEMPLATES, templateToBoard, type BoardTemplate } from '@/lib/boardTemplates';

export function TemplatesDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: (boardId: string) => void }) {
  const { user, profile } = useAuth();
  const [pick, setPick] = useState<BoardTemplate | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const create = async () => {
    if (!pick || !user || !profile?.company_id) return;
    setBusy(true);
    try {
      const r = await importBoard(templateToBoard(pick), { userId: user.id, profileId: profile.id, companyId: profile.company_id }, name.trim() || pick.name, () => {});
      await (supabase as any).from('task_boards').update({ background_image: pick.cover }).eq('id', r.boardId);
      toast.success('Mural criado a partir do modelo');
      onOpenChange(false); setPick(null); setName(''); onDone(r.boardId);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível criar o mural.'); }
    setBusy(false);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) { onOpenChange(o); if (!o) setPick(null); } }}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogTitle>Começar com um modelo</DialogTitle>
        <p className="text-sm text-muted-foreground">Escolha um modelo pronto. O mural já vem com colunas, etiquetas e cards de exemplo — depois é só editar ou apagar o que não usar.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BOARD_TEMPLATES.map((t) => {
            const on = pick?.id === t.id;
            return (
              <button key={t.id} type="button" onClick={() => { setPick(t); setName(t.name); }} className={`relative rounded-xl border p-3 text-left transition-colors ${on ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:bg-muted/50'}`}>
                <div className="mb-2 flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-lg text-lg" style={{ background: `${t.color}22` }}>{t.emoji}</span><b className="text-sm">{t.name}</b>{on ? <Check className="ml-auto h-4 w-4 text-primary" /> : null}</div>
                <p className="mb-2 line-clamp-3 text-xs text-muted-foreground">{t.desc}</p>
                <div className="flex flex-wrap gap-1">{t.columns.map(([c, col]) => <span key={c} className="rounded-full px-2 py-0.5 text-[10.5px] font-medium" style={{ background: `${col}22`, color: col }}>{c}</span>)}</div>
                <p className="mt-2 text-[11px] text-muted-foreground">{t.cards.length} cards de exemplo · {t.labels.length} etiquetas</p>
              </button>);
          })}
        </div>
        {pick ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-sm text-muted-foreground">Nome do mural</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="h-9 min-w-0 flex-1" aria-label="Nome do mural" />
            <Button onClick={() => void create()} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Criar mural</Button>
          </div>) : null}
      </DialogContent>
    </Dialog>
  );
}
