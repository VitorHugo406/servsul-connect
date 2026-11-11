// Desktop reaction effects, same feel as the Ewwon mobile app (EwwonApp burst): the chosen emoji
// "explodes" into 22 small copies that fly out and fade, and the reaction chip does a boom.
// Purely visual; never touches messages or permissions.
let lastReactAt = 0;
/** True for ~1.5s after the user added a reaction here (so chips appearing then get the "boom"). */
export const reactedJustNow = () => Date.now() - lastReactAt < 1500;

export const motionReduced = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** Emoji burst from `origin` (the picker button or the chip). Particles live on <body> so no container can clip them. */
export function reactionBurst(origin: Element | null | undefined, emoji: string) {
  lastReactAt = Date.now();
  if (!origin || typeof document === 'undefined' || motionReduced()) return;
  const a = origin.getBoundingClientRect();
  const cx = a.left + a.width / 2, cy = a.top + a.height / 2;
  const els: HTMLElement[] = [];
  for (let i = 0; i < 22; i++) {
    const p = document.createElement('span');
    const ang = Math.random() * 6.283, r = 40 + Math.random() * 85, s = 10 + Math.random() * 15;
    p.className = 'chat-rx-bp';
    p.setAttribute('aria-hidden', 'true');
    p.textContent = emoji === '❤️' && i % 6 === 5 ? '💖' : emoji;
    p.style.cssText = `left:${cx - s / 2}px;top:${cy - s / 2}px;--s:${s}px;--dx:${Math.cos(ang) * r}px;--dy:${Math.sin(ang) * r - 26}px;--r:${(Math.random() - 0.5) * 100}deg;--d:${Math.random() * 0.22}s`;
    els.push(p); document.body.appendChild(p);
  }
  window.setTimeout(() => els.forEach((p) => p.remove()), 1700);
}
