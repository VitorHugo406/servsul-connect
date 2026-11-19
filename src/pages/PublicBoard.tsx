// /m/<token>: mural for external guests (no login). Data comes only from public_board_view(); refreshes every 60 s.
// When the owner allowed it (allow_comments), clicking a card opens its guest conversation: comment, approve or ask for
// changes (public_board_comment; the name is remembered in this browser).
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarDays, CheckSquare, Loader2, MessageSquare, ThumbsUp, Undo2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type G = { name: string; text: string; kind: 'comment' | 'approve' | 'reject'; at: string };
type Card = { id: string; n: number | null; title: string; col: string; due: string | null; priority: string | null; done: boolean; labels: { name: string; color: string | null }[]; check: [number, number]; guest?: G[] };
type View = { name: string; description: string | null; company: string | null; allow_comments?: boolean; columns: { id: string; title: string; color: string | null; done: boolean | null }[]; cards: Card[] };
const PRIO: Record<string, string> = { urgent: 'Urgente', high: 'Alta', low: 'Baixa' };

export default function PublicBoard() {
  const { token } = useParams();
  const [v, setV] = useState<View | null | undefined>(undefined);
  const [openId, setOpenId] = useState<string | null>(null);
  const load = useCallback(async () => { const { data, error } = await (supabase as any).rpc('public_board_view', { _token: token || '' }); setV(error ? null : (data as View) || null); }, [token]);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 60000); return () => clearInterval(t); }, [load]);
  useEffect(() => { if (v) document.title = `${v.name} | ewvon`; }, [v]);
  if (v === undefined) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!v) return <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center"><b className="text-lg">Link indisponível</b><p className="text-sm text-muted-foreground">Este mural não está mais compartilhado ou o link está errado. Peça um novo link a quem enviou.</p></div>;
  const now = Date.now();
  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-background px-5 py-3">
        <div className="min-w-0 flex-1"><h1 className="truncate text-lg font-semibold">{v.name}</h1><p className="truncate text-xs text-muted-foreground">{v.company ? `${v.company} · ` : ''}{v.allow_comments ? 'Clique num card para comentar ou aprovar' : 'Somente visualização'} · atualiza a cada minuto</p></div>
        <a href="/" className="text-xs font-semibold text-muted-foreground hover:text-foreground">ewvon</a>
      </header>
      {v.description ? <p className="mx-5 mt-3 text-sm text-muted-foreground">{v.description}</p> : null}
      <main className="flex flex-1 gap-3 overflow-x-auto p-5">
        {v.columns.map((c) => { const cards = v.cards.filter((x) => x.col === c.id); return (
          <section key={c.id} className="flex w-72 shrink-0 flex-col rounded-xl bg-background/80 p-2 shadow-sm">
            <div className="flex items-center gap-2 px-2 py-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color || '#9ca3af' }} /><b className="flex-1 truncate text-sm">{c.title}</b><span className="text-xs text-muted-foreground">{cards.length}</span></div>
            <div className="flex flex-col gap-2">
              {cards.map((t) => { const late = !!t.due && !t.done && !c.done && new Date(t.due).getTime() < now; return (
                <article key={t.id} className={`rounded-lg border border-border bg-card p-2.5 text-sm shadow-sm ${v.allow_comments ? 'cursor-pointer hover:border-primary/50' : ''}`} onClick={() => v.allow_comments && setOpenId(t.id)}>
                  {t.labels.length ? <div className="mb-1.5 flex flex-wrap gap-1">{t.labels.map((l, i) => <span key={i} className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: l.color || '#6b7280' }}>{l.name}</span>)}</div> : null}
                  <p className={t.done || c.done ? 'text-muted-foreground line-through' : ''}>{t.n ? <span className="mr-1 text-xs text-muted-foreground">#{t.n}</span> : null}{t.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {t.due ? <span className={`inline-flex items-center gap-1 ${late ? 'font-semibold text-red-600' : ''}`}><CalendarDays className="h-3 w-3" />{new Date(t.due).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}{late ? ' · atrasado' : ''}</span> : null}
                    {t.check?.[1] ? <span className="inline-flex items-center gap-1"><CheckSquare className="h-3 w-3" />{t.check[0]}/{t.check[1]}</span> : null}
                    {t.priority && PRIO[t.priority] ? <span>{PRIO[t.priority]}</span> : null}
                    {t.guest?.length ? <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{t.guest.length}</span> : null}
                    {t.guest?.some((g) => g.kind === 'approve') ? <span className="font-semibold text-emerald-600">Aprovado</span> : null}
                  </div>
                </article>); })}
              {!cards.length ? <p className="px-2 py-3 text-center text-xs text-muted-foreground">Sem cards</p> : null}
            </div>
          </section>); })}
      </main>
      {openId && v.allow_comments ? <GuestPanel token={token || ''} card={v.cards.find((c) => c.id === openId)!} onClose={() => setOpenId(null)} onSent={() => void load()} /> : null}
    </div>
  );
}

