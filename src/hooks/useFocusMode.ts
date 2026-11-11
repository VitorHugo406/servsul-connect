import { useSyncExternalStore } from 'react';

// Global focus-mode store (desktop only). The shell reacts through the `focus-mode` class on <html>.
const CLASS = 'focus-mode';
let active = false;
const listeners = new Set<() => void>();

const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;

// Publish the real top bar footprint so CSS can collapse it with a smooth margin transition.
const measureTopbar = () => {
  const bar = document.querySelector<HTMLElement>('.ewvon-topbar');
  if (!bar) return;
  const cs = getComputedStyle(bar);
  document.documentElement.style.setProperty('--focus-topbar-h', `${bar.offsetHeight + (parseFloat(cs.marginBottom) || 0)}px`);
};

export function setFocusMode(next: boolean) {
  if (next === active) return;
  if (next && !isDesktop()) return;
  if (next) measureTopbar();
  active = next;
  document.documentElement.classList.toggle(CLASS, next);
  listeners.forEach((l) => l());
}

export const toggleFocusMode = () => setFocusMode(!active);
export const isFocusMode = () => active;

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

export function useFocusMode() {
  return useSyncExternalStore(subscribe, () => active, () => false);
}
