import { useEffect, useRef, useState } from 'react';
import { Minimize2 } from 'lucide-react';
import { toast } from 'sonner';
import { setFocusMode, toggleFocusMode, useFocusMode } from '@/hooks/useFocusMode';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const TOAST_KEY = 'ewvon:focus-mode-toast';
const HINT = 'Sair do modo foco (Ctrl+Shift+F)';

// Main: Ctrl/Cmd+Shift+F. Extra: Ctrl/Cmd+Shift+T (browsers reserve it; works in installed apps/PWA).
const isFocusShortcut = (e: KeyboardEvent) =>
  (e.code === 'KeyF' || e.code === 'KeyT') && e.shiftKey && (e.ctrlKey || e.metaKey) && !e.altKey;

// Keyboard shortcut, first-time toast and a discreet exit button shown near the top-right corner.
export function FocusModeController() {
  const focus = useFocusMode();
  const [near, setNear] = useState(false);
  const hideTimer = useRef<number>();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isFocusShortcut(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) toggleFocusMode();
    };
    const onResize = () => { if (window.innerWidth < 768) setFocusMode(false); };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', onResize); setFocusMode(false); };
  }, []);

  // Once per session: tell how to leave. Also re-measure the nav's top edge after the transition.
  useEffect(() => {
    if (focus) {
      try {
        if (!sessionStorage.getItem(TOAST_KEY)) { sessionStorage.setItem(TOAST_KEY, '1'); toast('Modo foco ligado. Pressione Ctrl+Shift+F para voltar.'); }
      } catch { toast('Modo foco ligado. Pressione Ctrl+Shift+F para voltar.'); }
    }
    const t = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 700);
    return () => window.clearTimeout(t);
  }, [focus]);

  useEffect(() => {
    if (!focus) { setNear(false); return; }
    const onMove = (e: MouseEvent) => {
      if (e.clientX < window.innerWidth - 140 || e.clientY > 90) return;
      setNear(true);
      window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setNear(false), 2000);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => { window.removeEventListener('mousemove', onMove); window.clearTimeout(hideTimer.current); };
  }, [focus]);

  if (!focus) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" onClick={() => setFocusMode(false)} aria-label={HINT}
          onFocus={() => setNear(true)} onBlur={() => setNear(false)}
          className={`focus-mode-exit fixed right-3 top-3 z-[45] flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-opacity duration-200 hover:text-foreground ${near ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
          <Minimize2 className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">{HINT}</TooltipContent>
    </Tooltip>
  );
}
