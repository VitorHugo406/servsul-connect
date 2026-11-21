// "Resumir com IA" in the conversation header: the EwvonAI summarizes the last 24 h / 3 days / 7 days of the chat
// (resumo, decisões, pendências) with the company's Claude key. Nothing is generated until the person asks, because
// every summary counts in the company's daily AI limit.
import { useState } from 'react';
import { Copy, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { aiSummarizeChat, renderAiText } from '@/lib/ewvonAi';
import { cn } from '@/lib/utils';
import '@/styles/chat-extras.css';

const PERIODS = [{ h: 24, label: 'Últimas 24 h' }, { h: 72, label: '3 dias' }, { h: 168, label: '7 dias' }];

export function ChatSummaryButton({ kind, id, name, className }: { kind: 'sector' | 'dm' | 'group'; id: string | null | undefined; name?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(24);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState('');
  if (!id) return null;
  const run = async () => {
    setBusy(true); setErr(''); setText(null);
    try {
      const r = await aiSummarizeChat(kind, id, hours);
      setText(r.text || '');
      if (!r.text) setErr(r.count ? 'Há poucas mensagens nesse período para resumir.' : 'Não há mensagens nesse período.');
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <>
      <Button type="button" variant="ghost" size="icon" title="Resumir com IA" aria-label="Resumir conversa com IA" onClick={() => { setOpen(true); setText(null); setErr(''); }}
        className={cn('h-9 w-9 shrink-0 rounded-full text-muted-foreground', className)}><Sparkles className="h-4 w-4 sm:h-5 sm:w-5" /></Button>
      <Dialog open={open} onOpenChange={(o) => { if (!busy) setOpen(o); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Resumo da conversa</DialogTitle>
            <DialogDescription>{name ? `${name} · ` : ''}O EwvonAI lê as mensagens do período e destaca o que foi decidido e o que ficou pendente.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <div className="cx-seg" role="group" aria-label="Período">
              {PERIODS.map((p) => <button key={p.h} type="button" aria-pressed={hours === p.h} onClick={() => setHours(p.h)} disabled={busy}>{p.label}</button>)}
            </div>
            <span className="flex-1" />
            <Button size="sm" onClick={() => void run()} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}{text ? 'Gerar de novo' : 'Resumir'}</Button>
          </div>
          {busy ? <div className="cx-sum flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Lendo as mensagens…</div>
            : err ? <div className="cx-sum text-muted-foreground">{err}</div>
            : text ? <div className="cx-sum">{renderAiText(text)}</div>
            : <p className="text-sm text-muted-foreground">Escolha o período e toque em Resumir. Cada resumo conta no limite diário de IA da empresa.</p>}
          <DialogFooter>
            {text ? <Button variant="outline" onClick={() => void navigator.clipboard?.writeText(text).then(() => toast.success('Resumo copiado'), () => toast.error('Não foi possível copiar'))}><Copy className="mr-2 h-4 w-4" />Copiar</Button> : null}
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
