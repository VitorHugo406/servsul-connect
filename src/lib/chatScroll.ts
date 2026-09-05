/**
 * Scrolls the Radix ScrollArea viewport that contains `anchor` to the bottom.
 * Using scrollTop instead of scrollIntoView avoids scrolling ancestor
 * containers, which was making the chat feel stuck/jumpy.
 */
export function scrollChatToBottom(anchor: HTMLElement | null) {
  if (!anchor) return;
  const viewport =
    (anchor.closest('[data-radix-scroll-area-viewport]') as HTMLElement | null) ??
    (anchor.parentElement as HTMLElement | null);
  if (!viewport) return;
  viewport.scrollTop = viewport.scrollHeight;
}

/** True when the viewport containing `anchor` is close to its bottom. */
export function isNearBottom(anchor: HTMLElement | null, threshold = 150) {
  if (!anchor) return true;
  const viewport = anchor.closest('[data-radix-scroll-area-viewport]') as HTMLElement | null;
  if (!viewport) return true;
  return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= threshold;
}
