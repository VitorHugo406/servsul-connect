// Full-screen notice when the company's payment is overdue and access is suspended.
// Only the e-mail that created the company sees how to pay and can download the data (ZIP).
import { useEffect, useRef, useState } from 'react';
import { Download, Loader2, LogOut, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useBillingGate } from '@/hooks/useBillingGate';
import { toast } from 'sonner';

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '');
async function readError(error: unknown): Promise<string | null> {
  try { const b = await (error as any)?.context?.json?.(); return b?.error || null; } catch { return null; }
}

export function SuspendedGate() {
  const { user, signOut } = useAuth();
  const { gate, reload } = useBillingGate();
  const [busy, setBusy] = useState<'pay' | 'zip' | null>(null);
  const [zip, setZip] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearInterval(timer.current), []);
  if (!user || gate.state !== 'blocked') return null;

  const pay = async () => {
    setBusy('pay');
    const { data, error } = await supabase.functions.invoke('billing/order', { body: { kind: 'regularize' } });
    setBusy(null);
    if (error || !(data as any)?.checkout_url) { toast.error((data as any)?.error || await readError(error) || 'Não foi possível abrir o pagamento agora.'); return; }
    window.open((data as any).checkout_url, '_blank', 'noopener');
    setWaiting(true);
    window.clearInterval(timer.current);
    let n = 0;
    timer.current = window.setInterval(() => { n++; void reload(); if (n > 120) window.clearInterval(timer.current); }, 5000);
  };
  const download = async () => {
    setBusy('zip');
    const { data, error } = await supabase.functions.invoke('company-export', { body: {} });
    setBusy(null);
    if (error || !(data as any)?.url) { toast.error((data as any)?.error || await readError(error) || 'Não foi possível gerar o arquivo agora.'); return; }
    setZip((data as any).url);
    window.open((data as any).url, '_blank', 'noopener');
  };

  return (
    <div role="alertdialog" aria-modal="true" className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-background p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive"><ShieldAlert className="h-6 w-6" /></span>
          <div><h1 className="text-lg font-semibold">Acesso suspenso por pagamento pendente</h1><p className="text-[13px] text-muted-foreground">{gate.company_name}</p></div></div>
        {gate.is_owner ? (
          <div className="mt-4 space-y-3 text-sm">
            <p>O pagamento do plano <b>{gate.plan_name}</b> não foi identificado e o acesso de <b>todos os usuários</b> da empresa está suspenso até o pagamento.</p>
            <div className="rounded-xl bg-muted p-3 text-[13px]">
              <p>Valor para liberar (1 mês): <b>{gate.amount_cents != null ? brl(gate.amount_cents) : '—'}</b></p>
              <p>Venceu em: <b>{fmt(gate.due_at)}</b> · Suspenso desde: <b>{fmt(gate.blocked_at)}</b></p>
              <p>Formas de pagamento: Pix, boleto ou cartão (Mercado Pago).</p>
            </div>
            <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-[13px] text-destructive"><b>Atenção:</b> se o pagamento não for regularizado até <b>{fmt(gate.delete_at)}</b> (30 dias corridos após a suspensão, faltam {gate.days_to_delete} dia(s)), <b>todos os dados da empresa serão apagados definitivamente</b>.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="h-10 flex-1" onClick={() => void pay()} disabled={busy !== null}>{busy === 'pay' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Pagar e liberar o acesso</Button>
              <Button variant="outline" className="h-10 flex-1" onClick={() => void download()} disabled={busy !== null}>{busy === 'zip' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Baixar meus dados (ZIP)</Button>
            </div>
            {waiting ? <p className="text-[12px] text-muted-foreground"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Aguardando a confirmação do pagamento. Esta tela some sozinha quando o acesso for liberado.</p> : null}
            {zip ? <p className="text-[12px] text-muted-foreground">Arquivo gerado (link válido por 7 dias). <a className="underline" href={zip} target="_blank" rel="noreferrer">Baixar de novo</a>. O ZIP contém somente dados desta empresa.</p> : null}
          </div>
        ) : (
          <div className="mt-4 space-y-3 text-sm">
            <p>O acesso de todos os usuários desta empresa está suspenso porque o pagamento do plano está pendente.</p>
            <p>Avise quem criou a empresa{gate.owner_hint ? <> (<b>{gate.owner_hint}</b>)</> : null}: ele pode entrar com o e-mail de criação, pagar e liberar o acesso de todos.</p>
          </div>
        )}
        <Button variant="ghost" className="mt-4 h-9 w-full" onClick={() => void signOut()}><LogOut className="mr-2 h-4 w-4" />Sair</Button>
      </div>
    </div>
  );
}
