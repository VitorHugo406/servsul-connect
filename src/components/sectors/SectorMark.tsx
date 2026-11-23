// Marca do setor nas conversas: a imagem própria do setor (sectors.icon = "img:<url>") ou, sem ela, a inicial na cor do setor.
import type { CSSProperties } from 'react';
import { sectorImg } from '@/lib/sectorImage';

export function SectorMark({ sector, className, style, text }: { sector?: { name?: string | null; color?: string | null; icon?: string | null } | null; className: string; style?: CSSProperties; text?: string }) {
  const img = sectorImg(sector?.icon);
  return (
    <span className={`${className} overflow-hidden`} style={{ backgroundColor: sector?.color || '#64748b', ...style }}>
      {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <span className={text}>{(sector?.name || '?').charAt(0).toUpperCase()}</span>}
    </span>
  );
}