function GuestPanel({ token, card, onClose, onSent }: { token: string; card: Card; onClose: () => void; onSent: () => void }) {
  const [name, setName] = useState(() => { try { return localStorage.getItem('ewvon:guest-name') || ''; } catch { return ''; } });
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  if (!card) return null;
  const send = async (kind: 'comment' | 'approve' | 'reject') => {
    setErr(''); if (!name.trim()) { setErr('Informe seu nome.'); return; } if (kind === 'comment' && !text.trim()) { setErr('Escreva o comentário.'); return; }
    setBusy(true);
    const { error } = await (supabase as any).rpc('public_board_comment', { _token: token, _task: card.id, _name: name.trim(), _text: text.trim(), _kind: kind });
    setBusy(false);
    if (error) { setErr((error.message || '').match(/GUEST_[A-Z]+:(.*)$/)?.[1] || 'Não foi possível enviar.'); return; }
    try { localStorage.setItem('ewvon:guest-name', name.trim()); } catch { /* private mode */ }
    setText(''); onSent();
  };
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside className="flex h-full w-full max-w-md flex-col bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start gap-2 border-b border-border p-4"><div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">Card #{card.n}</p><h2 className="font-semibold">{card.title}</h2></div><button type="button" onClick={onClose} aria-label="Fechar"><X className="h-5 w-5" /></button></header>
        <div className="flex-1 space-y-3 overflow-auto p-4">
          {!card.guest?.length ? <p className="text-sm text-muted-foreground">Ainda não há comentários de convidados neste card.</p> : card.guest.map((g, i) => (
            <div key={i} className={`rounded-lg border p-3 text-sm ${g.kind === 'approve' ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' : g.kind === 'reject' ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30' : 'border-border'}`}>
              <p className="mb-1 text-xs text-muted-foreground"><b className="text-foreground">{g.name}</b> · {new Date(g.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}{g.kind === 'approve' ? ' · aprovou' : g.kind === 'reject' ? ' · pediu ajustes' : ''}</p>
              {g.text ? <p className="whitespace-pre-line">{g.text}</p> : null}
            </div>))}
        </div>
        <footer className="space-y-2 border-t border-border p-4">
          <input className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm" placeholder="Seu nome" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          <textarea className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" rows={3} placeholder="Escreva um comentário para a equipe" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} />
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void send('comment')} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-foreground px-3 text-sm font-medium text-background disabled:opacity-60"><MessageSquare className="h-4 w-4" />Comentar</button>
            <button type="button" disabled={busy} onClick={() => void send('approve')} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-emerald-500 px-3 text-sm font-medium text-emerald-700 disabled:opacity-60"><ThumbsUp className="h-4 w-4" />Aprovar</button>
            <button type="button" disabled={busy} onClick={() => void send('reject')} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-amber-500 px-3 text-sm font-medium text-amber-700 disabled:opacity-60"><Undo2 className="h-4 w-4" />Pedir ajustes</button>
          </div>
          <p className="text-[11px] text-muted-foreground">Seu nome e comentário ficam visíveis para quem tem este link e para a equipe responsável.</p>
        </footer>
      </aside>
    </div>
  );
}
