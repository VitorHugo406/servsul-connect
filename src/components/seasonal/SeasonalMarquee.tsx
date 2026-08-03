import { useState } from 'react';
import { getCurrentSeasonalTheme } from './SeasonalEffectsButton';

export function SeasonalMarquee() {
  const theme = getCurrentSeasonalTheme();
  const [hovered, setHovered] = useState(false);
  const [locked, setLocked] = useState(false);

  if (!theme) return null;

  const paused = hovered || locked;
  const text = `${theme.label} — ${theme.message}`;
  // Repeat for seamless scroll
  const items = Array.from({ length: 4 }, (_, i) => i);

  return (
    <div
      className="relative w-full overflow-hidden border-b border-border bg-gradient-to-r from-amber-500/5 via-primary/5 to-amber-500/5 cursor-pointer select-none"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setLocked((v) => !v)}
      title={locked ? 'Clique para retomar' : 'Clique para pausar'}
    >
      <div className="flex items-center gap-2 py-1.5 px-3">
        <Sparkles className="h-4 w-4 text-amber-500 flex-shrink-0" />
        <div className="flex-1 overflow-hidden">
          <div
            className="flex whitespace-nowrap animate-marquee"
            style={{ animationPlayState: paused ? 'paused' : 'running' }}
          >
            {items.map((i) => (
              <span key={i} className="text-xs sm:text-sm font-medium text-foreground/80 px-8">
                <strong className="text-foreground">{theme.label}</strong> — {theme.message}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
