import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bold, Italic, Underline, List, ListOrdered, Link as LinkIcon, Palette, AtSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { NoteMentionPicker, MentionFormat, MentionResult, buildMentionHtml } from './NoteMentionPicker';
import { UserPreviewDialog } from '@/components/user/UserPreviewDialog';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
}

const TEXT_COLORS = ['#000000', '#DC2626', '#EA580C', '#CA8A04', '#16A34A', '#2563EB', '#7C3AED', '#DB2777'];

export function RichTextEditor({ value, onChange, readOnly, className, placeholder }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef<string>(value || '');
  const savedRange = useRef<Range | null>(null);
  const triggerRange = useRef<Range | null>(null);

  const [mention, setMention] = useState<{ trigger: '#' | '@' | '!'; query: string; pos: { top: number; left: number } } | null>(null);
  const [mentionFormat, setMentionFormat] = useState<MentionFormat>('card');

  useEffect(() => {
    if (!ref.current) return;
    const incoming = value || '';
    if (incoming === lastEmitted.current) return;
    if (document.activeElement === ref.current) return;
    if (ref.current.innerHTML !== incoming) {
      ref.current.innerHTML = incoming;
      lastEmitted.current = incoming;
    }
  }, [value]);

  const exec = (cmd: string, arg?: string) => {
    if (readOnly) return;
    document.execCommand(cmd, false, arg);
    handleInput();
    ref.current?.focus();
  };

  const handleInput = () => {
    if (ref.current) {
      const html = ref.current.innerHTML;
      lastEmitted.current = html;
      onChange(html);
    }
    detectMention();
  };

  const detectMention = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !ref.current) { setMention(null); return; }
    const range = sel.getRangeAt(0);
    if (!ref.current.contains(range.startContainer)) { setMention(null); return; }
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) { setMention(null); return; }
    const text = node.textContent || '';
    const offset = range.startOffset;
    const before = text.slice(0, offset);
    const m = before.match(/(^|\s)([#@!])([\wÀ-ÿ\d]*)$/);
    if (!m) { setMention(null); return; }
    const trigger = m[2] as '#' | '@' | '!';
    const query = m[3];
    // store range that covers the trigger so we can replace it
    const tRange = document.createRange();
    tRange.setStart(node, offset - (1 + query.length));
    tRange.setEnd(node, offset);
    triggerRange.current = tRange;
    const rect = range.getClientRects()[0] || ref.current.getBoundingClientRect();
    setMention({
      trigger,
      query,
      pos: { top: rect.bottom + 4, left: rect.left },
    });
  };

  const insertMention = (m: MentionResult) => {
    if (!ref.current || !triggerRange.current) return;
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(triggerRange.current);
    triggerRange.current.deleteContents();
    document.execCommand('insertHTML', false, buildMentionHtml(m, mentionFormat));
    setMention(null);
    handleInput();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (mention && (e.key === 'Escape')) {
      e.preventDefault();
      setMention(null);
    }
  };

  const insertLink = () => {
    const url = prompt('Cole o link (ex: https://...)');
    if (url) exec('createLink', url);
  };

  const triggerMention = (t: '#' | '@' | '!') => {
    if (readOnly) return;
    ref.current?.focus();
    document.execCommand('insertText', false, t);
    setTimeout(detectMention, 0);
  };

  return (
    <div className={cn('flex flex-col gap-2 relative', className)}>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-background/80 p-1 backdrop-blur">
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec('bold')}>
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec('italic')}>
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec('underline')}>
            <Underline className="h-3.5 w-3.5" />
          </Button>
          <div className="mx-1 h-4 w-px bg-border" />
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec('insertUnorderedList')}>
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec('insertOrderedList')}>
            <ListOrdered className="h-3.5 w-3.5" />
          </Button>
          <div className="mx-1 h-4 w-px bg-border" />
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={insertLink}>
            <LinkIcon className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7">
                <Palette className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <div className="grid grid-cols-4 gap-1 p-2">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="h-6 w-6 rounded border border-border"
                    style={{ background: c }}
                    onClick={() => exec('foreColor', c)}
                  />
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="mx-1 h-4 w-px bg-border" />
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs" onClick={() => triggerMention('#')} title="Mencionar card de tarefa">
            # Card
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs" onClick={() => triggerMention('!')} title="Mencionar reunião">
            ! Reunião
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs" onClick={() => triggerMention('@')} title="Mencionar pessoa">
            <AtSign className="h-3 w-3" /> Pessoa
          </Button>
        </div>
      )}
      <div
        ref={ref}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleInput}
        onKeyDown={onKeyDown}
        onKeyUp={detectMention}
        onMouseUp={detectMention}
        className={cn(
          'min-h-[120px] flex-1 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-primary/30',
          '[&_a]:text-primary [&_a]:underline',
          '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
          readOnly && 'cursor-default',
        )}
        data-placeholder={placeholder}
      />
      {mention && !readOnly && (
        <NoteMentionPicker
          trigger={mention.trigger}
          query={mention.query}
          format={mentionFormat}
          onFormatChange={setMentionFormat}
          onSelect={insertMention}
          onClose={() => setMention(null)}
          position={mention.pos}
        />
      )}
      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
