import { useEffect } from 'react';

const CARD_DIALOG_SELECTOR = '[data-card-preview-dialog]';

export function CardPreviewInteractionGuard() {
  useEffect(() => {
    let wasOpen = false;

    const sync = () => {
      const isOpen = document.body.classList.contains('card-preview-open');

      if (wasOpen && !isOpen) {
        const messageBackdrop = document.querySelector<HTMLElement>('.mobile-chat-message .fixed.inset-0[aria-label="Fechar ações da mensagem"]');
        messageBackdrop?.click();
      }

      document.querySelectorAll<HTMLElement>('.mobile-reaction-picker').forEach((element) => {
        if (isOpen) {
          element.style.setProperty('display', 'none', 'important');
        } else {
          element.style.removeProperty('display');
        }
      });

      if (isOpen) {
        document.querySelectorAll<HTMLElement>('.mobile-chat-message-focused').forEach((element) => {
          element.classList.remove('mobile-chat-message-focused');
        });
      }

      wasOpen = isOpen;
    };

    const blockBackgroundInteraction = (event: Event) => {
      if (!document.body.classList.contains('card-preview-open')) return;
      const target = event.target;
      if (target instanceof Node && (target as Element).closest?.(CARD_DIALOG_SELECTOR)) return;
      event.preventDefault();
      event.stopPropagation();
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    const events: Array<keyof DocumentEventMap> = ['click', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'contextmenu'];
    events.forEach((eventName) => document.addEventListener(eventName, blockBackgroundInteraction, true));
    sync();

    return () => {
      observer.disconnect();
      events.forEach((eventName) => document.removeEventListener(eventName, blockBackgroundInteraction, true));
    };
  }, []);

  return null;
}
