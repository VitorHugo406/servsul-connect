import { useEffect } from 'react';

/**
 * Keeps the chat completely inert while a mobile card preview is open.
 * The dialog itself is rendered by Radix in a portal, so we deliberately do
 * not install a document-level click/touch interceptor: doing that can eat
 * the very event that opens/closes the dialog and leave React in a bad state.
 */
export function CardPreviewInteractionGuard() {
  useEffect(() => {
    let locked = false;
    let previousOverflow = '';
    let previousTouchAction = '';

    const lock = () => {
      if (locked) return;
      locked = true;
      previousOverflow = document.body.style.overflow;
      previousTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      document.documentElement.style.overscrollBehavior = 'none';

      document.querySelectorAll<HTMLElement>('.mobile-chat-message').forEach((message) => {
        message.setAttribute('inert', '');
        message.setAttribute('aria-hidden', 'true');
      });

      document.querySelectorAll<HTMLElement>('.mobile-reaction-picker').forEach((element) => {
        element.setAttribute('inert', '');
        element.setAttribute('aria-hidden', 'true');
      });
    };

    const unlock = () => {
      if (!locked) return;
      locked = false;
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
      document.documentElement.style.overscrollBehavior = '';

      document.querySelectorAll<HTMLElement>('.mobile-chat-message').forEach((message) => {
        message.removeAttribute('inert');
        message.removeAttribute('aria-hidden');
      });
      document.querySelectorAll<HTMLElement>('.mobile-reaction-picker').forEach((element) => {
        element.removeAttribute('inert');
        element.removeAttribute('aria-hidden');
      });
    };

    const sync = () => {
      const isOpen = document.body.classList.contains('card-preview-open');
      if (isOpen) lock();
      else unlock();
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    sync();

    return () => {
      observer.disconnect();
      unlock();
      document.documentElement.style.overscrollBehavior = '';
    };
  }, []);

  return null;
}
