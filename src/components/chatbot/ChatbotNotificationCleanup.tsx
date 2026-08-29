import { useEffect } from 'react';

/** Keeps the home chatbot focused on pending attention only and shows an all-clear state when empty. */
export function ChatbotNotificationCleanup() {
  useEffect(() => {
    const cleanup = () => {
      const panels = Array.from(document.querySelectorAll<HTMLElement>('[class*="fixed"]')).filter((element) => element.textContent?.includes('Assistente Nuvexa'));
      panels.forEach((panel) => {
        const candidates = Array.from(panel.querySelectorAll<HTMLElement>('[class*="transition-colors"]'));
        let visiblePendingCards = 0;

        candidates.forEach((card) => {
          const className = card.className || '';
          if (className.includes('border-border') && className.includes('bg-background')) {
            card.style.display = 'none';
            card.setAttribute('aria-hidden', 'true');
          } else if (getComputedStyle(card).display !== 'none') {
            card.style.display = '';
            card.removeAttribute('aria-hidden');
            visiblePendingCards += 1;
          }
        });

        const notificationsArea = Array.from(panel.querySelectorAll<HTMLElement>('div')).find((element) => {
          const text = element.textContent?.trim() || '';
          return text === 'Notificações' || text === 'Notificacoes';
        });

        const existingEmptyState = panel.querySelector<HTMLElement>('[data-nuvexa-chatbot-all-clear]');
        if (visiblePendingCards === 0 && notificationsArea) {
          if (!existingEmptyState) {
            const empty = document.createElement('div');
            empty.setAttribute('data-nuvexa-chatbot-all-clear', 'true');
            empty.className = 'mx-4 my-4 rounded-xl border border-border bg-muted/40 px-4 py-6 text-center';
            empty.innerHTML = '<div class="text-2xl mb-2">✨</div><p class="text-sm font-semibold">Tudo em dia!</p><p class="mt-1 text-xs text-muted-foreground">Você não possui pendências ou novas notificações.</p>';
            panel.appendChild(empty);
          }
        } else {
          existingEmptyState?.remove();
        }
      });
    };

    cleanup();
    const observer = new MutationObserver(cleanup);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return null;
}
