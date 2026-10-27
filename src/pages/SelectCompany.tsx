import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2, Search, Check, X, Building2, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input'; import { Button } from '@/components/ui/button'; import { supabase } from '@/integrations/supabase/client'; import { applyBrand, resetBrand } from '@/lib/branding'; import { useCompanyLogoUrl } from '@/lib/companyLogo';
interface FoundCompany { id:string; name:string; slug:string; logo_url:string|null; primary_color:string; secondary_color:string; is_system:boolean; enabled_modules?:string[]; is_active?:boolean; }
const PUBLIC_COMPANY_CACHE='ewvor:public-company:'; const COMPANY_CACHE='ewvor:company:'; const LAST_COMPANY='ewvor:last-company';
const saveCompany=(c:FoundCompany,query?:string)=>{try{if(query)localStorage.setItem(`${PUBLIC_COMPANY_CACHE}${query.toLowerCase()}`,JSON.stringify(c));localStorage.setItem(`${COMPANY_CACHE}${c.id}`,JSON.stringify(c));localStorage.setItem(LAST_COMPANY,JSON.stringify(c));}catch{}};
const readPublicCached=(query:string):FoundCompany|null=>{try{const raw=localStorage.getItem(`${PUBLIC_COMPANY_CACHE}${query.toLowerCase()}`);if(!raw)return null;const c=JSON.parse(raw) as FoundCompany;return c?.id&&c?.primary_color&&c?.secondary_color?c:null;}catch{return null;}};
export default function SelectCompany(){const navigate=useNavigate();const[query,setQuery]=useState('');const[debounced,setDebounced]=useState('');const[found,setFound]=useState<FoundCompany|null>(null);const[notFound,setNotFound]=useState(false);const[searching,setSearching]=useState(false);const[continuing,setContinuing]=useState(false);
 useEffect(()=>{resetBrand(); window.dispatchEvent(new CustomEvent('ewvon-access-state',{detail:{status:'idle',company:null}}));},[]);
 useEffect(()=>{const t=setTimeout(()=>setDebounced(query.trim()),120);return()=>clearTimeout(t)},[query]);
 useEffect(()=>{if(!debounced){setFound(null);setNotFound(false);setSearching(false);window.dispatchEvent(new CustomEvent('ewvon-access-state',{detail:{status:'idle',company:null}}));return;}const cached=readPublicCached(debounced);if(cached){setFound(cached);setNotFound(false);saveCompany(cached);applyBrand(cached);}let cancelled=false;setSearching(!cached);window.dispatchEvent(new CustomEvent('ewvon-access-state',{detail:{status:cached?'found':'searching',company:cached}}));(async()=>{const{data,error}=await(supabase as any).rpc('public_find_company',{_query:debounced});if(cancelled)return;const row=Array.isArray(data)?data[0]:data;if(!error&&row){const company=row as FoundCompany;saveCompany(company,debounced);setFound(company);setNotFound(false);applyBrand(company);window.dispatchEvent(new CustomEvent('ewvon-access-state',{detail:{status:'found',company}}));}else if(!cached){setFound(null);setNotFound(true);resetBrand();window.dispatchEvent(new CustomEvent('ewvon-access-state',{detail:{status:'not-found',company:null}}));}setSearching(false)})();return()=>{cancelled=true}},[debounced]);
 const foundLogoUrl=useCompanyLogoUrl(found?.logo_url);const handleContinue=()=>{if(!found)return;saveCompany(found);setContinuing(true);navigate(`/auth?company=${encodeURIComponent(found.slug)}`)};
 return (
  <main className="ewvon-company-auth-page">
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="ewvon-company-layout text-black [&_*]:text-black"
    >

      {found?.logo_url && foundLogoUrl && (
        <motion.div
          key={found.id}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="ewvon-company-logo-wrap"
        >
          <img src={foundLogoUrl} alt={found.name} className="ewvon-company-logo" loading="eager" />
        </motion.div>
      )}

      <div className="ewvon-access-heading">
        <span className="ewvon-access-eyebrow">ACESSO CORPORATIVO</span>
        <h1>Entre no seu ambiente</h1>
        <p>Informe o nome da empresa para continuar com segurança.</p>
      </div>

      <section className="ewvon-company-auth-card" aria-label="Localizar empresa">
        <label className="ewvon-access-label" htmlFor="company-search">Empresa</label>
        <div className="ewvon-company-search text-black">
          <Search size={17} aria-hidden="true" />
          <Input
            id="company-search"
            autoFocus
            placeholder="Buscar pelo nome da empresa"
            className="text-black placeholder:!text-gray-500"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="organization"
            aria-describedby="company-search-hint"
          />
          {searching && <Loader2 size={17} className="ewvon-search-spinner" aria-label="Buscando empresa" />}
        </div>



        <Button disabled={!found || continuing} onClick={handleContinue} className="ewvon-company-continue">
          {continuing ? <Loader2 size={17} className="animate-spin" /> : <>Continuar <ArrowRight size={17} /></>}
        </Button>
        <p className="ewvon-access-security"><Lock size={12} /> Acesso protegido para sua organização</p>
      </section>

      <footer className="ewvon-access-footer">© {new Date().getFullYear()} ewvon <span>·</span> Gestão corporativa</footer>
    </motion.section>
  </main>
 );
}
