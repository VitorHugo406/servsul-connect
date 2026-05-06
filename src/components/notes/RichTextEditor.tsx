import { useRef, useEffect } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Link as LinkIcon, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

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

  useEffect(() => {
    if (!ref.current) return;
    const incoming = value || '';
    // Skip if it's our own emission echoing back
    if (incoming === lastEmitted.current) return;
    // Don't stomp the DOM while user is actively typing in this editor
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
  };

  const insertLink = () => {
    const url = prompt('Cole o link (ex: https://...)');
    if (url) exec('createLink', url);
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
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
        </div>
      )}
      <div
        ref={ref}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleInput}
        className={cn(
          'min-h-[120px] flex-1 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-primary/30',
          '[&_a]:text-primary [&_a]:underline',
          '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
          readOnly && 'cursor-default',
        )}
        data-placeholder={placeholder}
      />
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
