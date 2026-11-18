// /m/<token>: read-only mural for external guests (no login). Data comes only from public_board_view(); refreshes every 60 s.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarDays, CheckSquare, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type Card = { id: string; n: number | null; title: string; col: string; due: string | null; priority: string | null; done: boolean; labels: { name: string; color: string | null }[]; check: [number, number] };
type View = { name: string; description: string | null; company: string | null; columns: { id: string; title: string; color: string | null; done: boolean | null }[]; cards: Card[] };
const PRIO: Record<string, string> = { urgent: 'Urgente', high: 'Alta', low: 'Baixa' };

export default function PublicBoard() {
  const { token } = useParams();
  const [v, setV] = useState<View | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    const load = async () => { const { data, error } = await (supabase as any).rpc('public_board_view', { _token: token || '' }); if (live) setV(error ? null : (data as View) || null); };
    void load(); const t = setInterval(load, 60000); return () => { live = false; clearInterval(t); };
  }, [token]);
  useEffect(() => { if (v) document.title = `${v.name} | ewvon`; }, [v]);
  if (v === undefined) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!v) return <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center"><b className="text-lg">Link indisponível</b><p className="text-sm text-muted-foreground">Este mural não está mais compartilhado ou o link está errado. Peça um novo link a quem enviou.</p></div>;
  const now = Date.now();
  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-background px-5 py-3">
        <div className="min-w-0 flex-1"><h1 className="truncate text-lg font-semibold">{v.name}</h1><p className="truncate text-xs text-muted-foreground">{v.company ? `${v.company} · ` : ''}Somente visualização · atualiza a cada minuto</p></div>
        <a href="/" className="text-xs font-semibold text-muted-foreground hover:text-foreground">ewvon</a>
      </header>
      {v.description ? <p className="mx-5 mt-3 text-sm text-muted-foreground">{v.description}</p> : null}
      <main className="flex flex-1 gap-3 overflow-x-auto p-5">
        {v.columns.map((c) => { const cards = v.cards.filter((x) => x.col === c.id); return (
          <section key={c.id} className="flex w-72 shrink-0 flex-col rounded-xl bg-background/80 p-2 shadow-sm">
            <div className="flex items-center gap-2 px-2 py-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color || '#9ca3af' }} /><b className="flex-1 truncate text-sm">{c.title}</b><span className="text-xs text-muted-foreground">{cards.length}</span></div>
            <div className="flex flex-col gap-2">
              {cards.map((t) => { const late = !!t.due && !t.done && !c.done && new Date(t.due).getTime() < now; return (
                <article key={t.id} className="rounded-lg border border-border bg-card p-2.5 text-sm shadow-sm">
                  {t.labels.length ? <div className="mb-1.5 flex flex-wrap gap-1">{t.labels.map((l, i) => <span key={i} className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: l.color || '#6b7280' }}>{l.name}</span>)}</div> : null}
                  <p className={t.done || c.done ? 'text-muted-foreground line-through' : ''}>{t.n ? <span className="mr-1 text-xs text-muted-foreground">#{t.n}</span> : null}{t.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {t.due ? <span className={`inline-flex items-center gap-1 ${late ? 'font-semibold text-red-600' : ''}`}><CalendarDays className="h-3 w-3" />{new Date(t.due).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}{late ? ' · atrasado' : ''}</span> : null}
                    {t.check?.[1] ? <span className="inline-flex items-center gap-1"><CheckSquare className="h-3 w-3" />{t.check[0]}/{t.check[1]}</span> : null}
                    {t.priority && PRIO[t.priority] ? <span>{PRIO[t.priority]}</span> : null}
                  </div>
                </article>); })}
              {!cards.length ? <p className="px-2 py-3 text-center text-xs text-muted-foreground">Sem cards</p> : null}
            </div>
          </section>); })}
      </main>
    </div>
  );
}
