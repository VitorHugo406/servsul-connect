import { supabase } from '@/integrations/supabase/client';
import { getStorageTarget, createSignedStorageUrl } from '@/lib/storageUrls';

const DB_NAME = 'ewvor-local-attachments';
const STORE_NAME = 'files';

interface CachedAttachment {
  key: string;
  userId: string;
  path: string;
  name: string;
  type: string;
  blob: Blob;
  savedAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local attachment storage'));
  });
}

function attachmentKey(userId: string, path: string) {
  return `${userId}:${path}`;
}

export async function getLocalAttachment(userId: string, path: string): Promise<CachedAttachment | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME)
      .get(attachmentKey(userId, path));
    request.onsuccess = () => resolve((request.result as CachedAttachment | undefined) ?? null);
    request.onerror = () => reject(request.error);
    request.transaction.oncomplete = () => db.close();
  });
}

export async function saveLocalAttachment(userId: string, path: string, blob: Blob, name: string): Promise<void> {
  const db = await openDatabase();
  const record: CachedAttachment = {
    key: attachmentKey(userId, path),
    userId,
    path,
    name,
    type: blob.type || 'application/octet-stream',
    blob,
    savedAt: Date.now(),
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Local attachment save aborted'));
  });
  db.close();
}

export async function getOrCacheAttachment(userId: string, sourceUrl: string, fileName: string): Promise<string> {
  const target = getStorageTarget(sourceUrl);
  if (!target || target.bucket !== 'attachments') return createSignedStorageUrl(sourceUrl);

  const cached = await getLocalAttachment(userId, target.path);
  if (cached) return URL.createObjectURL(cached.blob);

  const signedUrl = await createSignedStorageUrl(sourceUrl);
  if (!signedUrl) return '';
  const response = await fetch(signedUrl);
  if (!response.ok) return '';
  const blob = await response.blob();
  await saveLocalAttachment(userId, target.path, blob, fileName);
  return URL.createObjectURL(blob);
}

export async function cacheOwnUploadedAttachment(userId: string, path: string, file: File): Promise<void> {
  await saveLocalAttachment(userId, path, file, file.name);
}

export async function removeLocalAttachment(userId: string, path: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(attachmentKey(userId, path));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
