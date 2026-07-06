import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ArrowRight, Loader2, ShieldCheck, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { VETOR_LOGO_URL, applyBrand, resetBrand } from '@/lib/branding';

interface PublicCompany {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
}

const ADMIN_SYSTEM_SLUG = 'admin';

export default function SelectCompany() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<PublicCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PublicCompany | null>(null);

  useEffect(() => {
    resetBrand();
    (async () => {
      const { data, error } = await (supabase as any).rpc('public_list_companies_for_login');
      if (!error && Array.isArray(data)) setCompanies(data as PublicCompany[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q),
    );
  }, [companies, query]);

  const goToLogin = (slug: string) => {
    navigate(`/auth?company=${encodeURIComponent(slug)}`);
  };

  const goToSystemLogin = () => {
    navigate(`/auth?company=${ADMIN_SYSTEM_SLUG}`);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 15% 0%, hsla(220,70%,60%,0.10), transparent 45%), radial-gradient(circle at 85% 100%, hsla(220,70%,50%,0.08), transparent 40%), #EEF0F4',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-3 mb-8"
      >
        <img
          src={VETOR_LOGO_URL}
          alt="Vetor"
          className="h-12 md:h-14 object-contain"
          loading="eager"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.05 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-[0_20px_60px_-20px_rgba(16,24,40,0.25)] border border-[#E4E7EC] p-6 md:p-8"
      >
        <div className="text-center mb-6">
          <h1
            className="text-2xl md:text-[26px] font-bold text-[#12151C] tracking-tight"
            style={{ fontFamily: 'Sora, Inter, sans-serif' }}
          >
            Encontre sua empresa
          </h1>
          <p className="text-sm text-[#6B7280] mt-1.5">
            Selecione o ambiente para continuar
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9AA1AF]" />
          <Input
            autoFocus
            placeholder="Digite o nome da empresa..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 h-12 rounded-xl bg-[#F5F6F8] border-transparent focus-visible:ring-2 focus-visible:ring-[#2E5AAC] text-[15px]"
          />
        </div>

        <div className="mt-5 max-h-[340px] overflow-y-auto pr-1 -mr-1 space-y-2">
          {loading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-[#9AA1AF]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#9AA1AF]">
              {query ? 'Nenhuma empresa encontrada' : 'Nenhuma empresa disponível'}
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {filtered.map((c, idx) => (
                <motion.button
                  key={c.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onMouseEnter={() =>
                    applyBrand({ primary_color: c.primary_color, secondary_color: c.secondary_color })
                  }
                  onMouseLeave={() => (selected ? applyBrand(selected) : resetBrand())}
                  onClick={() => {
                    setSelected(c);
                    applyBrand(c);
                    setTimeout(() => goToLogin(c.slug), 240);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl border border-[#E4E7EC] hover:border-[color:var(--brand,#2E5AAC)] hover:shadow-sm transition-all text-left group"
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
                    style={{
                      background: `linear-gradient(140deg, ${c.primary_color}, ${c.secondary_color})`,
                    }}
                  >
                    {c.logo_url ? (
                      <img src={c.logo_url} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[#12151C] truncate">{c.name}</p>
                    <p className="text-xs text-[#9AA1AF] truncate">{c.slug}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#9AA1AF] group-hover:text-[color:var(--brand,#2E5AAC)] group-hover:translate-x-0.5 transition-all" />
                </motion.button>
              ))}
            </AnimatePresence>
          )}
        </div>

        <div className="mt-6 pt-5 border-t border-[#E4E7EC] flex items-center justify-between">
          <p className="text-xs text-[#9AA1AF]">Administrador do sistema?</p>
          <Button
            variant="ghost"
            size="sm"
            className="text-[13px] text-[#2E5AAC] hover:bg-[#2E5AAC]/5"
            onClick={goToSystemLogin}
          >
            <ShieldCheck className="w-4 h-4 mr-1.5" />
            Acesso Vetor
          </Button>
        </div>
      </motion.div>

      <p className="mt-6 text-xs text-[#9AA1AF]">© {new Date().getFullYear()} Vetor</p>
    </div>
  );
}
