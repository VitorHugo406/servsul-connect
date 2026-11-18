// Own-bubble colour per conversation, shared with the mobile app (chat_member_prefs.bubble_color, same chat keys:
// dm:<profile id>, sector:<id>, group:<id>). 0 = system default (soft tint of the company colour on the PC).
import { useEffect, useState, type CSSProperties } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const BUBBLE_COLORS = ['', '#4f8cff', '#2fbf71', '#8b5cf6'];
export const BUBBLE_LABELS = ['Padrão (cor da empresa)', 'Azul', 'Verde', 'Roxo'];
const EVT = 'ewvon:bubble-color';

/** PC dialog ids ("sector-<id>", "group-<id>", partner profile id) to the mobile chat key. */
export const chatKeyOf = (chatId: string | null | undefined) => {
  if (!chatId) return null;
  if (chatId.startsWith('sector-')) return `sector:${chatId.slice(7)}`;
  if (chatId.startsWith('group-')) return `group:${chatId.slice(6)}`;
  return `dm:${chatId}`;
};

export async function saveBubbleColor(profileId: string, companyId: string, chatKey: string, color: number) {
  const { error } = await supabase.from('chat_member_prefs' as any).upsert(
    { profile_id: profileId, company_id: companyId, chat_key: chatKey, bubble_color: color, updated_at: new Date().toISOString() } as any,
    { onConflict: 'profile_id,chat_key' },
  );
  if (!error) window.dispatchEvent(new CustomEvent(EVT, { detail: { chatKey, color } }));
  return { error };
}

export function useChatBubbleColor(chatKey: string | null) {
  const { profile } = useAuth();
  const [color, setColor] = useState(0);
  useEffect(() => {
    let live = true; setColor(0);
    if (!chatKey || !profile?.id) return;
    void (supabase.from('chat_member_prefs' as any).select('bubble_color').eq('profile_id', profile.id).eq('chat_key', chatKey).maybeSingle() as any)
      .then(({ data }: any) => { if (live) setColor(Number(data?.bubble_color) || 0); });
    const on = (e: Event) => { const d = (e as CustomEvent).detail; if (d?.chatKey === chatKey) setColor(d.color || 0); };
    window.addEventListener(EVT, on);
    return () => { live = false; window.removeEventListener(EVT, on); };
  }, [chatKey, profile?.id]);
  return color;
}

/** Props for the thread root: a solid colour with white text when the person picked one. */
export const bubbleStyle = (color: number): { 'data-bubble'?: string; style?: CSSProperties } =>
  color > 0 && BUBBLE_COLORS[color] ? { 'data-bubble': String(color), style: { ['--chat-own-solid' as any]: BUBBLE_COLORS[color] } } : {};
