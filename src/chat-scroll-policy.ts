const originalScrollIntoView = Element.prototype.scrollIntoView;

let allowSmoothScroll = false;
let smoothTimer: number | undefined;

const markChatArrowScroll = (event: Event) => {
  const target = event.target as Element | null;
  const trigger = target?.closest?.('button[title="Ir para o final"]');
  if (!trigger) return;

  allowSmoothScroll = true;
  if (smoothTimer !== undefined) window.clearTimeout(smoothTimer);
  smoothTimer = window.setTimeout(() => {
    allowSmoothScroll = false;
    smoothTimer = undefined;
  }, 1200);
};

document.addEventListener('pointerdown', markChatArrowScroll, true);
document.addEventListener('click', markChatArrowScroll, true);

Element.prototype.scrollIntoView = function scrollIntoViewPatched(arg?: boolean | ScrollIntoViewOptions) {
  if (arg && typeof arg === 'object' && arg.behavior === 'smooth' && !allowSmoothScroll) {
    originalScrollIntoView.call(this, { ...arg, behavior: 'auto' });
    return;
  }

  originalScrollIntoView.call(this, arg);
};
