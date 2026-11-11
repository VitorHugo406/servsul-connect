import { ReactNode, useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

/** Collapsible group in the conversation list (Favoritos, Chats, Setores, Grupos). Open/closed state is remembered per company + profile. */
export function ChatListSection({ id, label, count, children }: { id: string; label: string; count: number; children: ReactNode }) {
  const { profile } = useAuth();
  const storageKey = `nuvexa:chat-section:${profile?.company_id || '-'}:${profile?.id || '-'}:${id}`;
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try { setOpen(localStorage.getItem(storageKey) !== 'closed'); } catch { setOpen(true); }
  }, [storageKey]);
  const toggle = () => {
    const next = !open; setOpen(next);
    try { localStorage.setItem(storageKey, next ? 'open' : 'closed'); } catch { /* storage unavailable: state stays in memory */ }
  };
  return <section className="chat-list-section" data-open={open}>
    <button type="button" className="chat-list-section-head" aria-expanded={open} onClick={toggle}><ChevronDown className="chat-list-chevron h-3.5 w-3.5" aria-hidden="true" /><span>{label}</span>{!open && count > 0 ? <span className="chat-list-section-count">{count}</span> : null}</button>
    {open ? <div className="chat-list-section-body">{children}</div> : null}
  </section>;
}
