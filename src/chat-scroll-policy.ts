const originalScrollIntoView = Element.prototype.scrollIntoView;
let allowArrowScroll = false;
let arrowTimer: number | undefined;

const markArrowScroll = (event: Event) => {
  const target = event.target as Element | null;
  const trigger = target?.closest?.('button[title="Ir para o final"]');
  if (!trigger) return;
  allowArrowScroll = true;
  if (arrowTimer !== undefined) window.clearTimeout(arrowTimer);
  arrowTimer = window.setTimeout(() => {
    allowArrowScroll = false;
    arrowTimer = undefined;
  }, 1500);
};

document.addEventListener('pointerdown', markArrowScroll, true);
document.addEventListener('click', markArrowScroll, true);

Element.prototype.scrollIntoView = function scrollIntoViewChatSafe(arg?: boolean | ScrollIntoViewOptions) {
  // Chat components historically call scrollIntoView repeatedly while messages
  // are appended. Those calls must never move the user's viewport. The only
  // intentional animated scroll is the explicit "Ir para o final" action.
  if (!allowArrowScroll) return;
  originalScrollIntoView.call(this, arg && typeof arg === 'object'
    ? { ...arg, behavior: 'smooth' }
    : { behavior: 'smooth' });
};
