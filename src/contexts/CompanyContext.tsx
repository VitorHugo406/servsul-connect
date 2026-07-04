import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  is_active: boolean;
  is_system: boolean;
}

interface CompanyContextType {
  company: Company | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

// hex (#RRGGBB) -> HSL "h s% l%"
function hexToHslTuple(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace('#', '').trim();
  const v = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.padEnd(6, '0');
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      case b: h = ((r - g) / d + 4); break;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function applyBrand(company: Company | null) {
  const root = document.documentElement;
  if (!company) {
    root.style.removeProperty('--brand');
    root.style.removeProperty('--brand-2');
    root.style.removeProperty('--brand-dark');
    root.style.removeProperty('--brand-glow');
    root.style.removeProperty('--brand-glow-soft');
    root.style.removeProperty('--company-hue');
    return;
  }
  const p = hexToHslTuple(company.primary_color || '#2E5AAC');
  const s = hexToHslTuple(company.secondary_color || '#FF6B00');
  root.style.setProperty('--company-hue', String(p.h));
  root.style.setProperty('--brand', `hsl(${p.h} ${p.s}% ${p.l}%)`);
  root.style.setProperty('--brand-2', `hsl(${s.h} ${s.s}% ${s.l}%)`);
  root.style.setProperty('--brand-dark', `hsl(${p.h} ${Math.min(70, p.s + 5)}% ${Math.max(14, p.l - 30)}%)`);
  root.style.setProperty('--brand-glow', `hsla(${p.h}, 75%, 55%, 0.35)`);
  root.style.setProperty('--brand-glow-soft', `hsla(${p.h}, 75%, 55%, 0.14)`);
  // Override semantic primary tokens so the whole shadcn stack rebrands.
  root.style.setProperty('--primary', `${p.h} ${p.s}% ${p.l}%`);
  root.style.setProperty('--secondary', `${s.h} ${s.s}% ${s.l}%`);
  root.style.setProperty('--ring', `${p.h} ${p.s}% ${p.l}%`);
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const companyId = (profile as any)?.company_id as string | undefined;
    if (!companyId) {
      setCompany(null);
      applyBrand(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .maybeSingle();
    if (!error && data) {
      const c = data as Company;
      setCompany(c);
      applyBrand(c);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    return () => applyBrand(null);
  }, []);

  return (
    <CompanyContext.Provider value={{ company, loading, refresh: load }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
}
