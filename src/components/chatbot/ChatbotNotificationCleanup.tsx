import { useEffect } from 'react';

/** Keeps the home chatbot focused on pending attention only. The existing
 * chatbot already persists read state; this guard removes read notification
 * cards from its visual list without changing the notification source. */
export function ChatbotNotificationCleanup() {
  useEffect(() => {
    const cleanup = () => {
      const panels = Array.from(document.querySelectorAll<HTMLElement>('[class*="fixed"]')).filter((element) => element.textContent?.includes('Assistente Nuvexa'));
      panels.forEach((panel) => {
        panel.querySelectorAll<HTMLElement>('[class*="transition-colors"][class*="border-border"][class*="bg-background"]').forEach((card) => {
          card.style.display = 'none';
          card.setAttribute('aria-hidden', 'true');
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
