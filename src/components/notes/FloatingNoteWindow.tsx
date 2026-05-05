import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFloatingNote } from '@/contexts/FloatingNoteContext';
import { useNotes } from '@/hooks/useNotes';
import { X, GripHorizontal } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { getImageCss, getTextureCss, getTextureSize } from './noteStyles';

export function FloatingNoteWindow() {
  const { floatingNote, mode, closeFloating } = useFloatingNote();
  const { updateNote } = useNotes();
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

  if (!floatingNote || !mode) return null;

  const handleContentChange = (html: string) => {
    updateNote(floatingNote.id, { content: html });
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

  const bgImageCss = getImageCss(floatingNote.background_image);
  const textureCss = getTextureCss(floatingNote.background_texture);
  const backgroundImage = [bgImageCss, textureCss].filter(Boolean).join(', ');

  const content = (
    <div
      style={{
        background: floatingNote.background_color,
        backgroundImage,
        backgroundSize: textureCss ? getTextureSize(floatingNote.background_texture) : 'cover',
      }}
      className="flex flex-col h-full w-full overflow-hidden rounded-lg border border-border shadow-2xl"
    >
      <div
        className="flex items-center gap-2 cursor-move bg-black/10 px-3 py-2 select-none"
        onMouseDown={mode === 'internal' ? onMouseDown : undefined}
      >
        <GripHorizontal className="h-4 w-4 opacity-60" />
        <p className="flex-1 truncate text-sm font-medium">{floatingNote.title}</p>
        <button onClick={closeFloating} className="rounded p-1 hover:bg-black/20" title="Fechar janela flutuante">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3">
        <RichTextEditor value={floatingNote.content} onChange={handleContentChange} />
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
