// Per-message actions shared by the three desktop chats (sector, direct, group): "⋯" menu with Fixar no topo /
// Criar card / Copiar texto, the pinned-messages bar under the header and the "message → card" dialog.
// The conversation key is the same as chat_settings (sector:<id>, group:<id>, dm:<a>:<b> sorted), so everyone in the
// conversation shares the pins. Pins need the chat_pins table (migration 20261121010000): useDbFeature hides them
// until it exists; creating a card only uses existing tables.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronUp, Copy, ListTodo, Loader2, MoreHorizontal, Pin, PinOff, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDbFeature } from '@/hooks/useDbFeature';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sel } from '@/components/ui/Sel';
import * as CT from '@/lib/chatTasks';
import { chatPreview } from '@/lib/stickers';
import { createSignedStorageUrl } from '@/lib/storageUrls';
import '@/styles/chat-extras.css';

export type ChatMsg = { id: string; content: string; created_at: string; authorName: string };
type Pin = { id: string; message_id: string; preview: string; author_name: string | null; message_at: string | null; created_at: string };
type Ctx = { convKey: string | null; pinsEnabled: boolean; pinned: Set<string>; pin: (m: ChatMsg) => void; unpin: (messageId: string) => void; toCard: (m: ChatMsg) => void };

const ChatActionsContext = createContext<Ctx | null>(null);
const db = supabase as any;
const ATT = /^(📷|📎) \[(.+?)\]\((.+?)\)$/;

/** Scrolls to a loaded message and flashes it; returns false when it is not on screen (older than the loaded page). */
export function jumpToMessage(id: string): boolean {
  const el = document.querySelector<HTMLElement>(`[data-msg-id="${CSS.escape(id)}"]`) || document.getElementById(`msg-${id}`);
  if (!el) return false;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.classList.remove('cx-flash'); void el.offsetWidth; el.classList.add('cx-flash');
  window.setTimeout(() => el.classList.remove('cx-flash'), 1700);
  return true;
}

