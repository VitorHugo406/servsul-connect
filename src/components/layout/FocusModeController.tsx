import { useEffect } from 'react';
import { toast } from 'sonner';
import { setFocusMode, toggleFocusMode, toggleFocusSwitcher, useFocusMode } from '@/hooks/useFocusMode';

const TOAST_KEY = 'ewvon:focus-mode-toast';

// Main: Ctrl/Cmd+Shift+F. Extra: Ctrl/Cmd+Shift+T (browsers reserve it; works in installed apps/PWA).
const isSwitcherShortcut = (e: KeyboardEvent) => e.code === 'KeyE' && e.shiftKey && (e.ctrlKey || e.metaKey) && !e.altKey;

const isFocusShortcut = (e: KeyboardEvent) =>
  (e.code === 'KeyF' || e.code === 'KeyT') && e.shiftKey && (e.ctrlKey || e.metaKey) && !e.altKey;

// Keyboard shortcut, and first-time toast. No on-screen button: only the shortcut toggles focus mode.
export function FocusModeController() {
  const focus = useFocusMode();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isSwitcherShortcut(e)) {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) toggleFocusSwitcher();
        return;
      }
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
        if (!sessionStorage.getItem(TOAST_KEY)) { sessionStorage.setItem(TOAST_KEY, '1'); toast('Modo foco ligado. Ctrl+Shift+F volta · Ctrl+Shift+E troca de aba.'); }
      } catch { toast('Modo foco ligado. Ctrl+Shift+F volta · Ctrl+Shift+E troca de aba.'); }
    }
    const t = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 700);
    return () => window.clearTimeout(t);
  }, [focus]);

  return null;
}
