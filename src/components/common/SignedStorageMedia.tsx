import { ReactNode, useEffect, useState } from 'react';
import { useSignedStorageUrl, getStorageTarget } from '@/lib/storageUrls';
import { getOrCacheAttachment } from '@/lib/localAttachmentStorage';
import { useAuth } from '@/contexts/AuthContext';

export function SignedStorageLink({ url, className, children }: { url: string; className?: string; children: ReactNode }) {
  const signedUrl = useSignedStorageUrl(url);
  const { user } = useAuth();
  const [localUrl, setLocalUrl] = useState('');
  const target = getStorageTarget(url);
  const isAttachment = target?.bucket === 'attachments';

  useEffect(() => {
    let alive = true;
    let objectUrl = '';
    setLocalUrl('');
    if (!isAttachment || !user?.id) return;
    getOrCacheAttachment(user.id, url, 'anexo')
      .then((resolved) => {
        if (!alive) {
          if (resolved.startsWith('blob:')) URL.revokeObjectURL(resolved);
          return;
        }
        objectUrl = resolved.startsWith('blob:') ? resolved : '';
        setLocalUrl(resolved);
      })
      .catch((error) => {
        console.warn('Não foi possível manter cópia local do anexo:', error);
      });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, user?.id, isAttachment]);

  const href = isAttachment ? (localUrl || signedUrl) : signedUrl;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

export function SignedStorageImage({ url, alt, className }: { url: string; alt: string; className?: string }) {
  const signedUrl = useSignedStorageUrl(url);
  const { user } = useAuth();
  const [localUrl, setLocalUrl] = useState('');
  const target = getStorageTarget(url);
  const isAttachment = target?.bucket === 'attachments';

  useEffect(() => {
    let alive = true;
    let objectUrl = '';
    setLocalUrl('');
    if (!isAttachment || !user?.id) return;
    getOrCacheAttachment(user.id, url, alt || 'imagem')
      .then((resolved) => {
        if (!alive) {
          if (resolved.startsWith('blob:')) URL.revokeObjectURL(resolved);
          return;
        }
        objectUrl = resolved.startsWith('blob:') ? resolved : '';
        setLocalUrl(resolved);
      })
      .catch((error) => console.warn('Não foi possível manter cópia local da imagem:', error));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, alt, user?.id, isAttachment]);

  return <img src={isAttachment ? (localUrl || signedUrl) : signedUrl} alt={alt} className={className} loading="lazy" decoding="async" />;
}
