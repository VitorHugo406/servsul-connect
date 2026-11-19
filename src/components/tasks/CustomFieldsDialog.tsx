// Mural › "Campos personalizados": the owner/admin defines the mural's own fields (name, type, options for lists,
// whether the value shows on the kanban card), reorders and deletes them. Values are filled inside each card.
import { useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sel } from '@/components/ui/Sel';
import { appConfirm } from '@/lib/appDialog';
import { FIELD_TYPES, useBoardExtras, type CustomField, type FieldType } from '@/hooks/useBoardExtras';

type Draft = { id?: string; name: string; type: FieldType; options: string; show_on_card: boolean };
const empty: Draft = { name: '', type: 'text', options: '', show_on_card: true };

export function CustomFieldsDialog({ open, onOpenChange, canManage }: { open: boolean; onOpenChange: (o: boolean) => void; canManage: boolean }) {
  const x = useBoardExtras();
  const [d, setD] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  if (!x) return null;
  const typeName = (t: FieldType) => FIELD_TYPES.find((f) => f[0] === t)?.[1] || t;
  const save = async () => {
    if (!d || !d.name.trim()) return;
    setBusy(true);
    const ok = await x.saveField({ id: d.id, name: d.name, type: d.type, options: d.options.split(','), show_on_card: d.show_on_card });
    setBusy(false); if (ok) setD(null);
  };
  const edit = (f: CustomField) => setD({ id: f.id, name: f.name, type: f.type, options: f.options.join(', '), show_on_card: f.show_on_card });
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setD(null); }}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogTitle className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5" />Campos personalizados</DialogTitle>
        <p className="text-sm text-muted-foreground">Crie campos próprios deste mural — por exemplo Valor do contrato, Cliente, Tipo de pedido ou Aprovado. Eles aparecem dentro de cada card{canManage ? '' : ' (só o dono ou administrador do mural pode criar ou alterar campos)'}.</p>
        <div className="divide-y divide-border rounded-lg border border-border">
          {!x.fields.length ? <p className="p-4 text-center text-sm text-muted-foreground">Nenhum campo ainda.</p> : x.fields.map((f, i) => (
            <div key={f.id} className="flex items-center gap-2 p-2.5 text-sm">
              <div className="min-w-0 flex-1"><b className="block truncate">{f.name}</b><span className="text-xs text-muted-foreground">{typeName(f.type)}{f.type === 'select' && f.options.length ? ` · ${f.options.join(', ')}` : ''}</span></div>
              <span title={f.show_on_card ? 'Aparece no card do quadro' : 'Só dentro do card'}>{f.show_on_card ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}</span>
              {canManage ? <>
                <button type="button" onClick={() => void x.moveField(f.id, -1)} disabled={i === 0} aria-label="Subir" className="disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => void x.moveField(f.id, 1)} disabled={i === x.fields.length - 1} aria-label="Descer" className="disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" onClick={() => edit(f)} aria-label="Editar campo"><Pencil className="h-4 w-4" /></button>
                <button type="button" aria-label="Excluir campo" onClick={async () => { if (await appConfirm({ title: `Excluir o campo "${f.name}"?`, message: 'Os valores preenchidos nos cards também serão apagados.', confirmText: 'Excluir', danger: true })) void x.deleteField(f.id); }}><Trash2 className="h-4 w-4 text-destructive" /></button>
              </> : null}
            </div>))}
        </div>
        {canManage ? (d ? (
          <div className="space-y-2 rounded-lg bg-muted/40 p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_170px]">
              <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} maxLength={60} placeholder="Nome do campo (ex.: Valor do contrato)" autoFocus aria-label="Nome do campo" />
              <Sel value={d.type} onChange={(e) => setD({ ...d, type: e.target.value as FieldType })}>{FIELD_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Sel>
            </div>
            {d.type === 'select' ? <Input value={d.options} onChange={(e) => setD({ ...d, options: e.target.value })} placeholder="Opções separadas por vírgula (ex.: Novo, Em análise, Aprovado)" aria-label="Opções" /> : null}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.show_on_card} onChange={(e) => setD({ ...d, show_on_card: e.target.checked })} />Mostrar o valor no card do quadro</label>
            <div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setD(null)}>Cancelar</Button><Button size="sm" onClick={() => void save()} disabled={busy || !d.name.trim() || (d.type === 'select' && !d.options.trim())}>{d.id ? 'Salvar campo' : 'Criar campo'}</Button></div>
          </div>
        ) : <Button variant="outline" onClick={() => setD({ ...empty })} disabled={x.fields.length >= 30}><Plus className="mr-2 h-4 w-4" />Novo campo</Button>) : null}
      </DialogContent>
    </Dialog>
  );
}
