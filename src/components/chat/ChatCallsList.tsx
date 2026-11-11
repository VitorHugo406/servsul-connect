import { useCallback, useEffect, useMemo, useState } from 'react';
import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { effectiveStatus, formatCallDuration, onCallsChange, type CallInfo } from '@/components/video/callStore';
import { ChatSenderAvatar } from '@/components/chat/ChatSenderIdentity';
import { cn } from '@/lib/utils';

type Conv = CallInfo['conv'];
export interface CallPerson { id: string; name: string; avatar_url?: string | null }
export interface CallNamed { id: string; name: string; color?: string | null }

const COLS = 'id, caller_id, conv, target, audio, status, created_at, answered_at, ended_at, duration_sec';
const LIMIT = 60;

/** "14:32" today, "Ontem 18:05", otherwise "08/11 09:10". */
export function formatCallWhen(iso: string, now = new Date()) {
  const d = new Date(iso);
  const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff === 0) return { day: 'Hoje', time: hm };
  if (diff === 1) return { day: 'Ontem', time: hm };
  return { day: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), time: hm };
}

interface Props {
  meId: string;
  companyId?: string | null;
  people: CallPerson[];
  sectors: CallNamed[];       // sectors the user can reach
  groups: CallNamed[];        // groups the user belongs to
  canCall: boolean;
  onOpen: (conv: Conv, target: string) => void;
  onCall: (conv: Conv, target: string, audio: boolean) => void;
}

export function ChatCallsList({ meId, companyId, people, sectors, groups, canCall, onOpen, onCall }: Props) {
  const [rows, setRows] = useState<CallInfo[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      let q = (supabase as any).from('chat_calls').select(COLS);
      if (companyId) q = q.eq('company_id', companyId);
      const { data, error } = await q.order('created_at', { ascending: false }).limit(300);
      if (error) throw error;
      setRows((data || []) as CallInfo[]); setFailed(false);
    } catch { setRows((r) => r ?? []); setFailed(true); }
  }, [companyId]);

  useEffect(() => {
    void load();
    let t: number | null = null;
    const off = onCallsChange(() => { if (t != null) window.clearTimeout(t); t = window.setTimeout(() => void load(), 400); });
    return () => { off(); if (t != null) window.clearTimeout(t); };
  }, [load]);

  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const sectorById = useMemo(() => new Map(sectors.map((s) => [s.id, s])), [sectors]);
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  const mine = useMemo(() => (rows || []).filter((c) =>
    c.caller_id === meId
    || (c.conv === 'dm' && c.target === meId)
    || (c.conv === 'group' && groupById.has(c.target))
    || (c.conv === 'sector' && sectorById.has(c.target))
  ).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, LIMIT), [rows, meId, groupById, sectorById]);

  if (rows === null) return <div className="chat-calls-state" role="status"><span className="chat-calls-spinner" aria-hidden="true" />Carregando chamadas…</div>;
  if (mine.length === 0) return <div className="chat-calls-state" role="status"><Phone className="h-7 w-7" aria-hidden="true" /><strong>Nenhuma chamada ainda</strong><span>{failed ? 'Não foi possível carregar o histórico agora.' : 'As chamadas de voz e vídeo das suas conversas aparecem aqui.'}</span></div>;

  return <ul className="chat-calls-list" aria-label="Histórico de chamadas">
    {mine.map((c) => {
      const outgoing = c.caller_id === meId;
      const status = effectiveStatus(c);
      // dm: the other person is the target when I called, the caller when they called me
      const otherId = c.conv === 'dm' ? (outgoing ? c.target : c.caller_id) : c.target;
      const person = c.conv === 'dm' ? personById.get(otherId) : undefined;
      const sector = c.conv === 'sector' ? sectorById.get(c.target) : undefined;
      const group = c.conv === 'group' ? groupById.get(c.target) : undefined;
      const name = person?.name || sector?.name || group?.name || 'Conversa';
      const when = formatCallWhen(c.created_at);
      const answered = !!c.answered_at || (c.duration_sec ?? 0) > 0;
      const bad = status === 'missed' || (status === 'declined' && !outgoing);
      let label: string; let tone = '';
      if (status === 'ongoing') { label = 'Em andamento'; tone = 'is-live'; }
      else if (status === 'ringing') { label = 'Chamando…'; tone = 'is-live'; }
      else if (status === 'missed') { label = outgoing ? 'Sem resposta' : 'Perdida'; tone = 'is-bad'; }
      else if (status === 'declined') { label = 'Recusada'; tone = bad ? 'is-bad' : ''; }
      else { label = answered ? `Atendida${c.duration_sec != null ? ` · ${formatCallDuration(c.duration_sec)}` : ''}` : 'Encerrada'; }
      const DirIcon = status === 'missed' && !outgoing ? PhoneMissed : outgoing ? PhoneOutgoing : PhoneIncoming;
      const callbackTarget = c.conv === 'dm' ? otherId : c.target;
      const kind = c.audio ? 'voz' : 'vídeo';
      return <li key={c.id} className="chat-call-item">
        <button type="button" className={cn('chat-conversation-row chat-call-row', bad && 'is-missed')} onClick={() => onOpen(c.conv, callbackTarget)} aria-label={`${name}, chamada de ${kind} ${outgoing ? 'feita' : 'recebida'}, ${label}, ${when.day} ${when.time}. Abrir conversa`}>
          <span className="chat-call-avatar">
            {c.conv === 'dm'
              ? <ChatSenderAvatar name={name} avatarUrl={person?.avatar_url} id={otherId} />
              : c.conv === 'group'
                ? <span className="chat-call-badge-block is-3d"><img src="/ewwon/img/chat3d/group.png" alt="" loading="eager" draggable={false} /></span>
                : <span className="chat-call-badge-block is-3d"><img src="/ewwon/img/chat3d/sector.png" alt="" loading="eager" draggable={false} /></span>}
            {c.audio
              ? <span className="chat-call-kind is-3d" title={`Chamada de ${kind}`}><img src="/ewwon/img/chat3d/calls.png" alt="" loading="eager" draggable={false} /></span>
              : <span className="chat-call-kind" title={`Chamada de ${kind}`}><Video className="h-2.5 w-2.5" /></span>}
          </span>
          <span className="min-w-0 flex-1">
            <span className="chat-conv-name block truncate">{c.conv === 'sector' ? <span className="chat-conv-hash" aria-hidden="true">#</span> : null}{name}</span>
            <span className={cn('chat-call-sub', tone)}><DirIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{outgoing ? 'Feita' : 'Recebida'} · {label}</span></span>
          </span>
          <span className="chat-call-when"><span>{when.day}</span><span>{when.time}</span></span>
        </button>
        {canCall ? <span className="chat-call-actions">
          <button type="button" title="Ligar de volta (voz)" aria-label={`Ligar de volta para ${name} por voz`} onClick={() => onCall(c.conv, callbackTarget, true)}><Phone className="h-4 w-4" /></button>
          <button type="button" title="Ligar de volta (vídeo)" aria-label={`Ligar de volta para ${name} por vídeo`} onClick={() => onCall(c.conv, callbackTarget, false)}><Video className="h-4 w-4" /></button>
        </span> : null}
      </li>;
    })}
  </ul>;
}
