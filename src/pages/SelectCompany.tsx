import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2, Search, Check, X, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { BRAND_LOGO_URL, applyBrand, resetBrand } from '@/lib/branding';
import { getCompanyLogoUrl } from '@/lib/companyLogo';

interface FoundCompany {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  is_system: boolean;
}

export default function SelectCompany() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [found, setFound] = useState<FoundCompany | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [searching, setSearching] = useState(false);
  const [continuing, setContinuing] = useState(false);

  useEffect(() => {
    resetBrand();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 320);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!debounced) {
      setFound(null);
      setNotFound(false);
      resetBrand();
      return;
    }
    let cancelled = false;
    setSearching(true);
    (async () => {
      const { data, error } = await (supabase as any).rpc('public_find_company', {
        _query: debounced,
      });
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (!error && row) {
        setFound(row as FoundCompany);
        setNotFound(false);
        applyBrand(row as FoundCompany);
      } else {
        setFound(null);
        setNotFound(true);
        resetBrand();
      }
      setSearching(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const glow = useMemo(() => {
    if (!found) return 'transparent';
    return `radial-gradient(closest-side, ${found.primary_color}, ${found.secondary_color} 40%, transparent 78%)`;
  }, [found]);

  const handleContinue = () => {
    if (!found) return;
    setContinuing(true);
    setTimeout(() => navigate(`/auth?company=${encodeURIComponent(found.slug)}`), 200);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden transition-colors duration-500"
      style={{
        background:
          'radial-gradient(circle at 12% 0%, hsla(220,60%,55%,0.10), transparent 45%), radial-gradient(circle at 88% 100%, hsla(220,60%,45%,0.08), transparent 40%), #F5F7FB',
      }}
    >
      {/* Nuvexa logo with dynamic glow */}
      <div className="relative mb-8 flex items-center justify-center">
        <motion.div
          initial={false}
          animate={{
            opacity: found ? 1 : 0,
            scale: found ? 1 : 0.6,
          }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="absolute inset-0 -m-20 rounded-full blur-3xl pointer-events-none"
          style={{ background: glow }}
        />
        <motion.img
          key={found?.id ?? 'default'}
          src={getCompanyLogoUrl(found?.logo_url) ?? BRAND_LOGO_URL}
          alt={found?.name ?? 'Nuvexa'}
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = BRAND_LOGO_URL;
          }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="h-24 md:h-28 object-contain relative z-10 drop-shadow-[0_10px_30px_rgba(15,23,42,0.15)]"
          loading="eager"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-6">
          <h1
            className="text-2xl md:text-[28px] font-bold text-[#12151C] tracking-tight"
            style={{ fontFamily: 'Sora, Inter, sans-serif' }}
          >
            Digite o nome da sua empresa
          </h1>
          <p className="text-sm text-[#6B7280] mt-1.5">
            Localizaremos seu ambiente corporativo
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-[0_20px_60px_-20px_rgba(16,24,40,0.25)] border border-[#E4E7EC] p-5 md:p-6">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9AA1AF]" />
            <Input
              autoFocus
              placeholder="Ex.: Sua Empresa Ltda"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 h-12 rounded-xl bg-[#F5F6F8] border-transparent focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#2E5AAC)] text-[15px]"
            />
            {searching && (
              <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9AA1AF] animate-spin" />
            )}
          </div>

          <div className="mt-4 min-h-[80px]">
            <AnimatePresence mode="wait">
              {found && (
                <motion.div
                  key={`ok-${found.id}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center gap-3 p-3 rounded-2xl border-2"
                  style={{
                    borderColor: found.primary_color,
                    background: `linear-gradient(135deg, ${found.primary_color}33, ${found.secondary_color}22)`,
                  }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
                    style={{
                      background: `linear-gradient(140deg, ${found.primary_color}, ${found.secondary_color})`,
                    }}
                  >
                    {found.logo_url ? (
                      <img src={getCompanyLogoUrl(found.logo_url) ?? undefined} alt={found.name} className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand,#2E5AAC)] flex items-center gap-1">
                      <Check className="w-3 h-3" /> Empresa encontrada
                    </p>
                    <p className="text-[15px] font-semibold text-[#12151C] truncate">
                      {found.name}
                    </p>
                  </div>
                </motion.div>
              )}
              {notFound && !searching && (
                <motion.div
                  key="nf"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center gap-3 p-3 rounded-2xl border border-[#F0D0D0] bg-[#FFF5F5]"
                >
                  <div className="w-11 h-11 rounded-xl bg-[#FEE2E2] flex items-center justify-center shrink-0">
                    <X className="w-5 h-5 text-[#DC2626]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#DC2626]">
                      Não encontrada
                    </p>
                    <p className="text-[13px] text-[#6B7280]">
                      Verifique o nome digitado
                    </p>
                  </div>
                </motion.div>
              )}
              {!found && !notFound && !searching && (
                <motion.p
                  key="hint"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-xs text-[#9AA1AF] pt-6"
                >
                  Comece a digitar para localizar sua empresa
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <Button
            disabled={!found || continuing}
            onClick={handleContinue}
            className="w-full h-12 mt-4 rounded-xl text-[15px] font-semibold transition-all disabled:opacity-40"
            style={{
              background: found
                ? `linear-gradient(135deg, ${found.primary_color}, ${found.secondary_color})`
                : '#12151C',
              color: 'white',
            }}
          >
            {continuing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Continuar
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </>
            )}
          </Button>
        </div>
      </motion.div>

      <p className="mt-8 text-xs text-[#9AA1AF] relative z-10">
        © {new Date().getFullYear()} Nuvexa
      </p>
    </div>
  );
}
