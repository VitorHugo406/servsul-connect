// Stroke icons used by the Ewwon prototype (same paths, rendered with the `.i` class).
import type { CSSProperties } from 'react';

const P: Record<string, string> = {
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  chat: 'M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-5.5A8 8 0 1 1 21 12z',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0',
  gift: 'M4 12h16v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM12 8v13M12 8C9 8 7.5 6.7 7.5 5.5S9 3 12 8zM12 8c3 0 4.5-1.3 4.5-2.5S15 3 12 8z',
  user: 'M4 21a8 8 0 0 1 16 0',
  sound: 'M11 5L6 9H2v6h4l5 4zM16 9a4 4 0 0 1 0 6',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z',
  play: 'M10 8l6 4-6 4z',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0',
  help: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  chevD: 'M6 9l6 6 6-6',
  chevL: 'M15 18l-6-6 6-6',
  chevR: 'M9 6l6 6-6 6',
  search: 'M21 21l-4.3-4.3',
  plus: 'M12 5v14M5 12h14',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  pin: 'M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3z',
  mega: 'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13',
  gear: 'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  camera: 'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z',
  check: 'M5 12l5 5 9-10',
  tasks: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h9',
  cal: 'M8 3v4M16 3v4M3 10h18',
  clock: 'M12 7v5l3 2',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  mute: 'M13.7 21a2 2 0 0 1-3.4 0M18 8a6 6 0 0 0-9.3-5M6.3 6.3A6 6 0 0 0 6 8c0 7-3 9-3 9h14M3 3l18 18',
  lock: 'M8 11V8a4 4 0 0 1 8 0v3',
  warn: 'M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  x: 'M6 6l12 12M18 6L6 18',
  bug: 'M8 8h8v6a4 4 0 0 1-8 0zM9 8V6a3 3 0 0 1 6 0v2M4 12h4M16 12h4M5 19l3-2M19 19l-3-2M5 6l3 2M19 6l-3 2',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z',
  info: 'M12 8v5M12 16h.01',
  ticket: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4zM14 5v2M14 11v2M14 17v2',
  users: 'M16 21v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M22 21v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
};

const EXTRA: Record<string, JSX.Element> = {
  user: <circle cx="12" cy="8" r="4" />,
  users: <circle cx="9" cy="7" r="4" />,
  gift: <rect x="3" y="8" width="18" height="4" rx="1" />,
  play: <circle cx="12" cy="12" r="9" />,
  help: <circle cx="12" cy="12" r="9" />,
  search: <circle cx="11" cy="11" r="7" />,
  camera: <circle cx="12" cy="13" r="3.5" />,
  gear: <circle cx="12" cy="12" r="3" />,
  cal: <rect x="3" y="5" width="18" height="16" rx="3" />,
  clock: <circle cx="12" cy="12" r="9" />,
  lock: <rect x="5" y="11" width="14" height="10" rx="2" />,
  info: <circle cx="12" cy="12" r="9" />,
};

export function I({ n, className, style }: { n: keyof typeof P | string; className?: string; style?: CSSProperties }) {
  return (
    <svg className={'i' + (className ? ' ' + className : '')} viewBox="0 0 24 24" style={style} aria-hidden="true">
      {EXTRA[n]}
      <path d={P[n] || ''} />
    </svg>
  );
}

export const Chev = () => <I n="chevR" style={{ marginLeft: 'auto', opacity: 0.5, flex: 'none' }} />;
