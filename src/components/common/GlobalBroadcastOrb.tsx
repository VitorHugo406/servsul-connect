// Floating "Comunicados globais" orb (bottom-right of the home screen, PC and mobile).
// Only rendered while at least one global broadcast is live; tapping opens a small panel with them.
import { useEffect, useRef, useState } from 'react';
import { CosmicBlob } from './CosmicBlob';
import { isBroadcastLive, useSystemBroadcasts } from '@/hooks/useSystemBroadcasts';
import './globalBroadcastOrb.css';

const SEV: Record<string, string> = { info: 'Informativo', warning: 'Atenção', critical: 'Crítico' };

export function GlobalBroadcastOrb({ variant = 'pc' }: { variant?: 'pc' | 'mobile' }) {
  const { broadcasts } = useSystemBroadcasts(true, 60_000);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const live = broadcasts.filter((b) => isBroadcastLive(b));

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  useEffect(() => { if (!live.length) setOpen(false); }, [live.length]);
  if (!live.length) return null;

  return (
    <div ref={ref} className={'gbo gbo-' + variant + (open ? ' open' : '')}>
      {open ? (
        <div className="gbo-panel" role="dialog" aria-label="Comunicados globais">
          <div className="gbo-head"><b>Comunicados globais</b><small>{live.length === 1 ? '1 ativo' : `${live.length} ativos`}</small></div>
          <div className="gbo-list">
            {live.map((b) => (
              <article key={b.id} className={'gbo-item sev-' + b.severity}>
                <span className="gbo-sev">{SEV[b.severity] || 'Informativo'}</span>
                <h4>{b.title}</h4>
                <p>{b.content}</p>
                <small>{new Date(b.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}{b.ends_at ? ` · até ${new Date(b.ends_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}</small>
              </article>
            ))}
          </div>
        </div>
      ) : null}
      <button type="button" className="gbo-btn" onClick={() => setOpen((o) => !o)} aria-label={`Comunicados globais (${live.length})`} aria-expanded={open}>
        <CosmicBlob size={variant === 'mobile' ? 50 : 56} talk={!open} />
        <span className="gbo-count">{live.length}</span>
      </button>
    </div>
  );
}
