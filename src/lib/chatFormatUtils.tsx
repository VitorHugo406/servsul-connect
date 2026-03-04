import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Format inline text: *bold*, _italic_, ~strikethrough~, [link](url), @mentions, and auto-detect URLs
 */
export function formatText(text: string, isOwnMsg: boolean): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match formatting, markdown links, @mentions, and bare URLs
  const regex = /(\*[^*]+\*|_[^_]+_|~[^~]+~|\[[^\]]+\]\([^)]+\)|@\w[\w\s]*(?=\s|$)|https?:\/\/[^\s<]+)/g;
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
        parts.push(
          <a key={key++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
            className={cn("underline font-medium", isOwnMsg ? "text-blue-200 hover:text-white" : "text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300")}
          >{linkMatch[1]}</a>
        );
      }
    } else if (m.startsWith('@')) {
      parts.push(
        <span key={key++} className={cn("font-semibold", isOwnMsg ? "text-blue-200" : "text-blue-600 dark:text-blue-400")}>
          {m}
        </span>
      );
    } else if (m.startsWith('http')) {
      // Bare URL - make it a clickable link
      parts.push(
        <a key={key++} href={m} target="_blank" rel="noopener noreferrer"
          className={cn("underline font-medium break-all", isOwnMsg ? "text-blue-200 hover:text-white" : "text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300")}
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
