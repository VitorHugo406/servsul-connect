import { useEffect } from 'react';

/** Keeps the home chatbot focused on pending attention and guarantees a visible all-clear state in Novidades. */
export function ChatbotNotificationCleanup() {
  useEffect(() => {
    const cleanup = () => {
      const panels = Array.from(document.querySelectorAll<HTMLElement>('[class*="fixed"]')).filter((element) => {
        const text = element.textContent || '';
        return text.includes('Novidades') && (text.includes('Ajuda') || text.includes('Setores'));
      });

      panels.forEach((panel) => {
        const novidadesButton = Array.from(panel.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('Novidades'));
        const isNovidadesActive = !!novidadesButton && (
          novidadesButton.className.includes('bg-background') ||
          novidadesButton.getAttribute('aria-selected') === 'true'
        );

        const existingEmptyState = panel.querySelector<HTMLElement>('[data-nuvexa-chatbot-all-clear]');
        if (!isNovidadesActive) {
          existingEmptyState?.remove();
          return;
        }

        const candidates = Array.from(panel.querySelectorAll<HTMLElement>('[class*="transition-colors"]'));
        const visiblePendingCards = candidates.filter((card) => {
          const text = card.textContent?.trim() || '';
          if (!text || card.hasAttribute('data-nuvexa-chatbot-all-clear')) return false;
          return getComputedStyle(card).display !== 'none' && !card.getAttribute('aria-hidden');
        });

        if (visiblePendingCards.length === 0) {
          if (!existingEmptyState) {
            const empty = document.createElement('div');
            empty.setAttribute('data-nuvexa-chatbot-all-clear', 'true');
            empty.className = 'mx-4 my-4 rounded-xl border border-border bg-muted/40 px-4 py-6 text-center';
            empty.innerHTML = '<div class="mb-2 text-2xl">✨</div><p class="text-sm font-semibold text-foreground">Tudo em dia!</p><p class="mt-1 text-xs text-muted-foreground">Você não possui pendências ou novas notificações.</p>';
            panel.appendChild(empty);
          }
        } else {
          existingEmptyState?.remove();
        }
      });
    };

    cleanup();
    const observer = new MutationObserver(cleanup);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-selected'] });
    return () => observer.disconnect();
  }, []);

  return null;
}
