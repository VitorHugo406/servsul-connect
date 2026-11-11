import { useCallback, useEffect, useRef, useState } from 'react';
import { useVisibleMenuItems } from './menuItems';
import { setFocusSwitcher, useFocusMode, useFocusSwitcher } from '@/hooks/useFocusMode';

const ITEM = 44;      // width of one tab icon slot
const GEAR = 52;      // closed circle size / pill height
const PAD = 6;        // side padding of the pill
const MAX_VISIBLE = 9;
const AUTO_CLOSE_MS = 4000;
const EXIT_MS = 320;

interface Props { activeSection: string; onSectionChange: (section: string) => void; }

// Focus-mode tab switcher: a pill of tab icons that grows from a circle (opened with Ctrl+Shift+E).
// Keys are captured on window while open, so the focus stays in whatever field the user was typing in.
export function FocusTabSwitcher({ activeSection, onSectionChange }: Props) {
  const focus = useFocusMode();
  const wantOpen = useFocusSwitcher() && focus;
  const items = useVisibleMenuItems();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const hovering = useRef(false);
  const timer = useRef<number>();
  const lastWheel = useRef(0);

  const n = items.length;
  const idx = items.findIndex((i) => i.id === activeSection);
  const visible = Math.min(n, MAX_VISIBLE);
  const trackW = visible * ITEM;
  const pillW = trackW + PAD * 2;

  // Mount/unmount around the open flag so the collapse animation can play.
  useEffect(() => {
    if (wantOpen) {
      setMounted(true);
      let r2 = 0;
      const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setOpen(true)); });
      return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
    }
    setOpen(false);
    const t = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(t);
  }, [wantOpen]);

  const arm = useCallback(() => {
    window.clearTimeout(timer.current);
    if (hovering.current) return;
    timer.current = window.setTimeout(() => setFocusSwitcher(false), AUTO_CLOSE_MS);
  }, []);

  useEffect(() => {
    if (!wantOpen) { window.clearTimeout(timer.current); return; }
    arm();
    return () => window.clearTimeout(timer.current);
  }, [wantOpen, arm]);

  const go = useCallback((dir: 1 | -1) => {
    if (n === 0) return;
    const next = idx < 0 ? (dir === 1 ? 0 : n - 1) : (idx + dir + n) % n;
    onSectionChange(items[next].id);
    arm();
  }, [n, idx, items, onSectionChange, arm]);

  useEffect(() => {
    if (!wantOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const stop = () => { e.preventDefault(); e.stopPropagation(); };
      if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) { stop(); go(1); }
      else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) { stop(); go(-1); }
      else if (e.key === 'Enter' || e.key === 'Escape') { stop(); setFocusSwitcher(false); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [wantOpen, go]);

  if (!mounted || n === 0) return null;

  const offset = n > MAX_VISIBLE
    ? Math.min(0, Math.max(trackW - n * ITEM, trackW / 2 - ((idx < 0 ? 0 : idx) + 0.5) * ITEM))
    : 0;
  const current = idx >= 0 ? items[idx] : null;

  return (
    <div
      className="focus-switcher"
      data-open={open ? 'true' : 'false'}
      role="dialog"
      aria-label="Trocar de aba"
      style={{ ['--fs-w' as string]: `${pillW}px`, ['--fs-gear' as string]: `${GEAR}px`, ['--fs-item' as string]: `${ITEM}px` }}
      onPointerEnter={() => { hovering.current = true; window.clearTimeout(timer.current); }}
      onPointerLeave={() => { hovering.current = false; arm(); }}
      onWheel={(e) => {
        const now = Date.now();
        if (now - lastWheel.current < 140 || Math.abs(e.deltaY + e.deltaX) < 4) return;
        lastWheel.current = now;
        go(e.deltaY + e.deltaX > 0 ? 1 : -1);
      }}
    >
      <div className="focus-switcher-pill">
        <div className="focus-switcher-viewport" style={{ width: trackW, ['--fs-fade' as string]: n > MAX_VISIBLE ? '1' : '0' }} data-scroll={n > MAX_VISIBLE ? 'true' : 'false'}>
          <div className="focus-switcher-track" style={{ transform: `translateX(${offset}px)`, width: n * ITEM }}>
            {idx >= 0 && <span className="focus-switcher-bubble" aria-hidden style={{ transform: `translateX(${idx * ITEM}px)` }} />}
            {items.map((item, i) => {
              const Icon = item.icon;
              const active = i === idx;
              return (
                <button key={item.id} type="button" className="focus-switcher-item" data-active={active ? 'true' : 'false'}
                  aria-label={item.label} title={item.label} aria-current={active ? 'page' : undefined}
                  style={{ left: i * ITEM, ['--fs-i' as string]: Math.min(i, 14) }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { if (!active) { onSectionChange(item.id); } arm(); }}>
                  <span className="focus-switcher-icon" key={active ? `a-${activeSection}` : 'i'}><Icon size={22} strokeWidth={2} aria-hidden /></span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="focus-switcher-caption" aria-live="polite">
        {current && <span className="focus-switcher-label" key={current.id}>{current.label}</span>}
      </div>
    </div>
  );
}
