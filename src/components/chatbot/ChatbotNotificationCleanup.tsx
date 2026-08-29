import { useEffect } from 'react';

/** Keeps the home chatbot focused on pending attention only. */
export function ChatbotNotificationCleanup() {
  useEffect(() => {
    const cleanup = () => {
      const panels = Array.from(document.querySelectorAll<HTMLElement>('[class*="fixed"]')).filter((element) => element.textContent?.includes('Assistente Nuvexa'));
      panels.forEach((panel) => {
        panel.querySelectorAll<HTMLElement>('[class*="transition-colors"]').forEach((card) => {
          const className = card.className || '';
          if (className.includes('border-border') && className.includes('bg-background')) {
            card.style.display = 'none';
            card.setAttribute('aria-hidden', 'true');
          } else {
            card.style.display = '';
            card.removeAttribute('aria-hidden');
          }
        });
      });
    };
    cleanup();
    const observer = new MutationObserver(cleanup);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return null;
}
