// Animated "Comunicados" avatar (see cosmicBlob.css). `tone` forces light/dark; otherwise it
// follows the page theme (Tailwind `dark` class on <html>).
import './cosmicBlob.css';

export function CosmicBlob({ size = 40, tone, className, talk, label = 'Comunicados' }: { size?: number; tone?: 'light' | 'dark'; className?: string; talk?: boolean; label?: string }) {
  return (
    <span className={'cblob ' + (tone || 'auto') + (talk ? ' talk' : '') + (className ? ' ' + className : '')} style={{ ['--s' as string]: size + 'px' }} role="img" aria-label={label}>
      <span className="cblob-b"><span className="cblob-c" /><span className="cblob-l" /></span>
    </span>
  );
}
