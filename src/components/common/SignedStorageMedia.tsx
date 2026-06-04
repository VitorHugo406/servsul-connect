import { ReactNode } from 'react';
import { useSignedStorageUrl } from '@/lib/storageUrls';

export function SignedStorageLink({ url, className, children }: { url: string; className?: string; children: ReactNode }) {
  const signedUrl = useSignedStorageUrl(url);
  return (
    <a href={signedUrl} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

export function SignedStorageImage({ url, alt, className }: { url: string; alt: string; className?: string }) {
  const signedUrl = useSignedStorageUrl(url);
  return <img src={signedUrl} alt={alt} className={className} loading="lazy" decoding="async" />;
}