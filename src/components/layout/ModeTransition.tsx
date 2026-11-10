// Full-screen transition between the ewvon system and Dash: the logo is drawn, then the name is written
// under it (DASH when entering Dash, the ewvon wordmark when coming back). The real screen changes while it covers the page.
import { useEffect, useRef, useState } from 'react';
import { EwwonLogo, EwvonWordmark } from '@/components/common/EwwonLoader';
import { MODE_EVENT, type AppMode, type ModeSwitchDetail } from '@/lib/modeSwitch';
import './mode-transition.css';

export function ModeTransitionHost() {
  const [mode, setMode] = useState<AppMode | null>(null);
  const [leaving, setLeaving] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<ModeSwitchDetail>).detail;
      if (!d || busy.current) return;
      busy.current = true; setLeaving(false); setMode(d.to);
      window.setTimeout(() => { try { d.go(); } catch { /* ignore */ } }, 1500);
      window.setTimeout(() => setLeaving(true), 2500);
      window.setTimeout(() => { setMode(null); busy.current = false; }, 3050);
    };
    window.addEventListener(MODE_EVENT, on);
    return () => window.removeEventListener(MODE_EVENT, on);
  }, []);
  if (!mode) return null;
  return (
    <div className={'emt' + (leaving ? ' is-leaving' : '') + (mode === 'dash' ? ' to-dash' : '')} role="status" aria-label={mode === 'dash' ? 'Abrindo o Dash' : 'Voltando ao sistema'}>
      <div className="emt-grid" />
      <div className="emt-stage">
        <EwwonLogo size={118} />
        <span className="emt-glow" />
      </div>
      {mode === 'dash' ? (
        <svg className="emt-dash" viewBox="0 0 300 64" width="190" height="41" aria-label="DASH">
          <text x="150" y="50" textAnchor="middle" fontFamily="'Plus Jakarta Sans', Inter, system-ui, sans-serif" fontWeight="800" fontSize="54" letterSpacing="9">DASH</text>
        </svg>
      ) : <EwvonWordmark height={30} />}
      <i className="emt-line" />
    </div>
  );
}
