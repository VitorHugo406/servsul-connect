import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Users as UsersIcon, ListTodo, Link as LinkIcon, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MentionType = 'task' | 'meeting' | 'user';
export type MentionFormat = 'card' | 'link';

export interface MentionResult {
  type: MentionType;
  id: string;
  label: string;
  meta?: Record<string, any>;
}

interface NoteMentionPickerProps {
  trigger: '#' | '@' | '!';
  query: string;
  format: MentionFormat;
  onFormatChange: (f: MentionFormat) => void;
  onSelect: (m: MentionResult) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-500', medium: 'bg-blue-500', high: 'bg-orange-500', urgent: 'bg-red-500',
};

export function NoteMentionPicker({ trigger, query, format, onFormatChange, onSelect, onClose, position }: NoteMentionPickerProps) {
  const initialType: MentionType = trigger === '#' ? 'task' : trigger === '!' ? 'meeting' : 'user';
  const [type, setType] = useState<MentionType>(initialType);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setType(initialType); }, [initialType]);

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      setLoading(true);
      try {
        if (type === 'task') {
          const { data } = await supabase
            .from('tasks')
            .select('id, task_number, title, priority, due_date, board_id')
            .eq('is_archived', false)
            .order('task_number', { ascending: false })
            .limit(80);
          const filtered = (data || []).filter(t =>
            !query || t.task_number.toString().includes(query) || t.title.toLowerCase().includes(query.toLowerCase())
          ).slice(0, 30);
          if (!cancel) setItems(filtered);
        } else if (type === 'meeting') {
          const { data } = await supabase
            .from('calendar_events')
            .select('id, title, start_date, event_type')
            .order('start_date', { ascending: false })
            .limit(80);
          const filtered = (data || []).filter(e =>
            !query || e.title.toLowerCase().includes(query.toLowerCase())
          ).slice(0, 30);
          if (!cancel) setItems(filtered);
        } else {
          const { data } = await supabase
            .from('profiles')
            .select('id, user_id, name, display_name, avatar_url, is_active')
            .eq('is_active', true)
            .order('name')
            .limit(200);
          const filtered = (data || []).filter(p => {
            const name = (p.display_name || p.name || '').toLowerCase();
            return !query || name.includes(query.toLowerCase());
          }).slice(0, 30);
          if (!cancel) setItems(filtered);
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    };
    load();
    return () => { cancel = true; };
  }, [type, query]);

  const handlePick = (raw: any) => {
    if (type === 'task') {
      onSelect({
        type: 'task',
        id: raw.id,
        label: `#${raw.task_number} ${raw.title}`,
        meta: { task_number: raw.task_number, title: raw.title, priority: raw.priority, due_date: raw.due_date },
      });
    } else if (type === 'meeting') {
      onSelect({
        type: 'meeting',
        id: raw.id,
        label: raw.title,
        meta: { start_date: raw.start_date, event_type: raw.event_type },
      });
    } else {
      onSelect({
        type: 'user',
        id: raw.user_id,
        label: raw.display_name || raw.name,
        meta: { avatar_url: raw.avatar_url },
      });
    }
  };

  return (
    <div
      className="fixed z-[100] w-80 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center justify-between gap-2 p-2 border-b border-border bg-muted/40">
        <Tabs value={type} onValueChange={(v) => setType(v as MentionType)} className="flex-1">
          <TabsList className="h-8 grid w-full grid-cols-3">
            <TabsTrigger value="task" className="text-xs gap-1"><ListTodo className="h-3 w-3" />Card</TabsTrigger>
            <TabsTrigger value="meeting" className="text-xs gap-1"><Calendar className="h-3 w-3" />Reunião</TabsTrigger>
            <TabsTrigger value="user" className="text-xs gap-1"><UsersIcon className="h-3 w-3" />Pessoa</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background">
        <span className="text-[10px] text-muted-foreground mr-1">Estilo:</span>
        <button
          className={cn('flex items-center gap-1 rounded px-2 py-0.5 text-[10px]', format === 'card' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
          onClick={() => onFormatChange('card')}
        >
          <LayoutGrid className="h-3 w-3" /> Card
        </button>
        <button
          className={cn('flex items-center gap-1 rounded px-2 py-0.5 text-[10px]', format === 'link' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
          onClick={() => onFormatChange('link')}
        >
          <LinkIcon className="h-3 w-3" /> Link
        </button>
      </div>

      <ScrollArea className="max-h-[260px]">
        <div className="p-1">
          {loading && <p className="text-xs text-muted-foreground text-center py-3">Buscando...</p>}
          {!loading && items.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nada encontrado</p>}
          {!loading && items.map((it) => {
            if (type === 'task') {
              return (
                <button key={it.id} onClick={() => handlePick(it)} className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted">
                  <Badge variant="outline" className="text-[9px] flex-shrink-0">#{it.task_number}</Badge>
                  <span className="text-xs truncate flex-1">{it.title}</span>
                  <span className={cn('h-2 w-2 rounded-full', PRIORITY_COLORS[it.priority] || 'bg-gray-400')} />
                </button>
              );
            }
            if (type === 'meeting') {
              return (
                <button key={it.id} onClick={() => handlePick(it)} className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted">
                  <Calendar className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  <span className="text-xs truncate flex-1">{it.title}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {new Date(it.start_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </span>
                </button>
              );
            }
            return (
              <button key={it.id} onClick={() => handlePick(it)} className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={it.avatar_url || ''} />
                  <AvatarFallback className="text-[9px]">{(it.display_name || it.name || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="text-xs truncate flex-1">{it.display_name || it.name}</span>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

export function buildMentionHtml(m: MentionResult, format: MentionFormat): string {
  const safeLabel = (m.label || '').replace(/"/g, '&quot;');
  let href = '#';
  let icon = '';
  let bgColor = '';
  if (m.type === 'task') {
    href = `?section=tasks&task=${m.id}`;
    icon = '📋';
    bgColor = 'background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#fff;';
  } else if (m.type === 'meeting') {
    href = `?section=calendar&event=${m.id}`;
    icon = '📅';
    bgColor = 'background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;';
  } else {
    href = `?section=chat&dm=${m.id}`;
    icon = '👤';
    bgColor = 'background:linear-gradient(135deg,#10b981,#047857);color:#fff;';
  }

  if (format === 'link') {
    return `<a href="${href}" data-mention="${m.type}" data-mention-id="${m.id}" style="color:#2563eb;text-decoration:underline;font-weight:500;">${icon} ${safeLabel}</a>&nbsp;`;
  }
  // card / chip
  return `<a href="${href}" data-mention="${m.type}" data-mention-id="${m.id}" contenteditable="false" style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;margin:0 2px;border-radius:9999px;font-size:12px;font-weight:600;text-decoration:none;${bgColor}box-shadow:0 1px 2px rgba(0,0,0,.15);">${icon} ${safeLabel}</a>&nbsp;`;
}
