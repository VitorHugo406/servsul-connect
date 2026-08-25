import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'company-logos';

/** Resolve URLs públicas e caminhos antigos salvos em companies.logo_url. */
export function getCompanyLogoUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;

  // companies.logo_url pode conter tanto o caminho salvo quanto uma URL antiga.
  // Sempre reconstruímos URLs do bucket atual para evitar domínio/path obsoleto.
  let rawPath = normalized;
  if (/^https?:/i.test(normalized)) {
    try {
      const url = new URL(normalized);
      const match = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/company-logos\/(.+)$/);
      if (match) rawPath = decodeURIComponent(match[1].split('?')[0].split('#')[0]);
      else return normalized;
    } catch {
      return normalized;
    }
  } else if (/^(data:|blob:)/i.test(normalized)) {
    return normalized;
  }

  const path = rawPath.replace(/^\/+/, '').replace(new RegExp(`^${BUCKET}/`), '');
  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return publicUrl ? `${publicUrl}${publicUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(path)}` : null;
}

export function getCompanyLogoPath(slug: string, file: File): string {
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  return `${slug}/logo-${Date.now()}.${extension}`;
}
