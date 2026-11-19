// "Agenda no celular" (Calendário): a personal iCal link (calendar_feeds via RPC my_calendar_feed, served by the `ical`
// edge function) that Google Agenda, Outlook and iPhone subscribe to. It lists the person's cards with a due date and
// their events/meetings and refreshes by itself (about every hour, depending on the calendar app). "Gerar novo link"
// revokes the old one.
import { useState } from 'react';
import { CalendarPlus, Copy, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { appConfirm } from '@/lib/appDialog';

const FN = 'https://scslfueixmuolkmgdslk.supabase.co/functions/v1/ical';

export function CalendarFeedButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async (regen = false) => {
    setBusy(true);
    const { data, error } = await (supabase as any).rpc('my_calendar_feed', { _regen: regen });
    setBusy(false);
    if (error || !data) { toast.error('Não foi possível gerar o link da agenda.'); return; }
    setToken(data as string); if (regen) toast.success('Novo link gerado. O antigo parou de funcionar.');
  };
  const url = token ? `${FN}?t=${token}` : '';
  const webcal = url.replace(/^https:/, 'webcal:');
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
  return (
    <>
      <Button variant="outline" size="sm" className={className} onClick={() => { setOpen(true); if (!token) void load(); }}><CalendarPlus className="mr-1 h-4 w-4" />Agenda no celular</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle className="flex items-center gap-2"><CalendarPlus className="h-5 w-5" />Ver no Google Agenda, Outlook ou iPhone</DialogTitle>
          <p className="text-sm text-muted-foreground">Seus cards com prazo e seus eventos e reuniões aparecem na agenda do celular e se atualizam sozinhos. O link é pessoal: não compartilhe.</p>
          {busy && !token ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : token ? (
            <div className="space-y-3">
              <div className="flex gap-2"><Input readOnly value={url} className="font-mono text-xs" aria-label="Link da agenda" />
                <Button variant="outline" size="icon" onClick={() => { void navigator.clipboard.writeText(url); toast.success('Link copiado'); }} aria-label="Copiar link"><Copy className="h-4 w-4" /></Button></div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Button asChild variant="outline"><a href={google} target="_blank" rel="noreferrer">Google Agenda</a></Button>
                <Button asChild variant="outline"><a href={webcal}>iPhone / Mac</a></Button>
                <Button asChild variant="outline"><a href={`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(url)}&name=ewvon`} target="_blank" rel="noreferrer">Outlook</a></Button>
              </div>
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                <li><b>Google Agenda (computador):</b> Outras agendas › “+” › “Do URL” › cole o link.</li>
                <li><b>iPhone:</b> Ajustes › Calendário › Contas › Adicionar conta › Outra › Adicionar calendário assinado.</li>
                <li><b>Outlook:</b> Adicionar calendário › Assinar da Web › cole o link.</li>
                <li>O Google atualiza calendários assinados algumas vezes por dia; mudanças podem demorar a aparecer.</li>
              </ul>
              <Button variant="ghost" size="sm" disabled={busy} onClick={async () => { if (await appConfirm({ title: 'Gerar novo link?', message: 'O link atual para de funcionar e você precisará assinar a agenda de novo.', confirmText: 'Gerar novo', danger: true })) void load(true); }}><RefreshCw className="mr-1.5 h-4 w-4" />Gerar novo link</Button>
            </div>) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
