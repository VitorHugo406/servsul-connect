const originalScrollIntoView = Element.prototype.scrollIntoView;
let allowChatAutoScroll = false;
let timer: number | null = null;

const armButtonScroll = (event: Event) => {
  const target = event.target as Element | null;
  const button = target?.closest?.('button[title="Ir para o final"]');
  if (!button) return;
  allowChatAutoScroll = true;
  if (timer !== null) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    allowChatAutoScroll = false;
    timer = null;
  }, 500);
};

document.addEventListener('pointerdown', armButtonScroll, true);
document.addEventListener('click', armButtonScroll, true);

Element.prototype.scrollIntoView = function patchedScrollIntoView(arg?: boolean | ScrollIntoViewOptions) {
  const options = typeof arg === 'object' && arg !== null ? arg : undefined;
  const isChatViewportTarget = !!this.closest?.('[data-radix-scroll-area-viewport]');

  // Chat automatic positioning must never move the user's history viewport.
  // The explicit bottom-arrow action is the only exception and is animated.
  if (isChatViewportTarget && !allowChatAutoScroll) {
    return;
  }

  if (allowChatAutoScroll) {
    originalScrollIntoView.call(this, { ...(options || {}), behavior: 'smooth' });
    allowChatAutoScroll = false;
    return;
  }

  originalScrollIntoView.call(this, arg as any);
};
