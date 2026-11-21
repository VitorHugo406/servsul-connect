// "Importar mural": Trello (JSON) or ClickUp / Asana / spreadsheet (CSV) → a new ewvon mural. Shows a preview first.
import { useRef, useState } from 'react';
import { FileUp, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { importBoard, readBoardFile, type ImpBoard } from '@/lib/boardImport';

const HOW: Record<string, string> = {
  Trello: 'No Trello, abra o quadro › Menu (…) › Imprimir, exportar e compartilhar › Exportar como JSON.',
  ClickUp: 'No ClickUp, abra a lista ou o espaço › … › Exportar › CSV.',
  Asana: 'No Asana, abra o projeto › seta ao lado do nome › Exportar/Imprimir › CSV.',
  'monday.com': 'No monday.com, abra o quadro › … (mais ações) › Exportar quadro para o Excel.',
  Notion: 'No Notion, abra a base de dados › … › Exportar › Markdown e CSV (use o arquivo .csv de dentro do .zip).',
};

export function ImportBoardDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: (boardId: string) => void }) {
  const { user, profile } = useAuth();
  const ref = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<ImpBoard | null>(null);
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState<{ f: number; msg: string } | null>(null);
  const reset = () => { setData(null); setName(''); setErr(''); setProg(null); if (ref.current) ref.current.value = ''; };

  const pick = async (f?: File) => {
    if (!f) return; setErr(''); setData(null);
    try { const b = await readBoardFile(f); setData(b); setName(b.name); } catch (e) { setErr((e as Error).message); }
  };
  const run = async () => {
    if (!data || !user || !profile?.company_id) return;
    setBusy(true);
    try {
      const r = await importBoard(data, { userId: user.id, profileId: profile.id, companyId: profile.company_id }, name.trim() || data.name, (f, msg) => setProg({ f, msg }));
      toast.success(`Mural importado: ${r.cards} cards${r.matched ? `, ${r.matched} pessoa(s) vinculada(s)` : ''}`);
      reset(); onOpenChange(false); onDone(r.boardId);
    } catch (e) { toast.error((e as Error).message || 'Não foi possível importar'); setProg(null); }
    setBusy(false);
  };
  const stats = data ? {
    cards: data.cards.length, cols: data.columns.length, labels: data.labels.length,
    checks: data.cards.reduce((n, c) => n + c.checklists.reduce((m, cl) => m + cl.items.length, 0), 0),
    comments: data.cards.reduce((n, c) => n + c.comments.length, 0), due: data.cards.filter((c) => c.due).length,
  } : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileUp className="h-5 w-5" />Importar mural</DialogTitle>
          <DialogDescription>Traga seus quadros do Trello (JSON), do ClickUp, Asana e Notion (CSV), do monday.com (Excel) ou de planilhas. Um mural novo é criado; nada do original é alterado.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <input ref={ref} type="file" accept=".json,.csv,.xlsx,.xls,application/json,text/csv" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
          <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="flex w-full flex-col items-center gap-1 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 hover:bg-muted/60">
            <FileUp className="h-6 w-6 text-muted-foreground" /><span className="font-medium">{data ? 'Escolher outro arquivo' : 'Escolher arquivo (.json, .csv ou .xlsx)'}</span><span className="text-xs text-muted-foreground">Até 30 MB</span>
          </button>
          {err ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive">{err}</p> : null}
          {!data ? <ul className="space-y-1 text-xs text-muted-foreground">{Object.entries(HOW).map(([k, v]) => <li key={k}><b className="text-foreground">{k}:</b> {v}</li>)}</ul> : null}
          {data && stats ? <>
            <div className="rounded-xl border border-border p-3">
              <p className="mb-2 flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Arquivo do {data.source} reconhecido</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[['Cards', stats.cards], ['Colunas', stats.cols], ['Etiquetas', stats.labels], ['Itens de checklist', stats.checks], ['Comentários', stats.comments], ['Com prazo', stats.due]].map(([l, v]) => <div key={l as string} className="rounded-lg bg-muted/40 py-2"><b className="block text-lg">{v as number}</b><span className="text-[11px] text-muted-foreground">{l}</span></div>)}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Colunas: {data.columns.map((c) => c.title).join(' · ')}</p>
            </div>
            <label className="block"><span className="mb-1 block text-xs text-muted-foreground">Nome do novo mural</span><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></label>
            <p className="text-xs text-muted-foreground">Responsáveis são vinculados quando o nome ou e-mail bate com alguém da empresa. Comentários entram com o nome de quem escreveu.</p>
          </> : null}
          {prog ? <div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${Math.round(prog.f * 100)}%` }} /></div><p className="mt-1 text-xs text-muted-foreground">{prog.msg}</p></div> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={run} disabled={!data || busy || !name.trim()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Importar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
