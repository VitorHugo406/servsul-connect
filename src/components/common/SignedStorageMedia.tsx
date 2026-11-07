import { ReactNode, useState } from 'react';
import { openMedia, useCachedMedia } from '@/lib/mediaCache';

// Attachments are opened from this device's copy when available (kept after the
// server copy of chat media expires) and downloaded + cached otherwise.
export function SignedStorageLink({ url, className, children }: { url: string; className?: string; children: ReactNode }) {
  const [gone, setGone] = useState(false);
  const name = decodeURIComponent((url.split('?')[0].split('/').pop() || 'arquivo'));
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={className} title={gone ? 'Arquivo expirado no servidor' : undefined}
      onClick={(e) => { e.preventDefault(); void openMedia(url, name).then((ok) => setGone(!ok)); }}>
      {children}
      {gone ? <span className="ml-1 text-[10px] opacity-70">(expirado)</span> : null}
    </a>
  );
}

export function SignedStorageImage({ url, alt, className }: { url: string; alt: string; className?: string }) {
  const { src, state } = useCachedMedia(url);
  if (state === 'expired') return <span className={'flex h-24 w-40 flex-col items-center justify-center rounded-2xl bg-muted/60 text-xs text-muted-foreground ' + (className || '')}>📷<span>Foto expirada</span></span>;
  if (!src) return <span className={'block h-32 w-48 animate-pulse rounded-2xl bg-muted/60 ' + (className || '')} />;
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" />;
}
