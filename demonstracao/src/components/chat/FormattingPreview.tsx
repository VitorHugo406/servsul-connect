import React from 'react';
import { cn } from '@/lib/utils';

interface FormattingPreviewProps {
  text: string;
  className?: string;
}

function formatPreviewText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*[^*]+\*|_[^_]+_|~[^~]+~|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const m = match[0];
    if (m.startsWith('*') && m.endsWith('*')) {
      parts.push(<strong key={key++}>{m.slice(1, -1)}</strong>);
    } else if (m.startsWith('_') && m.endsWith('_')) {
      parts.push(<em key={key++}>{m.slice(1, -1)}</em>);
    } else if (m.startsWith('~') && m.endsWith('~')) {
      parts.push(<s key={key++} className="text-muted-foreground">{m.slice(1, -1)}</s>);
    } else if (m.startsWith('[')) {
      const linkMatch = m.match(/^\[(.+?)\]\((.+?)\)$/);
      if (linkMatch) {
        parts.push(
          <span key={key++} className="text-primary underline">{linkMatch[1]}</span>
        );
      }
    }
    lastIndex = match.index + m.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

function hasFormatting(text: string): boolean {
  return /(\*[^*]+\*|_[^_]+_|~[^~]+~|\[[^\]]+\]\([^)]+\))/.test(text);
}

export function FormattingPreview({ text, className }: FormattingPreviewProps) {
  if (!text.trim() || !hasFormatting(text)) return null;

  return (
    <div className={cn(
      "mb-2 rounded-lg border border-border bg-muted/30 px-4 py-2 text-sm",
      className
    )}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-medium">Pré-visualização</p>
      <div className="text-foreground leading-relaxed whitespace-pre-wrap break-words">
        {text.split('\n').map((line, i) => (
          <React.Fragment key={i}>
            {i > 0 && <br />}
            {formatPreviewText(line)}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
