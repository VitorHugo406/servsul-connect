import { createContext, useContext, useEffect, useLayoutEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { applyBrand, resetBrand } from '@/lib/branding';

interface Company { id:string; name:string; slug:string; logo_url:string|null; primary_color:string; secondary_color:string; is_active:boolean; is_system:boolean; enabled_modules:string[]; }
interface CompanyContextType { company:Company|null; loading:boolean; refresh:()=>Promise<void>; hasModule:(m:string)=>boolean; }
const CompanyContext=createContext<CompanyContextType|undefined>(undefined);
const COMPANY_CACHE_PREFIX='nuvexa:company:';
const readCachedCompany=(companyId:string):Company|null=>{try{const raw=localStorage.getItem(`${COMPANY_CACHE_PREFIX}${companyId}`);if(!raw)return null;const parsed=JSON.parse(raw) as Company;if(!parsed?.id||parsed.id!==companyId||!parsed.primary_color||!parsed.secondary_color)return null;parsed.enabled_modules=Array.isArray(parsed.enabled_modules)?parsed.enabled_modules:[];return parsed;}catch{return null;}};
const cacheCompany=(company:Company)=>{try{localStorage.setItem(`${COMPANY_CACHE_PREFIX}${company.id}`,JSON.stringify(company));}catch{}};
export function CompanyProvider({children}:{children:ReactNode}){
 const {profile,user}=useAuth(); const [company,setCompany]=useState<Company|null>(null); const [loading,setLoading]=useState(true);
 const load=useCallback(async()=>{const companyId=(profile as any)?.company_id as string|undefined;if(!companyId){setCompany(null);resetBrand();setLoading(false);return;}
   const cached=readCachedCompany(companyId); if(cached){setCompany(cached);applyBrand(cached);setLoading(false);} else {setLoading(true);}
   const {data,error}=await (supabase as any).from('companies').select('*').eq('id',companyId).maybeSingle();
   if(!error&&data){const fresh={...(data as Company),enabled_modules:Array.isArray(data.enabled_modules)?data.enabled_modules:[]};cacheCompany(fresh);setCompany(fresh);applyBrand(fresh);}
   setLoading(false);
 },[profile]);
 useLayoutEffect(()=>{const companyId=(profile as any)?.company_id as string|undefined;if(!companyId)return;const cached=readCachedCompany(companyId);if(cached){setCompany(cached);applyBrand(cached);setLoading(false);}},[profile]);
 useEffect(()=>{if(profile){load();}else if(!user){resetBrand();setCompany(null);setLoading(false);}},[load,profile,user]);
 const hasModule=(m:string)=>company?.enabled_modules?.includes(m)??false; const hasCompanyId=Boolean((profile as any)?.company_id);
 if(loading&&user&&hasCompanyId&&!company)return <CompanyContext.Provider value={{company:null,loading:true,refresh:load,hasModule:()=>false}}><div className="flex min-h-screen items-center justify-center bg-background"><div className="flex flex-col items-center gap-3"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"/><p className="text-sm text-muted-foreground">Carregando identidade da empresa...</p></div></div></CompanyContext.Provider>;
 return <CompanyContext.Provider value={{company,loading,refresh:load,hasModule}}>{children}</CompanyContext.Provider>;
}
export function useCompany(){const ctx=useContext(CompanyContext);if(!ctx)throw new Error('useCompany must be used within CompanyProvider');return ctx;}
