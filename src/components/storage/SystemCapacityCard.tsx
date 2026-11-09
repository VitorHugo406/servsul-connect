// Super admin: what the Supabase plan allows vs what was sold to the companies, with an upgrade alert.
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { appPrompt } from '@/lib/appDialog';
import { toast } from 'sonner';

type Overview = {
  capacity_bytes: number; db_capacity_bytes: number; committed_bytes: number; files_bytes: number; db_bytes: number;
  project_storage_gb: number; project_db_mb: number;
  companies: { id: string; name: string; limit_bytes: number; used_bytes: number }[];
};
const fmt = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1).replace('.', ',')} GB` : `${Math.round(b / 1024 ** 2)} MB`);
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function Bar({ label, value, total, hint }: { label: string; value: number; total: number; hint?: string }) {
  const p = pct(value, total);
  const tone = p >= 100 ? 'bg-destructive' : p >= 80 ? 'bg-amber-500' : 'bg-foreground';
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]"><span className="text-muted-foreground">{label}</span><span className="font-medium tabular-nums">{fmt(value)} de {fmt(total)} · {p}%</span></div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full ${tone}`} style={{ width: `${Math.min(100, p)}%` }} /></div>
      {hint ? <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SystemCapacityCard() {
  const [o, setO] = useState<Overview | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc('system_storage_overview');
    if (!error && data) setO(data as Overview);
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (!o) return null;

  const oversold = o.committed_bytes > o.capacity_bytes;
  const filesHigh = o.files_bytes >= o.capacity_bytes * 0.8;
  const dbHigh = o.db_bytes >= o.db_capacity_bytes * 0.8;
  const alert = oversold || filesHigh || dbHigh;

  const editCapacity = async () => {
    const gb = await appPrompt({ title: 'Capacidade de arquivos do Supabase (GB)', message: 'Quanto o plano do Supabase libera para arquivos. Free: 1 GB · Pro: 100 GB (ou mais, se você contratou extra).', defaultValue: String(o.project_storage_gb) });
    if (gb === null) return;
    const mb = await appPrompt({ title: 'Capacidade do banco de dados (MB)', message: 'Free: 500 MB · Pro: 8192 MB (8 GB).', defaultValue: String(o.project_db_mb) });
    if (mb === null) return;
    const g = Number(gb.replace(',', '.')), m = Math.round(Number(mb));
    if (!(g > 0) || !(m > 0)) { toast.error('Informe números maiores que zero.'); return; }
    const { error } = await (supabase as any).rpc('set_project_capacity', { _storage_gb: g, _db_mb: m });
    if (error) { toast.error('Não foi possível salvar.'); return; }
    toast.success('Capacidade atualizada.');
    void load();
  };

  return (
    <Card className={alert ? 'border-destructive/50' : undefined}><CardContent className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {alert ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />}
          <div>
            <p className="text-[15px] font-semibold">{alert ? 'É preciso aumentar o plano do Supabase' : 'Capacidade do sistema em dia'}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {oversold
                ? `As empresas podem usar até ${fmt(o.committed_bytes)} somando os planos vendidos, mas o projeto só libera ${fmt(o.capacity_bytes)} de arquivos. Se elas usarem o que contrataram, os uploads vão parar.`
                : filesHigh ? 'Os arquivos já passam de 80% do que o projeto libera.'
                : dbHigh ? 'O banco de dados já passa de 80% do que o projeto libera.'
                : 'O espaço vendido às empresas cabe no plano atual do Supabase.'}
            </p>
            {alert ? <p className="mt-2 text-[13px]">Como resolver: no painel do Supabase, abra <b>Settings › Billing</b> e mude para o plano <b>Pro</b> (US$ 25/mês, inclui 100 GB de arquivos e 8 GB de banco). Depois atualize a capacidade aqui.</p> : null}
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-9" onClick={() => void editCapacity()}><Pencil className="mr-2 h-4 w-4" />Capacidade</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Bar label="Vendido às empresas" value={o.committed_bytes} total={o.capacity_bytes} hint="Soma dos limites de armazenamento dos planos e extras" />
        <Bar label="Arquivos em uso" value={o.files_bytes} total={o.capacity_bytes} />
        <Bar label="Banco de dados" value={o.db_bytes} total={o.db_capacity_bytes} />
      </div>
      {o.companies.length ? (
        <div className="divide-y divide-border rounded-xl border border-border">
          {o.companies.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
              <span className="truncate">{c.name}</span>
              <span className={`shrink-0 tabular-nums ${pct(c.used_bytes, c.limit_bytes) >= 90 ? 'text-destructive' : 'text-muted-foreground'}`}>{fmt(c.used_bytes)} de {fmt(c.limit_bytes)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </CardContent></Card>
  );
}
