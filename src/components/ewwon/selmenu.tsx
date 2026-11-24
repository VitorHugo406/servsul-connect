// Own text-selection bar for the mobile chat: when part of a message is selected, a small bar in the app's style
// offers "Copiar" and "Selecionar tudo" (the whole message). The Android app (APK 2.2.0) empties the system's floating
// selection toolbar, so only this bar shows there; in a mobile browser the system bar may still appear as well.
import { useEffect, useState } from 'react';

type Pos = { x: number; y: number; below: boolean };
const bubbleOf = (n: Node | null) => (n ? ((n.nodeType === 1 ? n : n.parentElement) as Element | null)?.closest('.ew .bub') : null);

export function SelectionMenu({ toast }: { toast: (m: string) => void }) {
  const [pos, setPos] = useState<Pos | null>(null);
  useEffect(() => {
    let raf = 0;
    const upd = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const s = document.getSelection();
        if (!s || s.isCollapsed || !s.rangeCount || !s.toString().trim()) { setPos(null); return; }
        const b = bubbleOf(s.anchorNode); if (!b || b !== bubbleOf(s.focusNode)) { setPos(null); return; }
        const r = s.getRangeAt(0).getBoundingClientRect();
        const below = r.top < 120;
        setPos({ x: Math.min(Math.max(r.left + r.width / 2, 110), window.innerWidth - 110), y: below ? r.bottom + 34 : r.top - 12, below });
      });
    };
    document.addEventListener('selectionchange', upd);
    window.addEventListener('scroll', upd, true);
    return () => { document.removeEventListener('selectionchange', upd); window.removeEventListener('scroll', upd, true); cancelAnimationFrame(raf); };
  }, []);
  if (!pos) return null;
  const keep = (e: React.SyntheticEvent) => e.preventDefault();   // do not lose the selection when tapping the bar
  const copy = async () => {
    const txt = document.getSelection()?.toString() || '';
    try { await navigator.clipboard.writeText(txt); } catch {
      const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    document.getSelection()?.removeAllRanges(); setPos(null); toast('Texto copiado');
  };
  const all = () => {
    const s = document.getSelection(); const b = bubbleOf(s?.anchorNode || null); if (!s || !b) return;
    const r = document.createRange(); r.selectNodeContents(b); s.removeAllRanges(); s.addRange(r);
  };
  return (
    <div className={`ewx-selbar ${pos.below ? 'below' : ''}`} style={{ left: pos.x, top: pos.y }} onMouseDown={keep} onTouchStart={keep} role="toolbar" aria-label="Texto selecionado">
      <button type="button" onMouseDown={keep} onTouchEnd={(e) => { e.preventDefault(); void copy(); }} onClick={() => void copy()}>Copiar</button>
      <i />
      <button type="button" onMouseDown={keep} onTouchEnd={(e) => { e.preventDefault(); all(); }} onClick={all}>Selecionar tudo</button>
    </div>
  );
}
