// Busca geral (PC): Ctrl+K / ⌘K or the magnifier of the top bar. One box finds screens (only the ones the person
// can open), cards (title or #número, from every mural the person can see — RLS), murais and colleagues.
// Enter / click: card → its mural with the card open (?abrir=), mural → the mural, person → chat with them,
// screen → the screen. Arrow keys move through the results (cmdk).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command as Cmd } from 'cmdk';
import { CornerDownLeft, LayoutGrid, Loader2, Search, SquareCheckBig, User } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import '@/styles/global-search.css';

type Sec = { id: string; label: string; description: string };
type Card = { id: string; title: string; task_number: number | null; board_id: string; completed_at: string | null };
type Board = { id: string; name: string };
type Person = { id: string; name: string; display_name: string | null; avatar_url: string | null };
const db = supabase as any;
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slug = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function GlobalSearch({ open, onOpenChange, sections, onSection }: { open: boolean; onOpenChange: (o: boolean) => void; sections: Sec[]; onSection: (id: string) => void }) {
  const navigate = useNavigate(); const { profile } = useAuth();
  const [q, setQ] = useState('');
  const [boards, setBoards] = useState<Board[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  useEffect(() => { if (!open) { setQ(''); setCards([]); setPeople([]); return; }
    void db.from('task_boards').select('id,name').order('name').limit(500).then(({ data }: { data: Board[] | null }) => setBoards(data || []));
  }, [open]);

  useEffect(() => {
    const term = q.trim(); if (!open || term.length < 2) { setCards([]); setPeople([]); setBusy(false); return; }
    const my = ++seq.current; setBusy(true);
    const t = setTimeout(async () => {
      const like = `%${term.replace(/[%_]/g, '')}%`; const num = /^#?\d+$/.test(term) ? Number(term.replace('#', '')) : null;
      const base = () => db.from('tasks').select('id,title,task_number,board_id,completed_at').eq('is_template', false).eq('is_archived', false).not('board_id', 'is', null);
      const [c1, c2, p] = await Promise.all([
        base().ilike('title', like).order('updated_at', { ascending: false }).limit(8),
        num != null ? base().eq('task_number', num).limit(5) : Promise.resolve({ data: [] }),
        db.from('profiles').select('id,name,display_name,avatar_url').eq('is_active', true).or(`name.ilike.${like},display_name.ilike.${like}`).limit(6),
      ]);
      if (my !== seq.current) return;
      const m = new Map<string, Card>(); for (const c of [...(c2.data || []), ...(c1.data || [])]) m.set(c.id, c);
      setCards([...m.values()].slice(0, 10)); setPeople(((p.data || []) as Person[]).filter((x) => x.id !== profile?.id)); setBusy(false);
    }, 200);
    return () => clearTimeout(t);
  }, [q, open, profile?.id]);

  const bname = useMemo(() => new Map(boards.map((b) => [b.id, b.name])), [boards]);
  const f = fold(q.trim());
  const secs = (f ? sections.filter((s) => fold(s.label + ' ' + s.description).includes(f)) : sections).slice(0, f ? 6 : 8);
  const bds = f ? boards.filter((b) => fold(b.name).includes(f)).slice(0, 6) : [];
  const close = () => onOpenChange(false);
  const goBoard = (b: Board, task?: string) => { close(); navigate(`/tarefas/${slug(b.name)}-${b.id}${task ? `?abrir=${task}` : ''}`); };
  const goCard = (c: Card) => goBoard({ id: c.board_id, name: bname.get(c.board_id) || 'mural' }, c.id);
  const goPerson = (p: Person) => { try { sessionStorage.setItem('ewvon:open-dm', p.id); } catch { /* storage off */ } close(); onSection('chat'); window.dispatchEvent(new CustomEvent('ewvon:open-dm', { detail: p.id })); };
  const nothing = f.length >= 2 && !busy && !secs.length && !bds.length && !cards.length && !people.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gs-dlg max-w-[640px] gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Busca geral</DialogTitle>
        <Cmd shouldFilter={false} loop className="gs">
          <div className="gs-in"><Search className="h-[18px] w-[18px]" /><Cmd.Input autoFocus value={q} onValueChange={setQ} placeholder="Buscar cards, murais, pessoas ou telas…" />{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <kbd>Esc</kbd>}</div>
          <Cmd.List className="gs-list">
            {nothing ? <p className="gs-empty">Nada encontrado para "{q.trim()}".</p> : null}
            {cards.length ? <Cmd.Group heading="Cards">{cards.map((c) => (
              <Cmd.Item key={c.id} value={'c' + c.id} onSelect={() => goCard(c)} className="gs-it">
                <SquareCheckBig className={c.completed_at ? 'gs-ok' : ''} /><span className="gs-t">{c.task_number ? <em>#{c.task_number}</em> : null}{c.title}</span><small>{bname.get(c.board_id) || ''}</small>
              </Cmd.Item>))}</Cmd.Group> : null}
            {bds.length ? <Cmd.Group heading="Murais">{bds.map((b) => (
              <Cmd.Item key={b.id} value={'b' + b.id} onSelect={() => goBoard(b)} className="gs-it"><LayoutGrid /><span className="gs-t">{b.name}</span></Cmd.Item>))}</Cmd.Group> : null}
            {people.length ? <Cmd.Group heading="Pessoas">{people.map((p) => (
              <Cmd.Item key={p.id} value={'p' + p.id} onSelect={() => goPerson(p)} className="gs-it">
                {p.avatar_url ? <img src={p.avatar_url} alt="" className="gs-av" /> : <User />}<span className="gs-t">{p.display_name || p.name}</span><small>Conversar</small>
              </Cmd.Item>))}</Cmd.Group> : null}
            {secs.length ? <Cmd.Group heading={f ? 'Telas' : 'Ir para'}>{secs.map((s) => (
              <Cmd.Item key={s.id} value={'s' + s.id} onSelect={() => { close(); onSection(s.id); }} className="gs-it"><CornerDownLeft /><span className="gs-t">{s.label}</span><small>{s.description}</small></Cmd.Item>))}</Cmd.Group> : null}
          </Cmd.List>
          <div className="gs-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Ctrl</kbd><kbd>K</kbd> abrir a busca de qualquer tela</span></div>
        </Cmd>
      </DialogContent>
    </Dialog>
  );
}
