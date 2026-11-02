import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { chatTypographyKey, DEFAULT_CHAT_TYPOGRAPHY, parseChatTypography } from '@/lib/chatTypography';

export function useChatTypography() {
  const { profile } = useAuth();
  const key = profile ? chatTypographyKey(profile.company_id, profile.id) : null;
  const [value, setValue] = useState(DEFAULT_CHAT_TYPOGRAPHY);
  useEffect(() => {
    const load = () => { try { setValue(parseChatTypography(key ? localStorage.getItem(key) : null)); } catch { setValue(DEFAULT_CHAT_TYPOGRAPHY); } };
    load();
    window.addEventListener('nuvexa:chat-typography', load);
    window.addEventListener('storage', load);
    return () => { window.removeEventListener('nuvexa:chat-typography', load); window.removeEventListener('storage', load); };
  }, [key]);
  return { value, key, className: `chat-font-${value.font} chat-size-${value.size}` };
}