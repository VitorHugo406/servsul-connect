import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getCelebrationDate, isCelebrationToday } from '@/lib/birthdayUtils';

const GERAL_SECTOR_ID = '00000000-0000-0000-0000-000000000001';

interface Sector {
  id: string;
  name: string;
  color: string;
  icon: string | null;
}

interface Profile {
  id: string;
  user_id: string;
  name: string;
  display_name: string | null;
  email: string;
  avatar_url: string | null;
  sector_id: string | null;
  autonomy_level: string;
  birth_date: string | null;
  company_id?: string;
  sector_name?: string | null;
  sector_color?: string | null;
}

interface Message {
  id: string;
  content: string;
  author_id: string;
  sector_id: string;
  created_at: string;
  reply_to_id?: string | null;
  reply_to?: { id: string; content: string; reply_author?: { name: string; display_name: string | null } | null } | null;
  author?: Profile;
  status?: 'sending' | 'sent' | 'delivered';
}

export function useMessages(sectorId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const PAGE_SIZE = 100;
  const { profile, isAdmin } = useAuth();

  const hydrateMessages = useCallback(async (rows: any[]): Promise<Message[]> => {
    const baseMessages = rows as Message[];
    const replyIds = Array.from(new Set(baseMessages.map((m) => m.reply_to_id).filter((id): id is string => Boolean(id))));
    const replyMap = new Map<string, Message['reply_to']>();

    if (replyIds.length > 0) {
      const { data: replyRows, error: repliesError } = await supabase
        .from('messages')
        .select('id, content, author:profiles!messages_author_id_fkey(name, display_name)')
        .in('id', replyIds);
      if (repliesError) console.error('Error fetching reply messages:', repliesError);
      else for (const row of (replyRows as any[]) || []) {
        const rawAuthor = Array.isArray(row.author) ? row.author[0] : row.author;
        replyMap.set(row.id, { id: row.id, content: row.content, reply_author: rawAuthor ? { name: rawAuthor.name, display_name: rawAuthor.display_name } : null });
      }
    }

    // The message query already loads the complete sender profile. Preload the
    // department metadata once for the whole page so each message can render
    // its sender + department together, without per-message lookups.
    const sectorIds = Array.from(new Set(baseMessages.map((m) => m.author?.sector_id).filter((id): id is string => Boolean(id))));
    const sectorMap = new Map<string, Sector>();
    if (sectorIds.length > 0) {
      const { data: sectorRows, error: sectorsError } = await supabase
        .from('sectors')
        .select('id, name, color, icon')
        .in('id', sectorIds);
      if (sectorsError) console.error('Error fetching message author sectors:', sectorsError);
      else for (const sector of (sectorRows as Sector[]) || []) sectorMap.set(sector.id, sector);
    }

    return baseMessages.map((m) => {
      const author = m.author ? { ...m.author } : undefined;
      const authorSector = author?.sector_id ? sectorMap.get(author.sector_id) : undefined;
      if (author) {
        author.sector_name = authorSector?.name ?? null;
        author.sector_color = authorSector?.color ?? null;
      }
      return {
        ...m,
        author,
        reply_to: m.reply_to_id ? (replyMap.get(m.reply_to_id) ?? null) : null,
        status: 'delivered' as const,
      };
    });
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!sectorId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('id, content, author_id, sector_id, created_at, reply_to_id, author:profiles!messages_author_id_fkey(id, user_id, name, display_name, email, avatar_url, sector_id, autonomy_level, birth_date, company_id)')
      .eq('sector_id', sectorId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (error) console.error('Error fetching messages:', error);
    else {
      const hydratedMessages = await hydrateMessages(((data as any[]) || []).reverse());
      setHasMore((data || []).length === PAGE_SIZE);
      setMessages(prev => {
        const temps = prev.filter(m => m.id.startsWith('temp-'));
        const byId = new Map(hydratedMessages.map(m => [m.id, m]));
        temps.forEach(m => byId.set(m.id, m));
        return Array.from(byId.values()).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });
    }
    setLoading(false);
  }, [sectorId, hydrateMessages]);

  const loadOlderMessages = useCallback(async () => {
    if (!sectorId || loadingOlder || !hasMore) return;
    const oldest = messages.find(m => !m.id.startsWith('temp-'));
    if (!oldest) return;
    setLoadingOlder(true);
    const { data, error } = await supabase
      .from('messages')
      .select('id, content, author_id, sector_id, created_at, reply_to_id, author:profiles!messages_author_id_fkey(id, user_id, name, display_name, email, avatar_url, sector_id, autonomy_level, birth_date, company_id)')
      .eq('sector_id', sectorId)
      .or(`created_at.lt.${oldest.created_at},and(created_at.eq.${oldest.created_at},id.lt.${oldest.id})`)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (!error && data) {
      const older = await hydrateMessages((data as any[]).reverse());
      setHasMore(data.length === PAGE_SIZE);
      setMessages(prev => {
        const byId = new Map(prev.map(m => [m.id, m]));
        older.forEach(m => byId.set(m.id, m));
        return Array.from(byId.values()).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });
    }
    setLoadingOlder(false);
  }, [sectorId, messages, loadingOlder, hasMore, hydrateMessages]);

  useEffect(() => {
    fetchMessages();
    const channel = supabase.channel(`messages-${sectorId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `sector_id=eq.${sectorId}` }, (payload) => {
      if (payload.eventType === 'INSERT') {
        const newMessage = payload.new as Message;
        setMessages(prev => {
          const existingIndex = prev.findIndex(m => m.id === newMessage.id || (m.id.startsWith('temp-') && m.content === newMessage.content && m.author_id === newMessage.author_id));
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = { ...newMessage, author: prev[existingIndex].author, reply_to: prev[existingIndex].reply_to, status: 'delivered' };
            return updated;
          }
          const cachedAuthor = prev.find(m => m.author_id === newMessage.author_id)?.author;
          if (cachedAuthor) return [...prev, { ...newMessage, author: cachedAuthor, status: 'delivered' as const }];
          supabase.from('messages').select(`*, author:profiles!messages_author_id_fkey(*)`).eq('id', newMessage.id).single().then(async ({ data }) => {
            if (data) {
              const [normalized] = await hydrateMessages([data as any]);
              if (normalized) setMessages(p => p.map(m => m.id === newMessage.id ? normalized : m));
            }
          });
          return [...prev, { ...newMessage, status: 'delivered' as const }];
        });
      } else if (payload.eventType === 'DELETE') setMessages(prev => prev.filter(m => m.id !== (payload.old as Message).id));
      else if (payload.eventType === 'UPDATE') {
        const updated = payload.new as Message;
        setMessages(prev => prev.map(message => message.id === updated.id ? { ...message, ...updated, author: message.author, reply_to: message.reply_to, status: message.status === 'sending' ? message.status : 'delivered' } : message));
      }
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sectorId, fetchMessages]);

  const sendMessage = async (content: string, options?: { reply_to_id?: string }) => {
    if (!profile || !sectorId) return { error: new Error('Not authenticated') };
    const canSend = isAdmin || sectorId === profile.sector_id || sectorId === GERAL_SECTOR_ID;
    if (!canSend) return { error: new Error('You cannot send messages to this sector') };
    const parent = options?.reply_to_id ? messages.find(m => m.id === options.reply_to_id) : null;
    const reply_to = parent ? { id: parent.id, content: parent.content, reply_author: parent.author ? { name: parent.author.name, display_name: parent.author.display_name } : null } : null;
    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = { id: tempId, content, author_id: profile.id, sector_id: sectorId, created_at: new Date().toISOString(), author: profile as Profile, status: 'sending', reply_to_id: options?.reply_to_id || null, reply_to: reply_to as any };
    setMessages(prev => [...prev, tempMessage]);
    const insertPayload: any = { content, author_id: profile.id, sector_id: sectorId };
    if (options?.reply_to_id) insertPayload.reply_to_id = options.reply_to_id;
    const { error, data } = await supabase.from('messages').insert(insertPayload).select().single();
    if (error) setMessages(prev => prev.filter(m => m.id !== tempId));
    else if (data) setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' as const } : m));
    return { error, data };
  };

  const { allAccessibleSectorIds } = useAuth();
  const canSendMessages = isAdmin || allAccessibleSectorIds.includes(sectorId || '');
  return { messages, loading, loadingOlder, hasMore, loadOlderMessages, sendMessage, refetch: fetchMessages, canSendMessages };
}

export function useSectors() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchSectors = async () => {
      const { data, error } = await supabase.from('sectors').select('*').order('name');
      if (error) console.error('Error fetching sectors:', error);
      else setSectors(data || []);
      setLoading(false);
    };
    fetchSectors();
  }, []);
  return { sectors, loading };
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  useEffect(() => {
    const fetchProfiles = async () => {
      if (!profile?.company_id) { setProfiles([]); setLoading(false); return; }
      const { data, error } = await supabase.from('profiles').select('*').eq('company_id', profile.company_id).order('name');
      if (error) console.error('Error fetching profiles:', error);
      else setProfiles(data || []);
      setLoading(false);
    };
    fetchProfiles();
  }, [profile?.company_id]);
  return { profiles, loading };
}

export function useBirthdays() {
  const { profiles, loading } = useProfiles();
  const { sectors } = useSectors();
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();
  const birthdayPeople = profiles
    .filter((p) => p.birth_date && (p as { is_active?: boolean }).is_active !== false)
    .map((p) => {
      const [, month, day] = p.birth_date!.split('-').map(Number);
      const birthMonth = month;
      const birthDay = day;
      const celebrationDate = getCelebrationDate(p.birth_date!);
      const isToday = birthMonth === currentMonth && birthDay === currentDay;
      const isThisMonth = birthMonth === currentMonth;
      const sector = sectors.find((s) => s.id === p.sector_id);
      return { id: p.id, name: p.name, avatar: p.avatar_url || '', sector: sector?.name || 'Sem setor', birthDate: p.birth_date!, birthDay, birthMonth, isToday, isCelebrationToday: isCelebrationToday(p.birth_date!), celebrationDate, celebrationDay: celebrationDate.getDate(), isThisMonth };
    })
    .filter((p) => p.isThisMonth)
    .sort((a, b) => a.birthDay - b.birthDay);
  return { birthdayPeople, loading, currentDay };
}
