// In-app file references ("ewvon:file/<bucket>/<path>") used in chat messages instead of public
// signed links: the file is downloaded with the signed-in user's session, so storage policies
// decide who can get it and the storage address never shows up in the message.
import { supabase } from '@/integrations/supabase/client';

const ALLOWED = new Set(['attachments']);
export const isAppFileRef = (href: string) => /^ewvon:file\/[a-z-]+\/[\w./-]+$/.test(href) && !href.includes('..');

export async function downloadAppFile(href: string): Promise<void> {
  if (!isAppFileRef(href)) throw new Error('Arquivo inválido');
  const [, bucket, ...rest] = href.replace(/^ewvon:file\//, 'x/').split('/');
  if (!ALLOWED.has(bucket)) throw new Error('Arquivo inválido');
  const path = rest.join('/');
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw new Error('Você não tem acesso a este arquivo ou ele expirou');
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url; a.download = path.split('/').pop() || 'arquivo';
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
