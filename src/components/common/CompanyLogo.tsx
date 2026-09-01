import { useCompanyLogoUrl } from '@/lib/companyLogo';

interface CompanyLogoProps {
  value: string | null | undefined;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}

/** Imagem de logo da empresa resolvida por URL assinada (bucket privado). */
export function CompanyLogo({ value, alt, className, fallback = null }: CompanyLogoProps) {
  const url = useCompanyLogoUrl(value);
  if (!url) return <>{fallback}</>;
  return <img src={url} alt={alt} className={className} loading="eager" decoding="async" />;
}
