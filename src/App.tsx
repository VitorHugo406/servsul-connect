import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { FloatingNoteProvider } from "@/contexts/FloatingNoteContext";
import { NotificationsProvider } from "@/hooks/useNotifications";
import { supabase } from "@/integrations/supabase/client";
import { applyBrand, getCachedBrand } from "@/lib/branding";
import { AdminBirthdayPdfGuard } from "@/components/birthday/AdminBirthdayPdfGuard";

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
const validAppSections = new Set([
  'my-dashboard', 'chat', 'announcements', 'birthdays', 'management',
  'shortcuts', 'facial', 'data-management', 'sectors', 'important-announcements',
  'tasks', 'people-management', 'feedback-email', 'calendar', 'system-logs',
  'storage', 'event-history', 'documentation', 'war-room', 'api-management',
  'evaluations', 'notes', 'companies', 'system-broadcasts',
]);

function RootRoute() {
  const location = useLocation();
  const section = location.pathname.split('/').filter(Boolean)[0];
  const isKnownRoute = !section || validAppSections.has(section);
  const { user, loading, verifying } = useAuth();
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  if (!isKnownRoute) return <NotFound />;
  if (loading || verifying) return <LoadingScreen message="Preparando seu ambiente..." />;
  if (user) return <Index />;
  return isMobile ? <Auth /> : <LandingPage />;
}
function AppRoutes() { const location = useLocation(); const authContent = <PublicRoute><Auth /></PublicRoute>; return <Suspense fallback={<LoadingScreen />}><AdminBirthdayPdfGuard /><Routes><Route path="/" element={<RootRoute />} /><Route path="/:section" element={<RootRoute />} /><Route path="/:section/*" element={<RootRoute />} /><Route path="/auth" element={location.search.includes('company=') ? <CompanyBrandGate>{authContent}</CompanyBrandGate> : authContent} /><Route path="/select-company" element={<PublicRoute><SelectCompany /></PublicRoute>} /><Route path="/birthday-report" element={<BirthdayShare />} /><Route path="*" element={<NotFound />} /></Routes></Suspense>; }
function AppShell() { return <AuthProvider><NotificationsProvider><CompanyProvider><FloatingNoteProvider><AppRoutes /></FloatingNoteProvider></CompanyProvider></NotificationsProvider></AuthProvider>; }
const App = () => (<QueryClientProvider client={queryClient}><TooltipProvider><Toaster /><Sonner /><BrowserRouter><AppShell /></BrowserRouter></TooltipProvider></QueryClientProvider>);
export default App;
