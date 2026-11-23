// Imagem própria do setor (Gestão de Setores › "Ícone do setor" › "Usar imagem própria").
// Sem migração: a imagem fica em sectors.icon como "img:<url pública>" — quem não conhece o prefixo cai no ícone
// padrão (prédio). O arquivo é reduzido a 256×256 (recorte central, WebP/JPEG) e vai para o bucket público avatars, na
// pasta de quem salvou (<auth uid>/setor-<aleatório>.webp, política de pasta do dono), porque aparece para toda a empresa.
import { supabase } from '@/integrations/supabase/client';

export const SECTOR_IMG_PREFIX = 'img:';
export const sectorImg = (icon?: string | null): string | null =>
  icon && icon.startsWith(SECTOR_IMG_PREFIX) ? icon.slice(SECTOR_IMG_PREFIX.length) : null;

const loadImage = (file: File) => new Promise<HTMLImageElement>((ok, fail) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); ok(img); };
  img.onerror = () => { URL.revokeObjectURL(url); fail(new Error('Não foi possível ler essa imagem. Use PNG, JPG ou WebP.')); };
  img.src = url;
});

/** Reduz, recorta em quadrado e envia. Devolve o valor para gravar em sectors.icon. */
export async function uploadSectorImage(file: File): Promise<string> {
  if (!/^image\//.test(file.type) && !/\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(file.name)) throw new Error('Escolha um arquivo de imagem (PNG, JPG ou WebP).');
  if (file.size > 15 * 1024 * 1024) throw new Error('A imagem é grande demais (máximo 15 MB).');
  const img = await loadImage(file);
  const S = 256, side = Math.min(img.naturalWidth, img.naturalHeight);
  if (!side) throw new Error('Imagem inválida.');
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, S, S);
  const toBlob = (type: string, q: number) => new Promise<Blob | null>((ok) => c.toBlob(ok, type, q));
  let blob = await toBlob('image/webp', 0.88), type = 'image/webp', ext = 'webp';
  if (!blob || blob.type !== 'image/webp') { blob = await toBlob('image/jpeg', 0.9); type = 'image/jpeg'; ext = 'jpg'; }
  if (!blob) throw new Error('Não foi possível preparar a imagem.');
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Sessão expirada. Entre de novo.');
  const path = `${u.user.id}/setor-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: type, cacheControl: '31536000', upsert: false });
  if (error) throw new Error('Não foi possível enviar a imagem.');
  return SECTOR_IMG_PREFIX + supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}
