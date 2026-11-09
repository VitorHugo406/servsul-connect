// Google Drive files attached to a task card (links only: nothing is copied into the plan's storage).
// Uses the person's own Google connection (Integrações > Minha conta Google) and the Google Picker.
import { useCallback, useEffect, useState } from 'react';
import { HardDrive, Loader2, Paperclip, X, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Attachment = { id: string; name: string; url: string; mime_type: string | null; icon_url: string | null };
declare global { interface Window { gapi?: any; google?: any } }

let pickerReady: Promise<void> | null = null;
function loadPicker(): Promise<void> {
  return (pickerReady ??= new Promise<void>((resolve, reject) => {
    const done = () => window.gapi.load('picker', { callback: () => resolve(), onerror: () => reject(new Error('picker')) });
    if (window.gapi) return done();
    const s = document.createElement('script');
    s.src = 'https://apis.google.com/js/api.js'; s.async = true;
    s.onload = done; s.onerror = () => { pickerReady = null; reject(new Error('script')); };
    document.head.appendChild(s);
  }));
}

// The card is a modal dialog: let the picker (rendered outside it) receive clicks without closing the card.
function freePickerFromModal() {
  let tries = 0;
  const t = window.setInterval(() => {
    document.querySelectorAll<HTMLElement>('.picker-dialog').forEach((el) => {
      el.style.pointerEvents = 'auto';
      if (!el.dataset.ewv) { el.dataset.ewv = '1'; ['pointerdown', 'mousedown'].forEach((ev) => el.addEventListener(ev, (e) => e.stopPropagation())); }
    });
    if (++tries > 40) window.clearInterval(t);
  }, 50);
}

export function TaskDriveAttachments({ taskId }: { taskId: string }) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data } = await (supabase as any).from('task_attachments').select('id, name, url, mime_type, icon_url').eq('task_id', taskId).order('created_at');
    setItems((data || []) as Attachment[]);
  }, [taskId]);
  useEffect(() => { void load(); }, [load]);

  const pick = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('integrations/google-token', { body: {} });
      if (error || !(data as any)?.access_token) {
        let msg = 'Conecte sua conta Google em Integrações > Minha conta Google.';
        try { const b = await (error as any)?.context?.json?.(); if (b?.error) msg = b.error; } catch { /* ignore */ }
        toast.error(msg); return;
      }
      const cfg = data as any;
      await loadPicker();
      const g = window.google.picker;
      const picker = new g.PickerBuilder()
        .addView(new g.DocsView().setIncludeFolders(true).setSelectFolderEnabled(false))
        .enableFeature(g.Feature.MULTISELECT_ENABLED)
        .setOAuthToken(cfg.access_token).setDeveloperKey(cfg.api_key).setAppId(cfg.project_number)
        .setOrigin(window.location.protocol + '//' + window.location.host).setLocale('pt-BR').setTitle('Anexar do Google Drive')
        .setCallback(async (res: any) => {
          if (res[g.Response.ACTION] !== g.Action.PICKED) return;
          const docs = (res[g.Response.DOCUMENTS] || []) as any[];
          const rows = docs.map((d) => ({ task_id: taskId, provider: 'google_drive', name: String(d[g.Document.NAME] || 'Arquivo').slice(0, 300), url: String(d[g.Document.URL] || ''), mime_type: d[g.Document.MIME_TYPE] || null, icon_url: d[g.Document.ICON_URL] || null })).filter((r) => r.url.startsWith('https://'));
          if (!rows.length) return;
          const { error: insErr } = await (supabase as any).from('task_attachments').insert(rows);
          if (insErr) toast.error('Não foi possível anexar.'); else { toast.success(rows.length > 1 ? `${rows.length} arquivos anexados.` : 'Arquivo anexado.'); void load(); }
        })
        .build();
      picker.setVisible(true);
      freePickerFromModal();
    } catch {
      toast.error('Não foi possível abrir o Google Drive agora.');
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from('task_attachments').delete().eq('id', id);
    if (error) toast.error('Não foi possível remover.'); else setItems((x) => x.filter((i) => i.id !== id));
  };

  return (
    <div className="space-y-2 px-4 py-2">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold"><Paperclip className="h-4 w-4" />Anexos</h4>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => void pick()} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HardDrive className="h-3.5 w-3.5" />}Anexar do Drive
        </Button>
      </div>
      {items.length ? (
        <div className="space-y-1.5">
          {items.map((a) => (
            <div key={a.id} className="group flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-sm">
              {a.icon_url ? <img src={a.icon_url} alt="" className="h-4 w-4 shrink-0" /> : <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate hover:underline">{a.name}</a>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <button type="button" onClick={() => void remove(a.id)} className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100" aria-label={`Remover ${a.name}`}><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      ) : <p className="text-xs text-muted-foreground">Nenhum arquivo anexado. Os arquivos ficam no Drive e não ocupam o armazenamento do plano.</p>}
    </div>
  );
}
