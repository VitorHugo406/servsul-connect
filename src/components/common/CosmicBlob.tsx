// The orb avatar of "Comunicados" and "EwvonAI": the transparent animated bubble (see cosmicBlob.css).
// Small sizes use the 96px animation, bigger ones the 256px one; people who prefer reduced motion get a still image.
import './cosmicBlob.css';

export function CosmicBlob({ size = 40, className, talk, label = 'Comunicados' }: { size?: number; tone?: 'light' | 'dark'; className?: string; talk?: boolean; label?: string }) {
  const anim = size <= 48 ? '/ewwon/img/orb-96.webp' : '/ewwon/img/orb-256.webp';
  return (
    <span className={'cblob' + (talk ? ' talk' : '') + (className ? ' ' + className : '')} style={{ ['--s' as string]: size + 'px' }} role="img" aria-label={label}>
      <picture>
        <source media="(prefers-reduced-motion: reduce)" srcSet="/ewwon/img/orb-still.png" />
        <img src={anim} alt="" width={size} height={size} decoding="async" draggable={false} />
      </picture>
    </span>
  );
}
