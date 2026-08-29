import { createContext, useContext, useEffect, useLayoutEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { applyBrand } from '@/lib/branding';

interface Company { id:string; name:string; slug:string; logo_url:string|null; primary_color:string; secondary_color:string; is_active:boolean; is_system:boolean; enabled_modules:string[]; }
interface CompanyContextType { company:Company|null; loading:boolean; refresh:()=>Promise<void>; hasModule:(m:string)=>boolean; }
const CompanyContext=createContext<CompanyContextType|undefined>(undefined);
const COMPANY_CACHE_PREFIX='nuvexa:company:';
const readCachedCompany=(companyId:string):Company|null=>{try{const raw=localStorage.getItem(`${COMPANY_CACHE_PREFIX}${companyId}`);if(!raw)return null;const parsed=JSON.parse(raw) as Company;if(!parsed?.id||parsed.id!==companyId||!parsed.primary_color||!parsed.secondary_color)return null;parsed.enabled_modules=Array.isArray(parsed.enabled_modules)?parsed.enabled_modules:[];return parsed;}catch{return null;}};
const cacheCompany=(company:Company)=>{try{localStorage.setItem(`${COMPANY_CACHE_PREFIX}${company.id}`,JSON.stringify(company));localStorage.setItem('nuvexa:last-company',JSON.stringify(company));}catch{}};
export function CompanyProvider({children}:{children:ReactNode}){
 const {profile,user}=useAuth(); const [company,setCompany]=useState<Company|null>(null); const [loading,setLoading]=useState(true);
 const load=useCallback(async()=>{const companyId=(profile as any)?.company_id as string|undefined;if(!companyId){setCompany(null);setLoading(false);return;}
   const cached=readCachedCompany(companyId);
   if(cached){setCompany(cached);applyBrand(cached);}
   else {setCompany(null);setLoading(true);}
   const {data,error}=await (supabase as any).from('companies').select('*').eq('id',companyId).maybeSingle();
   if(!error&&data?.primary_color&&data?.secondary_color){const fresh={...(data as Company),enabled_modules:Array.isArray(data.enabled_modules)?data.enabled_modules:[]};cacheCompany(fresh);setCompany(fresh);applyBrand(fresh);}
   else if(!cached){setCompany(null);}
   setLoading(false);
 },[profile]);
 useLayoutEffect(()=>{const companyId=(profile as any)?.company_id as string|undefined;if(!companyId)return;const cached=readCachedCompany(companyId);if(cached){setCompany(cached);applyBrand(cached);setLoading(false);}},[profile]);
 useEffect(()=>{if(profile){load();}else{setCompany(null);setLoading(Boolean(user));}},[load,profile,user]);
 const hasModule=(m:string)=>company?.enabled_modules?.includes(m)??false; const hasCompanyId=Boolean((profile as any)?.company_id);
 if(user&&hasCompanyId&&loading&&!company)return <CompanyContext.Provider value={{company:null,loading:true,refresh:load,hasModule:()=>false}}><div className="flex min-h-screen items-center justify-center bg-white dark:bg-slate-950"><div className="flex flex-col items-center gap-3"><div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-400 dark:border-slate-800 dark:border-t-slate-500"/><p className="text-sm text-slate-500 dark:text-slate-400">Carregando identidade da empresa...</p></div></div></CompanyContext.Provider>;
 return <CompanyContext.Provider value={{company,loading,refresh:load,hasModule}}>{children}</CompanyContext.Provider>;
}
export function useCompany(){const ctx=useContext(CompanyContext);if(!ctx)throw new Error('useCompany must be used within CompanyProvider');return ctx;}
