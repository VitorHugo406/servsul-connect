import React from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { downloadAppFile, isAppFileRef } from '@/lib/appFiles';

/**
 * Format inline text: *bold*, _italic_, ~strikethrough~, [link](url), @mentions, and auto-detect URLs
 */
export function formatText(text: string, isOwnMsg: boolean): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match formatting, markdown links, @mentions (only the @Name part), and bare URLs
  const regex = /(\*[^*]+\*|_[^_]+_|~[^~]+~|\[[^\]]+\]\([^)]+\)|@[\wÀ-ÿ][\wÀ-ÿ\s]*?(?=\s@|\s[^À-ÿ\w]|$)|https?:\/\/[^\s<]+)/g;
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
      parts.push(<s key={key++}>{m.slice(1, -1)}</s>);
    } else if (m.startsWith('[')) {
      const linkMatch = m.match(/^\[(.+?)\]\((.+?)\)$/);
      if (linkMatch) {
        const href = linkMatch[2].trim();
        if (isAppFileRef(href)) {
          // In-app download (e.g. monthly feedback PDF): no public storage link in the message.
          parts.push(
            <button key={key++} type="button" onClick={() => void downloadAppFile(href).catch((e) => toast.error(e.message))}
              className={cn("inline-flex items-center gap-1 underline font-medium", "text-primary hover:text-primary/80")}
            >⬇ {linkMatch[1]}</button>
          );
        } else if (/^(https?:\/\/|mailto:)/i.test(href)) {
          parts.push(
            <a key={key++} href={href} target="_blank" rel="noopener noreferrer"
              className={cn("underline font-medium", "text-primary hover:text-primary/80")}
            >{linkMatch[1]}</a>
          );
        } else {
          // SECURITY: never render javascript:/data: or other schemes as links.
          parts.push(linkMatch[1]);
        }
      }
    } else if (m.startsWith('@')) {
      parts.push(
        <span key={key++} className={cn("font-semibold", "text-primary")}>
          {m.trim()}
        </span>
      );
    } else if (m.startsWith('http')) {
      parts.push(
        <a key={key++} href={m} target="_blank" rel="noopener noreferrer"
          className={cn("underline font-medium break-all", "text-primary hover:text-primary/80")}
        >{m}</a>
      );
    }
    lastIndex = match.index + m.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}
