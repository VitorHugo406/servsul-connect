import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * The birthday PDF is generated entirely in the browser. This guard keeps the
 * existing birthday UI unchanged while removing the PDF download action from
 * non-admin users, including when the section is rendered after navigation.
 */
export function AdminBirthdayPdfGuard() {
  const { isAdmin } = useAuth();

  useEffect(() => {
    if (isAdmin) return;

    const hidePdfButtons = () => {
      document.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
        const text = button.textContent?.trim().toLowerCase() || '';
        if (text.includes('baixar pdf')) {
          button.style.display = 'none';
          button.setAttribute('aria-hidden', 'true');
          button.setAttribute('tabindex', '-1');
        }
      });
    };

    hidePdfButtons();
    const observer = new MutationObserver(hidePdfButtons);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isAdmin]);

  return null;
}
