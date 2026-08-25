import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'company-logos';

/** Resolve URLs públicas e caminhos antigos salvos em companies.logo_url. */
export function getCompanyLogoUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (/^(https?:|data:|blob:)/i.test(normalized)) return normalized;

  const path = normalized.replace(/^\/+/, '').replace(new RegExp(`^${BUCKET}/`), '');
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export function getCompanyLogoPath(slug: string, file: File): string {
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  return `${slug}/logo-${Date.now()}.${extension}`;
}
