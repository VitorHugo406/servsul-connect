// Search inside a direct or group conversation (the sector chat already has its own search). Looks in the whole
// history on the server (row-level security keeps it to conversations the person is in), newest first, and jumps
// to the message when it is loaded on screen.
import { useEffect, useRef, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { chatPreview } from '@/lib/stickers';
import { jumpToMessage } from './ChatActions';
import '@/styles/chat-extras.css';

const db = supabase as any;
type Hit = { id: string; content: string; sender_id: string; created_at: string };
const esc = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const SPECIAL = /^(📹|📞) ewvon-call:|^ewvon-poll:|^✨ (sticker|pack):|^🎤 \[|ewvon-delete:/;

function highlight(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  const start = Math.max(0, i - 40);
  return <>{start > 0 ? '…' : ''}{text.slice(start, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

export function ChatSearchPanel({ kind, id, meId, nameOf, onClose }: { kind: 'dm' | 'group'; id: string; meId: string; nameOf: (senderId: string) => string; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits(null); return; }
    let alive = true;
    const t = window.setTimeout(async () => {
      setBusy(true);
      const pat = `%${esc(term)}%`;
      const base = kind === 'group'
        ? db.from('private_group_messages').select('id,content,sender_id,created_at').eq('group_id', id)
        : db.from('direct_messages').select('id,content,sender_id,created_at').or(`and(sender_id.eq.${meId},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${meId})`);
      const { data, error } = await base.ilike('content', pat).order('created_at', { ascending: false }).limit(40);
      if (!alive) return;
      setBusy(false);
      if (error) { setHits([]); return; }
      setHits(((data || []) as Hit[]).filter((h) => !SPECIAL.test(h.content)));
    }, 300);
    return () => { alive = false; window.clearTimeout(t); };
  }, [q, kind, id, meId]);

  const open = (h: Hit) => { if (!jumpToMessage(h.id)) toast.info(`Mensagem de ${new Date(h.created_at).toLocaleDateString('pt-BR')}: role a conversa para cima para carregá-la.`); };
  return (
    <div className="cx-search" role="search">
      <div className="cx-sbar">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nesta conversa" aria-label="Buscar nesta conversa" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }} />
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        <button type="button" className="cx-iconbtn" onClick={onClose} aria-label="Fechar busca"><X className="h-4 w-4" /></button>
      </div>
      {hits ? <div className="cx-sres">
        {hits.length ? hits.map((h) => (
          <button key={h.id} type="button" className="cx-hit" onClick={() => open(h)}>
            <small>{nameOf(h.sender_id)} · {new Date(h.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>
            <span>{highlight(chatPreview(h.content, 400), q.trim())}</span>
          </button>
        )) : <div className="cx-empty">Nada encontrado para “{q.trim()}”.</div>}
      </div> : null}
    </div>
  );
}
