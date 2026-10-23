import { ReactNode, useEffect, useRef, useState } from 'react';
import { useSignedStorageUrl } from '@/lib/storageUrls';

function useNearViewport<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (typeof IntersectionObserver === 'undefined') {
      setNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: '300px' });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, nearViewport };
}

export function SignedStorageLink({ url, className, children }: { url: string; className?: string; children: ReactNode }) {
  const { ref, nearViewport } = useNearViewport<HTMLAnchorElement>();
  const signedUrl = useSignedStorageUrl(url, nearViewport);
  return (
    <a ref={ref} href={signedUrl || undefined} target="_blank" rel="noopener noreferrer" className={className} aria-disabled={!signedUrl || undefined}>
      {children}
    </a>
  );
}

export function SignedStorageImage({ url, alt, className }: { url: string; alt: string; className?: string }) {
  const { ref, nearViewport } = useNearViewport<HTMLImageElement>();
  const signedUrl = useSignedStorageUrl(url, nearViewport);
  return <img ref={ref} src={signedUrl || undefined} alt={alt} className={className} loading="lazy" decoding="async" />;
}
