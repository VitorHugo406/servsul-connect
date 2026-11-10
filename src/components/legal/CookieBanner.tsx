// Informs (once) that ewvon only uses essential storage; no tracking cookies. Remembered in localStorage.
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Cookie } from 'lucide-react';

const KEY = 'ewvon:cookie-notice-v1';
export function CookieBanner() {
  const [show, setShow] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { try { setShow(!localStorage.getItem(KEY)); } catch { setShow(true); } }, []);
  if (!show || pathname === '/cookies') return null;
  const ok = () => { try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } setShow(false); };
  return (
    <div className="ewvon-cookie" role="region" aria-label="Aviso de cookies">
      <Cookie className="h-5 w-5 shrink-0" />
      <p>Usamos apenas armazenamento essencial para o funcionamento (login, preferências e cache do app). Não há cookies de publicidade nem rastreamento. <Link to="/cookies">Saiba mais</Link> · <Link to="/privacidade">Privacidade</Link></p>
      <button type="button" onClick={ok}>Entendi</button>
    </div>
  );
}
