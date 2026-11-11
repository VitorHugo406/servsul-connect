import { Button } from '@/components/ui/button';

interface ChatEmojiGridProps {
  emojis: readonly string[];
  onSelect: (emoji: string, origin?: HTMLElement) => void;
  label: string;
}

export function ChatEmojiGrid({ emojis, onSelect, label }: ChatEmojiGridProps) {
  return <div className="chat-emoji-scroll" role="group" aria-label={label} tabIndex={0}>
    <div className="grid grid-cols-5 gap-1">
      {emojis.map(emoji => <Button key={emoji} type="button" variant="ghost" size="icon" title={emoji} aria-label={emoji} className="h-8 w-8 rounded-md text-xl leading-none" onClick={(e) => onSelect(emoji, e.currentTarget)}>{emoji}</Button>)}
    </div>
  </div>;
}