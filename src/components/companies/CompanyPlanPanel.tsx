// Super admin: plan, status and free seats ("acessos gratuitos") of one company.
// Groundwork for the payment integration (migration 20261109050000_subscriptions): nothing is
// charged or blocked yet. The system (Admin) company is always exempt.
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Check, Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Plan {
  id: string; name: string; description: string | null; price_cents: number; max_users: number; max_sectors: number; storage_gb: number; features: string[];
}
type Status = 'pending' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'free' | 'exempt';
interface Sub { company_id: string; plan_id: string | null; status: Status; free_seats: number; trial_ends_at: string | null; notes: string | null }

// The new tables are not in the generated Supabase types yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const FEATURE_LABEL: Record<string, string> = {
  home: 'Início', chat: 'Chat', announcements: 'Avisos gerais', important_notices: 'Comunicados importantes', tasks: 'Tarefas e Kanban',
  notes: 'Anotações', themes: 'Personalização de temas', evaluations: 'Avaliações', birthdays: 'Aniversariantes', calendar: 'Calendário',
  meeting_rooms: 'Salas de reunião', shortcuts: 'Atalhos do sistema', metrics_dashboard: 'Dashboard de métricas', people_management: 'Gestão de Pessoas',
  war_room: 'War Room', dashboard_3d: 'Dashboard 3D (em breve)',
};
const STATUS: { id: Status; label: string; hint: string }[] = [
  { id: 'pending', label: 'Aguardando', hint: 'Plano ainda não definido' },
  { id: 'trialing', label: 'Em teste', hint: 'Período de teste até a data abaixo' },
  { id: 'active', label: 'Ativa', hint: 'Pagando normalmente' },
  { id: 'past_due', label: 'Pagamento atrasado', hint: 'Cobrança não confirmada' },
  { id: 'canceled', label: 'Cancelada', hint: 'Sem acesso pago' },
  { id: 'free', label: 'Gratuita', hint: 'Usa o plano sem cobrança' },
];
const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function CompanyPlanPanel({ companyId, isSystem, userCount }: { companyId: string; isSystem: boolean; userCount: number }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<Sub | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void Promise.all([
      db.from('subscription_plans').select('id,name,description,price_cents,max_users,max_sectors,storage_gb,features').eq('is_active', true).order('sort_order'),
      db.from('company_subscriptions').select('company_id,plan_id,status,free_seats,trial_ends_at,notes').eq('company_id', companyId).maybeSingle(),
    ]).then(([p, s]) => {
      if (!alive) return;
      setPlans((p.data as Plan[]) || []);
      setSub((s.data as Sub) || { company_id: companyId, plan_id: null, status: isSystem ? 'exempt' : 'pending', free_seats: 0, trial_ends_at: null, notes: null });
      setLoading(false);
    });
    return () => { alive = false; };
  }, [companyId, isSystem]);

  if (loading || !sub) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  if (isSystem) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div><p className="text-sm font-semibold">Empresa do sistema: isenta de cobrança</p>
          <p className="text-sm text-muted-foreground">A empresa Admin tem acesso a tudo, sem plano e sem pagamento. O banco garante isso mesmo se alguém tentar mudar.</p></div>
      </div>
    );
  }

  const plan = plans.find((p) => p.id === sub.plan_id) || null;
  const seats = plan ? plan.max_users + sub.free_seats : sub.free_seats;
  const set = (patch: Partial<Sub>) => setSub((s) => (s ? { ...s, ...patch } : s));

  const save = async () => {
    if ((sub.status === 'active' || sub.status === 'trialing' || sub.status === 'free') && !sub.plan_id) { toast.error('Escolha um plano para essa situação.'); return; }
    setSaving(true);
    const { error } = await db.from('company_subscriptions').upsert({
      company_id: companyId, plan_id: sub.plan_id, status: sub.status, free_seats: Math.max(0, Math.floor(sub.free_seats || 0)),
      trial_ends_at: sub.status === 'trialing' ? sub.trial_ends_at : null, notes: sub.notes?.trim() || null,
    }, { onConflict: 'company_id' });
    setSaving(false);
    if (error) { toast.error('Não foi possível salvar o plano.'); console.error(error); return; }
    toast.success('Plano da empresa salvo');
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-semibold">Plano liberado para esta empresa</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {plans.map((p) => {
            const on = p.id === sub.plan_id;
            return (
              <button key={p.id} type="button" onClick={() => set({ plan_id: on ? null : p.id })}
                className={cn('rounded-2xl border p-3 text-left transition-colors', on ? 'border-foreground bg-muted/60' : 'hover:bg-muted/40')}>
                <div className="flex items-center justify-between gap-2"><span className="font-semibold">{p.name}</span>{on ? <Check className="h-4 w-4" /> : null}</div>
                <div className="mt-1 text-lg font-bold">{brl(p.price_cents)}<span className="text-xs font-normal text-muted-foreground">/mês</span></div>
                <div className="mt-1 text-xs text-muted-foreground">{p.max_users} usuários · {p.max_sectors} setores · {p.storage_gb} GB</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Situação</Label>
          <select className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3 text-sm" value={sub.status} onChange={(e) => set({ status: e.target.value as Status })}>
            {STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">{STATUS.find((s) => s.id === sub.status)?.hint}</p>
        </div>
        <div>
          <Label>Acessos gratuitos</Label>
          <Input className="mt-1.5" type="number" min={0} max={10000} value={sub.free_seats} onChange={(e) => set({ free_seats: Number(e.target.value) || 0 })} />
          <p className="mt-1 text-xs text-muted-foreground">Usuários a mais, sem cobrança, além do limite do plano.</p>
        </div>
        {sub.status === 'trialing' ? (
          <div>
            <Label>Teste até</Label>
            <Input className="mt-1.5" type="date" value={sub.trial_ends_at ? sub.trial_ends_at.slice(0, 10) : ''} onChange={(e) => set({ trial_ends_at: e.target.value ? new Date(e.target.value + 'T23:59:59').toISOString() : null })} />
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Capacidade:</span>
          <span>{plan ? `${plan.max_users} do plano` : 'sem plano'}{sub.free_seats ? ` + ${sub.free_seats} gratuitos` : ''} = <b>{seats}</b> usuários</span>
          <Badge variant={userCount > seats ? 'destructive' : 'secondary'}>{userCount} em uso</Badge>
        </div>
        {plan ? <div className="mt-2 flex flex-wrap gap-1.5">{plan.features.map((f) => <span key={f} className="rounded-full border px-2 py-0.5 text-xs">{FEATURE_LABEL[f] || f}</span>)}</div> : null}
      </div>

      <div>
        <Label>Observações</Label>
        <Textarea className="mt-1.5" rows={2} value={sub.notes || ''} onChange={(e) => set({ notes: e.target.value })} placeholder="Ex.: desconto combinado, contato do financeiro…" />
      </div>

      <p className="text-xs text-muted-foreground">Ainda não há cobrança automática: esta tela define o plano e os limites. A integração de pagamento vai usar estes dados.</p>
      <div className="flex justify-end"><Button onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar plano</Button></div>
    </div>
  );
}
