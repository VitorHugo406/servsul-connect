import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { FloatingNoteProvider } from "@/contexts/FloatingNoteContext";
import { supabase } from "@/integrations/supabase/client";
import { applyBrand, getCachedBrand } from "@/lib/branding";
import { AdminBirthdayPdfGuard } from "@/components/birthday/AdminBirthdayPdfGuard";
import { Building2, Check, Loader2, X } from "lucide-react";

// Recarrega uma única vez quando um pedaço antigo do app ficou em cache (deploy novo)
function lazyWithRetry<T extends { default: React.ComponentType<any> }>(factory: () => Promise<T>) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      const key = 'nuvexa:chunk-reloaded';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
        return await new Promise<T>(() => {});
      }
      throw err;
    }
  });
}

const Index = lazyWithRetry(() => import("./pages/Index"));
const LandingPage = lazyWithRetry(() => import("./pages/LandingPage"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const SelectCompany = lazyWithRetry(() => import("./pages/SelectCompany"));
const BirthdayShare = lazyWithRetry(() => import("./pages/BirthdayShare"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

const queryClient = new QueryClient();
function LoadingScreen({ message = 'Carregando ambiente da empresa...' }: { message?: string }) { return <div className="flex min-h-screen items-center justify-center bg-white dark:bg-slate-950"><div className="flex flex-col items-center gap-4"><div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-400 dark:border-slate-800 dark:border-t-slate-500"/><p className="text-sm text-slate-500 dark:text-slate-400">{message}</p></div></div>; }
function CompanyBrandGate({ children }: { children: React.ReactNode }) {
  const [searchParams] = useSearchParams(); const companySlug = searchParams.get('company'); const [ready, setReady] = useState(false);
  useEffect(() => { let cancelled = false; const load = async () => { if (!companySlug) { setReady(true); return; } const cached = getCachedBrand(); let cachedForSlug: any = null; try { const raw = localStorage.getItem(`nuvexa:public-company:${companySlug.toLowerCase()}`); if (raw) cachedForSlug = JSON.parse(raw); } catch {} if (cachedForSlug?.primary_color && cachedForSlug?.secondary_color) applyBrand(cachedForSlug); else if (cached?.slug === companySlug && cached?.primary_color && cached?.secondary_color) applyBrand(cached); try { const { data, error } = await (supabase as any).rpc('public_get_company_by_slug', { _slug: companySlug }); const row = Array.isArray(data) ? data[0] : data; if (cancelled) return; if (!error && row?.primary_color && row?.secondary_color) { applyBrand(row); try { localStorage.setItem(`nuvexa:public-company:${companySlug.toLowerCase()}`, JSON.stringify(row)); localStorage.setItem('nuvexa:last-company', JSON.stringify(row)); } catch {} setReady(true); } else if (cachedForSlug?.primary_color && cachedForSlug?.secondary_color) setReady(true); else setReady(false); } catch { if (!cancelled && cachedForSlug?.primary_color && cachedForSlug?.secondary_color) setReady(true); } }; void load(); return () => { cancelled = true; }; }, [companySlug]);
  if (!ready) return <LoadingScreen />; return <>{children}</>;
}
function PublicRoute({ children }: { children: React.ReactNode }) { const { user, loading, verifying } = useAuth(); if (loading) return <LoadingScreen message="Verificando acesso..." />; if (user && !verifying) return <Navigate to="/" replace />; return <>{children}</>; }
function RootRoute() {
  const { user, loading, verifying } = useAuth();
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  if (loading || verifying) return <LoadingScreen message="Preparando seu ambiente..." />;
  if (user) return <Index />;
  return isMobile ? <SelectCompany /> : <LandingPage />;
}
function PersistentAccessNavigation() {
  const location = useLocation();
  const [state, setState] = useState<{status:string; company:any}>({status:'idle',company:null});
  const slug = new URLSearchParams(location.search).get('company');
  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail) setState(detail);
    };
    window.addEventListener('ewvon-access-state', update);
    return () => window.removeEventListener('ewvon-access-state', update);
  }, []);
  useEffect(() => {
    if (location.pathname !== '/auth' || !slug) return;
    let cancelled = false;
    const load = async () => {
      try {
        const cachedRaw = localStorage.getItem('ewvor:public-company:' + slug.toLowerCase());
        if (cachedRaw) {
          const company = JSON.parse(cachedRaw);
          if (!cancelled && company?.primary_color) setState({status:'found',company});
        }
        const {data,error} = await (supabase as any).rpc('public_get_company_by_slug',{_slug:slug});
        const company = Array.isArray(data) ? data[0] : data;
        if (!cancelled && !error && company?.primary_color) setState({status:'found',company});
      } catch {}
    };
    void load();
    return () => { cancelled = true; };
  }, [location.pathname,slug]);
  const active = location.pathname === '/auth' || location.pathname === '/select-company';
  if (!active) return null;
  const company = state.company;
  const status = state.status;
  const className = 'ewvon-access-nav ' + (status === 'found' ? 'is-found' : status === 'searching' ? 'is-searching' : status === 'not-found' ? 'is-not-found' : 'is-idle');
  return <div className={className} style={company ? ({'--company-accent':company.primary_color,'--company-secondary':company.secondary_color} as any) : undefined} aria-live="polite">
    <a href="/select-company" className="ewvon-access-nav-brand"><span className="ewvon-access-nav-mark">e</span><span>ewvon</span></a>
    <div className="ewvon-access-nav-state">
      {status === 'searching' || status === 'idle' ? <><Loader2 size={14} className="animate-spin"/><span>{status === 'idle' ? 'Procurando empresa' : 'Procurando empresa'}</span></> : status === 'not-found' ? <><X size={14}/><span>Empresa Não Encontrada</span></> : company ? <><span className="ewvon-access-nav-company-logo">{company.logo_url ? <img src={company.logo_url} alt=""/> : <Building2 size={16}/>}</span><span className="ewvon-access-nav-company-name">{company.name}</span><Check size={14}/></> : <><Loader2 size={14} className="animate-spin"/><span>Procurando empresa</span></>}
    </div>
  </div>;
}
function AppRoutes() { const location = useLocation(); const authContent = <PublicRoute><Auth /></PublicRoute>; return <><PersistentAccessNavigation /><Suspense fallback={<LoadingScreen />}><AdminBirthdayPdfGuard /><Routes><Route path="/" element={<RootRoute />} /><Route path="/auth" element={location.search.includes('company=') ? <CompanyBrandGate>{authContent}</CompanyBrandGate> : authContent} /><Route path="/select-company" element={<PublicRoute><SelectCompany /></PublicRoute>} /><Route path="/birthday-report" element={<BirthdayShare />} /><Route path="*" element={<RootRoute />} /></Routes></Suspense></>; }
function AppShell() { return <AuthProvider><CompanyProvider><FloatingNoteProvider><AppRoutes /></FloatingNoteProvider></CompanyProvider></AuthProvider>; }
const App = () => (<QueryClientProvider client={queryClient}><TooltipProvider><Toaster /><Sonner /><BrowserRouter><AppShell /></BrowserRouter></TooltipProvider></QueryClientProvider>);
export default App;
