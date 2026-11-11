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
  if (!next) setFocusSwitcher(false);
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

// Focus-mode tab switcher (gear pill) open state. Only meaningful while focus mode is on.
let switcherOpen = false;
const switcherListeners = new Set<() => void>();
export function setFocusSwitcher(next: boolean) {
  if (next && !active) return;
  if (next === switcherOpen) return;
  switcherOpen = next;
  switcherListeners.forEach((l) => l());
}
export const toggleFocusSwitcher = () => setFocusSwitcher(!switcherOpen);
export const isFocusSwitcherOpen = () => switcherOpen;
const subscribeSwitcher = (cb: () => void) => { switcherListeners.add(cb); return () => { switcherListeners.delete(cb); }; };
export function useFocusSwitcher() {
  return useSyncExternalStore(subscribeSwitcher, () => switcherOpen, () => false);
}
