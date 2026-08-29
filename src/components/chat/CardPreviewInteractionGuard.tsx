import { useEffect } from 'react';

const CARD_DIALOG_SELECTOR = '[data-card-preview-dialog]';

export function CardPreviewInteractionGuard() {
  useEffect(() => {
    let wasOpen = false;

    const sync = () => {
      const isOpen = document.body.classList.contains('card-preview-open');

      document.querySelectorAll<HTMLElement>('.mobile-chat-message').forEach((message) => {
        if (isOpen) {
          message.style.setProperty('pointer-events', 'none', 'important');
        } else {
          message.style.removeProperty('pointer-events');
        }
      });

      if (isOpen) {
        // Close any message-action/reaction state that was already open before the card.
        document.querySelectorAll<HTMLElement>('.mobile-chat-message .fixed.inset-0[aria-label="Fechar ações da mensagem"]').forEach((backdrop) => {
          backdrop.click();
        });
      } else if (wasOpen) {
        document.querySelectorAll<HTMLElement>('.mobile-chat-message .fixed.inset-0[aria-label="Fechar ações da mensagem"]').forEach((backdrop) => {
          backdrop.click();
        });
      }

      document.querySelectorAll<HTMLElement>('.mobile-reaction-picker').forEach((element) => {
        if (isOpen) {
          element.style.setProperty('display', 'none', 'important');
          element.style.setProperty('pointer-events', 'none', 'important');
        } else {
          element.style.removeProperty('display');
          element.style.removeProperty('pointer-events');
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
      if ('stopImmediatePropagation' in event) event.stopImmediatePropagation();
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    const events: Array<keyof DocumentEventMap> = ['click', 'pointerdown', 'pointerup', 'touchstart', 'touchmove', 'touchend', 'contextmenu'];
    events.forEach((eventName) => document.addEventListener(eventName, blockBackgroundInteraction, true));
    sync();

    return () => {
      observer.disconnect();
      document.querySelectorAll<HTMLElement>('.mobile-chat-message').forEach((message) => message.style.removeProperty('pointer-events'));
      events.forEach((eventName) => document.removeEventListener(eventName, blockBackgroundInteraction, true));
    };
  }, []);

  return null;
}
