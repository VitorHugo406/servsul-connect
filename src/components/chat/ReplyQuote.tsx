// Quote of the message being answered (replies made by swiping in the mobile app).
import { chatPreview } from '@/lib/stickers';

interface QuotedMsg { id: string; content: string; sender_id: string }
export function ReplyQuote({ replyId, messages, nameOf, isOwn }: { replyId?: string | null; messages: QuotedMsg[]; nameOf: (senderId: string) => string; isOwn: boolean }) {
  if (!replyId) return null;
  const q = messages.find((m) => m.id === replyId);
  const go = () => {
    const el = document.querySelector<HTMLElement>(`[data-msg-id="${replyId}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.animate([{ boxShadow: '0 0 0 3px #ffc36b' }, { boxShadow: '0 0 0 0 transparent' }], { duration: 1500 });
  };
  return (
    <button type="button" onClick={go}
      className={`mb-1.5 block w-full min-w-[140px] max-w-full rounded-xl border-l-[3px] px-2.5 py-1.5 text-left text-xs ${isOwn ? 'border-emerald-500 bg-black/10' : 'border-primary bg-muted/70'}`}>
      <span className={`block font-semibold ${isOwn ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary'}`}>{q ? nameOf(q.sender_id) : 'Mensagem'}</span>
      <span className="line-clamp-2 opacity-80">{q ? chatPreview(q.content, 120) : 'Mensagem original não carregada'}</span>
    </button>
  );
}
