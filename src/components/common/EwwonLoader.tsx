// Ewwon loading animation: the logo outline is drawn stroke by stroke, then the
// shape fills in and gently breathes while the app loads. Replaces every old
// spinner/loading screen (mobile and desktop).
import './ewwon-loader.css';

// One clock for every loader on the page: when one loading screen replaces
// another (auth → app → data), the drawing continues instead of restarting.
let firstShownAt: number | null = null;
const elapsed = () => {
  const now = performance.now();
  if (firstShownAt === null || now - firstShownAt > 20000) firstShownAt = now;
  return (now - firstShownAt) / 1000;
};

// Traced from public/ewwon/img/icon-512.png (viewBox 263x202).
const LOGO_PATHS = ['M262 85 L253 76 L253 75 L251 74 L143 74 L142 75 L138 75 L137 76 L132 77 L119 84 L70 132 L69 132 L45 156 L44 156 L41 159 L41 161 L69 192 L80 198 L82 198 L86 200 L91 200 L92 201 L167 201 L168 200 L173 200 L174 199 L180 198 L190 193 L198 186 L199 186 L240 145 L230 150 L228 150 L221 153 L218 153 L217 154 L212 154 L211 155 L109 155 L108 153 L135 127 L142 123 L144 123 L148 121 L154 121 L155 120 L218 120 L219 119 L225 118 L234 113 L242 105 L243 105 L262 86Z', 'M235 57 L206 26 L206 25 L190 9 L187 8 L185 6 L183 6 L178 3 L176 3 L172 1 L168 1 L167 0 L121 0 L120 1 L116 1 L115 2 L109 3 L97 9 L93 12 L70 35 L69 35 L28 75 L27 75 L9 93 L8 93 L3 98 L1 102 L1 104 L0 105 L0 115 L3 122 L22 141 L23 141 L102 64 L103 64 L110 57 L116 53 L126 49 L130 49 L131 48 L208 48 L209 49 L214 49 L215 50 L223 51Z'];

export function EwwonLogo({ size = 96, animate = true, className, t = 0 }: { size?: number; animate?: boolean; className?: string; t?: number }) {
  return (
    <svg className={'ewl-logo' + (animate ? ' ewl-anim' : '') + (className ? ' ' + className : '')} viewBox="-6 -6 275 214" width={size} height={(size * 214) / 275} aria-hidden="true">
      {LOGO_PATHS.map((d, i) => <path key={i} d={d} pathLength={1} style={{ animationDelay: `${i * 0.18 - t}s, ${0.95 + i * 0.12 - t}s` }} />)}
    </svg>
  );
}

// "ewvon" wordmark: the real lettering (public/ewwon/img/wordmark.png, from the official logo) revealed left to
// right like a pen writing it. It is used as a mask so it follows the current text color.
export function EwvonWordmark({ height = 30, animate = true, t = 0, className }: { height?: number; animate?: boolean; t?: number; className?: string }) {
  return (
    <span className={'ewl-wordmark' + (animate ? ' ewl-anim' : '') + (className ? ' ' + className : '')} role="img" aria-label="ewvon"
      style={{ height, width: (height * 652) / 116, animationDelay: `${0.9 - t}s` }} />
  );
}

export function EwwonLoader({ message, inline = false }: { message?: string; inline?: boolean }) {
  const t = inline ? 0 : elapsed();
  return (
    <div className={'ewl-screen' + (inline ? ' inline' : '')} role="status" aria-live="polite" aria-label={message || 'Carregando'}>
      <div className="ewl-stage">
        <EwwonLogo size={inline ? 64 : 104} t={t} />
        <span className="ewl-glow" />
      </div>
      <EwvonWordmark t={t} />
      {message ? <p className="ewl-msg">{message}</p> : null}
      <div className="ewl-bar"><i /></div>
    </div>
  );
}

export default EwwonLoader;
