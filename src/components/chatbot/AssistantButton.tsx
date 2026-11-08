// Header button of the ewvon assistant: the animated cosmic blob. A click plays a short
// "pop" and opens the assistant side panel (ChatbotWidget listens to ewvon:open-assistant).
import { useState } from 'react';
import { CosmicBlob } from '@/components/common/CosmicBlob';

export function AssistantButton() {
  const [pop, setPop] = useState(0);
  return (
    <button type="button" title="Assistente ewvon" aria-label="Abrir assistente"
      className="flex h-10 w-10 items-center justify-center rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => { setPop((n) => n + 1); window.setTimeout(() => window.dispatchEvent(new CustomEvent('ewvon:open-assistant')), 180); }}>
      <CosmicBlob key={pop} size={32} className={pop ? 'pop' : undefined} />
    </button>
  );
}
