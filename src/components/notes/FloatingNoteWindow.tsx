import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFloatingNote } from '@/contexts/FloatingNoteContext';
import { useNotes } from '@/hooks/useNotes';
import { X, GripHorizontal } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { mergeNoteHtml } from '@/lib/noteMerge';
import { getImageCss, getTextureCss, getTextureSize } from './noteStyles';

export function FloatingNoteWindow() {
  const { floatingNote, mode, closeFloating } = useFloatingNote();
  const { notes, saveContent } = useNotes();
  // Live copy of the note (the context keeps the snapshot from when the window opened).
  const live = floatingNote ? (notes.find((n) => n.id === floatingNote.id) ?? floatingNote) : null;
  const canEdit = live ? live.my_permission !== 'read' : false;
  const [html, setHtml] = useState(live?.content ?? '');
  const [syncKey, setSyncKey] = useState(0);
  const cur = useRef(html), base = useRef(html), pending = useRef(false), saving = useRef(false);
  const timer = useRef<number | null>(null);
  const show = (h: string) => { cur.current = h; setHtml(h); setSyncKey((k) => k + 1); };
  useEffect(() => { base.current = live?.content ?? ''; pending.current = false; show(base.current); }, [live?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!live) return;
    if (live.content === base.current || live.content === cur.current) { base.current = live.content; return; }
    if (!pending.current && !saving.current) { base.current = live.content; show(live.content); }
  }, [live?.content]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    if (!live || !canEdit || saving.current || !pending.current) return;
    saving.current = true; pending.current = false;
    const sent = cur.current;
    const stored = await saveContent(live.id, base.current, sent);
    saving.current = false;
    if (stored === null) { pending.current = true; return; }
    base.current = stored;
    const now = cur.current;
    if (now === sent) { if (stored !== sent) show(stored); }
    else { const m = mergeNoteHtml(sent, now, stored); if (m !== now) show(m); if (m !== stored) { pending.current = true; schedule(); } }
  };
  const saveRef = useRef(save); saveRef.current = save;
  const schedule = () => { if (timer.current) window.clearTimeout(timer.current); timer.current = window.setTimeout(() => { void saveRef.current(); }, 600); };
  useEffect(() => () => { void saveRef.current(); }, [live?.id]);
  const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null);
  const [pos, setPos] = useState({ x: window.innerWidth - 380, y: 80 });
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  // Set up PiP container
  useEffect(() => {
    if (mode !== 'pip') {
      setPipContainer(null);
      return;
    }
    const pipWin = (window as any).documentPictureInPicture?.window as Window | undefined;
    if (!pipWin) return;
    let div = pipWin.document.getElementById('pip-root') as HTMLElement | null;
    if (!div) {
      div = pipWin.document.createElement('div');
      div.id = 'pip-root';
      pipWin.document.body.appendChild(div);
    }
    setPipContainer(div);
  }, [mode, floatingNote?.id]);

  if (!floatingNote || !mode || !live) return null;

  const handleContentChange = (h: string) => {
    if (!canEdit) return;
    cur.current = h; setHtml(h); pending.current = true; schedule();
  };

  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    const move = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({ x: ev.clientX - dragRef.current.dx, y: ev.clientY - dragRef.current.dy });
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const bgImageCss = getImageCss(live.background_image);
  const textureCss = getTextureCss(live.background_texture);
  const backgroundImage = [bgImageCss, textureCss].filter(Boolean).join(', ');

  const content = (
    <div
      style={{
        background: live.background_color,
        backgroundImage,
        backgroundSize: textureCss ? getTextureSize(live.background_texture) : 'cover',
      }}
      className="flex flex-col h-full w-full overflow-hidden rounded-2xl border border-border shadow-2xl"
    >
      <div
        className="flex items-center gap-2 cursor-move bg-black/10 px-3 py-2 select-none"
        onMouseDown={mode === 'internal' ? onMouseDown : undefined}
      >
        <GripHorizontal className="h-4 w-4 opacity-60" />
        <p className="flex-1 truncate text-sm font-medium">{live.title}</p>
        {!canEdit ? <span className="rounded-full bg-black/10 px-2 py-0.5 text-[11px] font-medium">Só visualização</span> : null}
        <button onClick={closeFloating} className="rounded p-1 hover:bg-black/20" title="Fechar janela flutuante">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3">
        <RichTextEditor value={html} syncKey={syncKey} onChange={handleContentChange} readOnly={!canEdit} />
      </div>
    </div>
  );

  if (mode === 'pip' && pipContainer) {
    return createPortal(<div className="h-screen w-screen">{content}</div>, pipContainer);
  }

  if (mode === 'internal') {
    return (
      <div
        className="fixed z-[100] w-[360px] h-[480px]"
        style={{ left: pos.x, top: pos.y }}
      >
        {content}
      </div>
    );
  }

  return null;
}
