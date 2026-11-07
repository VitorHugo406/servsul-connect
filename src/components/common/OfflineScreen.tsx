// Full-screen notice while the device has no internet: a hand-drawn (scribbled)
// Wi-Fi symbol and sad face. Everything is inline (no fonts/images from the network).
import { useEffect, useState } from 'react';
import './offline.css';

function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

// Hand-drawn strokes: slightly uneven curves, drawn twice with an offset like a pencil sketch.
const WIFI = [
  'M22 62 C 52 30, 118 26, 150 60',
  'M40 80 C 64 58, 106 55, 131 79',
  'M58 98 C 74 85, 96 84, 113 97',
];
const DOT = 'M84 118 c 1 -4 6 -4 6 0 c 0 4 -6 5 -6 0 z';
const SLASH = 'M36 30 L 140 128';
const FACE = [
  'M86 150 C 50 151, 40 196, 62 218 C 84 240, 132 238, 144 206 C 156 172, 128 147, 92 150',
  'M74 186 c 1 -4 5 -4 6 0',
  'M110 184 c 1 -4 5 -4 6 0',
  'M76 214 C 88 202, 104 202, 118 213',
  'M114 192 c 2 5 1 9 -1 11',
];

export function OfflineScreen() {
  const online = useOnline();
  const [checking, setChecking] = useState(false);
  if (online) return null;
  const retry = async () => {
    setChecking(true);
    try { await fetch(window.location.origin + '/manifest.json?ping=' + Date.now(), { cache: 'no-store' }); if (navigator.onLine) window.dispatchEvent(new Event('online')); } catch { /* still offline */ }
    window.setTimeout(() => setChecking(false), 900);
  };
  let k = 0;
  const strokes = (ds: string[], extra = '') => ds.flatMap((d) => [
    <path key={k++} d={d} className={'off-s ' + extra} pathLength={1} style={{ animationDelay: `${k * 0.12}s` }} />,
    <path key={k++} d={d} className={'off-s ghost ' + extra} pathLength={1} transform="translate(1.6 -1.2) rotate(.6 90 120)" style={{ animationDelay: `${k * 0.12}s` }} />,
  ]);
  return (
    <div className="off-screen" role="alertdialog" aria-live="assertive" aria-label="Sem conexão com a internet">
      <svg className="off-art" viewBox="0 0 180 250" width="190" aria-hidden="true">
        <defs>
          <filter id="off-rough"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" /><feDisplacementMap in="SourceGraphic" scale="3.2" /></filter>
        </defs>
        <g filter="url(#off-rough)">
          {strokes(WIFI)}
          {strokes([DOT])}
          {strokes([SLASH], 'red')}
          {strokes(FACE)}
        </g>
      </svg>
      <h2>Sem internet</h2>
      <p>Parece que você está desconectado.<br />Verifique o Wi-Fi ou os dados móveis — tudo volta sozinho quando a conexão retornar.</p>
      <button type="button" onClick={() => void retry()} disabled={checking}>{checking ? 'Verificando…' : 'Tentar de novo'}</button>
    </div>
  );
}

export default OfflineScreen;