export function useChatActions({ kind, id, convLabel, onPost }: { kind: 'sector' | 'dm' | 'group'; id: string | null | undefined; convLabel: string; onPost?: (text: string) => unknown }) {
  const { profile } = useAuth();
  const convKey = id && profile?.id ? CT.chatSettingsKey(kind, id, profile.id) : null;
  const pinsTable = useDbFeature('chat_pins');
  const pinsEnabled = pinsTable && !!convKey;
  const [pins, setPins] = useState<Pin[]>([]);
  const [cardFor, setCardFor] = useState<ChatMsg | null>(null);

  const load = useCallback(async () => {
    if (!pinsEnabled || !convKey) { setPins([]); return; }
    const { data } = await db.from('chat_pins').select('id,message_id,preview,author_name,message_at,created_at').eq('conv_key', convKey).order('created_at', { ascending: false }).limit(20);
    setPins(data || []);
  }, [pinsEnabled, convKey]);

  useEffect(() => {
    void load();
    if (!pinsEnabled || !convKey) return;
    const ch = db.channel(`cx-pins-${convKey}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_pins', filter: `conv_key=eq.${convKey}` }, () => void load())
      .subscribe();
    return () => { void db.removeChannel(ch); };
  }, [load, pinsEnabled, convKey]);

  const pin = useCallback(async (m: ChatMsg) => {
    if (!convKey) return;
    const { error } = await db.from('chat_pins').insert({ conv_key: convKey, message_id: m.id, preview: chatPreview(m.content, 160) || 'Mensagem', author_name: m.authorName, message_at: m.created_at });
    if (error) { toast.error(/duplicate|unique/i.test(error.message) ? 'Essa mensagem já está fixada.' : 'Não foi possível fixar. O limite é de 20 mensagens fixadas por conversa.'); return; }
    toast.success('Mensagem fixada no topo da conversa'); void load();
  }, [convKey, load]);
  const unpin = useCallback(async (messageId: string) => {
    if (!convKey) return;
    const { error } = await db.from('chat_pins').delete().eq('conv_key', convKey).eq('message_id', messageId);
    if (error) { toast.error('Não foi possível desafixar.'); return; }
    void load();
  }, [convKey, load]);

  const pinned = useMemo(() => new Set(pins.map((p) => p.message_id)), [pins]);
  const ctx = useMemo<Ctx>(() => ({ convKey, pinsEnabled, pinned, pin: (m) => void pin(m), unpin: (x) => void unpin(x), toCard: (m) => setCardFor(m) }), [convKey, pinsEnabled, pinned, pin, unpin]);
  const dialogs = <MessageToCardDialog msg={cardFor} convLabel={convLabel} onClose={() => setCardFor(null)} onPost={onPost} />;
  return { ctx, pins, pinsEnabled, convKey, unpin: (x: string) => void unpin(x), dialogs };
}

export function ChatActionsProvider({ value, children }: { value: Ctx; children: ReactNode }) {
  return <ChatActionsContext.Provider value={value}>{children}</ChatActionsContext.Provider>;
}

/** "⋯" next to a bubble. Renders nothing outside a ChatActionsProvider. */
export function MessageMoreMenu({ msg, align = 'start', bare = false }: { msg: ChatMsg; align?: 'start' | 'end'; bare?: boolean }) {
  const ctx = useContext(ChatActionsContext);
  if (!ctx || msg.id.startsWith('temp-')) return null;
  const isPinned = ctx.pinned.has(msg.id);
  const text = msg.content.split('\n').filter((l) => !ATT.test(l)).join('\n').trim();
  return (
    <div className={bare ? undefined : 'cx-tools'}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="cx-iconbtn" title="Mais ações" aria-label="Mais ações da mensagem"><MoreHorizontal className="h-4 w-4" /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-52">
          {ctx.pinsEnabled ? (isPinned
            ? <DropdownMenuItem onClick={() => ctx.unpin(msg.id)}><PinOff className="mr-2 h-4 w-4" />Desafixar</DropdownMenuItem>
            : <DropdownMenuItem onClick={() => ctx.pin(msg)}><Pin className="mr-2 h-4 w-4" />Fixar no topo</DropdownMenuItem>) : null}
          <DropdownMenuItem onClick={() => ctx.toCard(msg)}><ListTodo className="mr-2 h-4 w-4" />Criar card</DropdownMenuItem>
          {text ? <><DropdownMenuSeparator /><DropdownMenuItem onClick={() => { void navigator.clipboard?.writeText(text).then(() => toast.success('Texto copiado'), () => toast.error('Não foi possível copiar')); }}><Copy className="mr-2 h-4 w-4" />Copiar texto</DropdownMenuItem></> : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Bar under the conversation header with the pinned messages (newest first). */
export function PinnedBar({ pins, onUnpin }: { pins: Pin[]; onUnpin: (messageId: string) => void }) {
  const [i, setI] = useState(0);
  useEffect(() => { if (i >= pins.length) setI(0); }, [pins.length, i]);
  if (!pins.length) return null;
  const p = pins[Math.min(i, pins.length - 1)];
  const go = (x: Pin) => { if (!jumpToMessage(x.message_id)) toast.info('Essa mensagem é antiga: role a conversa para cima para carregá-la.'); };
  const when = (x: Pin) => (x.message_at ? new Date(x.message_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
  return (
    <div className="cx-pinbar" role="region" aria-label="Mensagens fixadas">
      <span className="cx-pin-ic"><Pin className="h-3.5 w-3.5" /></span>
      <button type="button" className="cx-pin-body" onClick={() => go(p)} title="Ir até a mensagem">
        <b>{pins.length > 1 ? `Mensagem fixada ${i + 1} de ${pins.length}` : 'Mensagem fixada'}{p.author_name ? ` · ${p.author_name}` : ''}</b>
        <span>{p.preview}</span>
      </button>
      <div className="cx-pin-nav">
        {pins.length > 1 ? <>
          <button type="button" className="cx-iconbtn" onClick={() => setI((v) => (v - 1 + pins.length) % pins.length)} aria-label="Fixada anterior"><ChevronUp className="h-4 w-4" /></button>
          <button type="button" className="cx-iconbtn" onClick={() => setI((v) => (v + 1) % pins.length)} aria-label="Próxima fixada"><ChevronDown className="h-4 w-4" /></button>
        </> : null}
        <Popover>
          <PopoverTrigger asChild><button type="button" className="cx-iconbtn" aria-label="Ver todas as fixadas" title="Ver todas"><MoreHorizontal className="h-4 w-4" /></button></PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-2">
            <div className="px-2 pb-1 pt-1 text-xs font-semibold text-muted-foreground">Fixadas ({pins.length})</div>
            <div className="cx-pinlist">
              {pins.map((x) => (
                <div key={x.id} className="cx-pin-item" onClick={() => go(x)}>
                  <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1"><p>{x.preview}</p><small>{[x.author_name, when(x)].filter(Boolean).join(' · ')}</small></div>
                  <button type="button" className="cx-iconbtn" onClick={(e) => { e.stopPropagation(); onUnpin(x.message_id); }} aria-label="Desafixar" title="Desafixar"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

const plainTitle = (content: string) => {
  const lines = content.split('\n').filter((l) => !ATT.test(l)).map((l) => l.replace(/[*_~]/g, '').trim()).filter(Boolean);
  const att = content.split('\n').map((l) => l.match(ATT)).find(Boolean);
  const first = lines[0] || (att ? `Arquivo: ${att[2]}` : 'Nova tarefa');
  return first.length > 120 ? first.slice(0, 117).trimEnd() + '…' : first;
};

/** Copies a chat file into the person's own folder so it outlives the chat media clean-up (7 days). */
async function copyAttachment(url: string, name: string, userId: string): Promise<string | null> {
  try {
    const signed = await createSignedStorageUrl(url);
    const res = await fetch(signed); if (!res.ok) return null;
    const blob = await res.blob();
    const ext = (name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6) || 'bin';
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const up = await supabase.storage.from('attachments').upload(path, blob, { contentType: blob.type || 'application/octet-stream', upsert: false });
    if (up.error) return null;
    return supabase.storage.from('attachments').getPublicUrl(path).data.publicUrl;
  } catch { return null; }
}

const BOARD_KEY = 'ewvon:msg-card-board';
function MessageToCardDialog({ msg, convLabel, onClose, onPost }: { msg: ChatMsg | null; convLabel: string; onClose: () => void; onPost?: (text: string) => unknown }) {
  const { profile, user } = useAuth();
  const [boards, setBoards] = useState<CT.ChatBoard[] | null>(null);
  const [boardId, setBoardId] = useState('');
  const [cols, setCols] = useState<CT.ChatColumn[]>([]);
  const [colId, setColId] = useState('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState('medium');
  const [due, setDue] = useState('');
  const [withFiles, setWithFiles] = useState(true);
  const [asCover, setAsCover] = useState(true);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const atts = useMemo(() => (msg ? msg.content.split('\n').map((l) => l.match(ATT)).filter(Boolean).map((m) => ({ img: m![1] === '📷', name: m![2], url: m![3] })) : []), [msg]);

  useEffect(() => {
    if (!msg) return;
    const text = msg.content.split('\n').filter((l) => !ATT.test(l)).join('\n').trim();
    const when = new Date(msg.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    setTitle(plainTitle(msg.content)); setDesc(`${text}${text ? '\n\n' : ''}— Mensagem de ${msg.authorName} em ${when}${convLabel ? ` (${convLabel})` : ''}`);
    setPriority('medium'); setDue(''); setWithFiles(true); setAsCover(true); setNotify(true);
    void CT.listBoards().then((b) => {
      setBoards(b);
      let saved = ''; try { saved = localStorage.getItem(BOARD_KEY) || ''; } catch { /* storage unavailable */ }
      setBoardId(b.some((x) => x.id === saved) ? saved : b[0]?.id || '');
    }).catch(() => setBoards([]));
  }, [msg, convLabel]);
  useEffect(() => {
    if (!boardId) { setCols([]); setColId(''); return; }
    void CT.listColumns(boardId).then((c) => { setCols(c); setColId((c.find((x) => !x.is_conclusion) || c[0])?.id || ''); }).catch(() => setCols([]));
  }, [boardId]);

  const create = async () => {
    const column = cols.find((c) => c.id === colId);
    if (!msg || !profile?.id || !user?.id || !boardId || !column || !title.trim()) return;
    setBusy(true);
    try {
      let description = desc.trim(); let cover: string | null = null; let missing = 0;
      if (withFiles && atts.length) {
        const lines: string[] = [];
        for (const a of atts) {
          const url = await copyAttachment(a.url, a.name, user.id);
          if (!url) { missing += 1; continue; }
          lines.push(`${a.img ? '📷' : '📎'} [${a.name}](${url})`);
          if (a.img && asCover && !cover) cover = url;
        }
        if (lines.length) description = `${description}\n\n${lines.join('\n')}`.trim();
      }
      const task = await CT.createTask({ boardId, column, title: title.trim(), description, priority, dueDate: due ? `${due}T21:00:00Z` : null, meProfileId: profile.id });
      if (cover) await db.from('tasks').update({ cover_image: cover }).eq('id', task.id);
      try { localStorage.setItem(BOARD_KEY, boardId); } catch { /* storage unavailable */ }
      const board = boards?.find((b) => b.id === boardId);
      if (notify && onPost) await onPost(CT.cardMessage(task, board?.name || 'Mural', '📋 Card criado a partir de uma mensagem'));
      toast.success(`Card #${task.task_number ?? ''} criado em ${board?.name || 'mural'}`);
      if (missing) toast.info(missing === 1 ? 'Um anexo já não estava disponível e ficou de fora.' : `${missing} anexos já não estavam disponíveis e ficaram de fora.`);
      onClose();
    } catch { toast.error('Não foi possível criar o card. Confira se você ainda tem acesso ao mural.'); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={!!msg} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar card a partir da mensagem</DialogTitle>
          <DialogDescription>O texto vai para a descrição do card e os anexos são copiados para o card.</DialogDescription>
        </DialogHeader>
        {boards === null ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          : !boards.length ? <p className="py-6 text-center text-sm text-muted-foreground">Você ainda não participa de nenhum mural. Crie ou entre em um mural na aba Tarefas.</p>
          : <div className="cx-form">
            <div className="cx-two">
              <div><label className="cx-l">Mural</label><Sel className="ui-sel w-full" value={boardId} onChange={(e) => setBoardId(e.target.value)} aria-label="Mural">{boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Sel></div>
              <div><label className="cx-l">Coluna</label><Sel className="ui-sel w-full" value={colId} onChange={(e) => setColId(e.target.value)} aria-label="Coluna">{cols.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Sel></div>
            </div>
            <div><label className="cx-l" htmlFor="cx-card-title">Título</label><Input id="cx-card-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><label className="cx-l" htmlFor="cx-card-desc">Descrição</label><Textarea id="cx-card-desc" rows={5} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
            <div className="cx-two">
              <div><label className="cx-l">Prioridade</label><Sel className="ui-sel w-full" value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Prioridade"><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="urgent">Urgente</option></Sel></div>
              <div><label className="cx-l" htmlFor="cx-card-due">Prazo</label><Input id="cx-card-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
            </div>
            <div className="cx-checks">
              {atts.length ? <label><input type="checkbox" checked={withFiles} onChange={(e) => setWithFiles(e.target.checked)} />Levar {atts.length === 1 ? 'o anexo' : `os ${atts.length} anexos`} para o card</label> : null}
              {atts.some((a) => a.img) && withFiles ? <label><input type="checkbox" checked={asCover} onChange={(e) => setAsCover(e.target.checked)} />Usar a primeira imagem como capa</label> : null}
              {onPost ? <label><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />Avisar na conversa que o card foi criado</label> : null}
            </div>
          </div>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={() => void create()} disabled={busy || !boards?.length || !colId || !title.trim()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Criar card</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
