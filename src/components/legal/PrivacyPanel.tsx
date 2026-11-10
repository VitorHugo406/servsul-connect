// "Meus dados e privacidade": links to the documents, download of a copy of my data and requests (LGPD art. 18).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { LEGAL, LEGAL_DOCS, LEGAL_PATH, type LegalDocId } from '@/lib/legal';

const db = supabase as any;
const KINDS = [
  { id: 'access', label: 'Acesso / confirmação de tratamento' }, { id: 'correction', label: 'Correção de dados' },
  { id: 'deletion', label: 'Exclusão / anonimização' }, { id: 'portability', label: 'Portabilidade' },
  { id: 'consent', label: 'Revogar consentimento' }, { id: 'info', label: 'Informações sobre compartilhamento' },
] as const;

export function PrivacyPanel() {
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<string>('access');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const download = async () => {
    setBusy(true);
    const { data, error } = await db.rpc('export_my_data');
    setBusy(false);
    if (error || !data) { toast.error('Não foi possível gerar seus dados agora.'); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `meus-dados-ewvon-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
    toast.success('Cópia dos seus dados baixada.');
  };
  const send = async () => {
    setSending(true);
    const { error } = await db.rpc('request_privacy_action', { _kind: kind, _note: note.trim() || null });
    setSending(false);
    if (error) { toast.error('Não foi possível registrar o pedido.'); return; }
    setNote(''); toast.success('Pedido registrado. Respondemos em até 15 dias.');
  };
  const docs: LegalDocId[] = ['termos', 'privacidade', 'cookies'];
  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">Seus direitos da LGPD. Encarregado (DPO): {LEGAL.dpo} – {LEGAL.email}.</p>
      <div className="flex flex-wrap gap-3">{docs.map((d) => <Link key={d} to={LEGAL_PATH[d]} target="_blank" className="text-primary underline">{LEGAL_DOCS[d].title.split(' (')[0]}</Link>)}</div>
      <button type="button" onClick={() => void download()} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 font-medium">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Baixar uma cópia dos meus dados</button>
      <div className="space-y-2 rounded-xl border p-3">
        <p className="font-medium">Fazer um pedido</p>
        <select className="h-9 w-full rounded-md border bg-background px-2" value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select>
        <textarea className="min-h-[70px] w-full rounded-md border bg-background p-2" placeholder="Detalhes (opcional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        <button type="button" onClick={() => void send()} disabled={sending} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 font-semibold text-primary-foreground">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Enviar pedido</button>
      </div>
    </div>
  );
}
