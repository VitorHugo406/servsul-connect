import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Birthday PDF creation is an administrator-only capability.
 * Non-admins can still see the birthday list and greeting features, but no
 * PDF theme selector, corporate image uploader/remover, QR/PDF controls or
 * download action are exposed to them.
 */
export function AdminBirthdayPdfGuard() {
  const { isAdmin } = useAuth();

  useEffect(() => {
    if (isAdmin) return;

    const hide = (element: HTMLElement | null) => {
      if (!element) return;
      element.style.display = 'none';
      element.setAttribute('aria-hidden', 'true');
      element.querySelectorAll<HTMLElement>('button,input,select,textarea,[role="button"],[role="combobox"]').forEach(control => {
        control.setAttribute('disabled', 'true');
        control.setAttribute('aria-hidden', 'true');
        control.setAttribute('tabindex', '-1');
      });
    };

    const hidePdfControls = () => {
      document.querySelectorAll<HTMLElement>('button,label,p,span,div').forEach(element => {
        const text = element.textContent?.trim().toLowerCase() || '';
        if (!text || text.length > 140) return;

        const isPdfControl =
          text.includes('baixar pdf') ||
          text.includes('gerar pdf') ||
          text.includes('tema do pdf') ||
          text.includes('modelo do pdf') ||
          text.includes('imagem corporativa') ||
          text.includes('anexar imagem') ||
          text.includes('trocar imagem') ||
          text.includes('remover imagem') ||
          text.includes('qr code do relatório') ||
          text.includes('gerar relatório');

        if (isPdfControl) {
          // Hide the closest compact control section rather than only its text.
          hide(element.closest('[class*="rounded"], [class*="border"], section') as HTMLElement | null || element);
        }
      });

      document.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach(input => hide(input.closest('div')));
      document.querySelectorAll<HTMLSelectElement>('select').forEach(select => hide(select.closest('div')));
    };

    hidePdfControls();
    const observer = new MutationObserver(hidePdfControls);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isAdmin]);

  return null;
}
