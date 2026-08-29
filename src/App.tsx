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

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const SelectCompany = lazy(() => import("./pages/SelectCompany"));
const BirthdayShare = lazy(() => import("./pages/BirthdayShare"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();
function LoadingScreen({ message = 'Carregando ambiente da empresa...' }: { message?: string }) { return <div className="flex min-h-screen items-center justify-center bg-white dark:bg-slate-950"><div className="flex flex-col items-center gap-4"><div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-400 dark:border-slate-800 dark:border-t-slate-500"/><p className="text-sm text-slate-500 dark:text-slate-400">{message}</p></div></div>; }
function CompanyBrandGate({ children }: { children: React.ReactNode }) {
  const [searchParams] = useSearchParams(); const companySlug = searchParams.get('company'); const [ready, setReady] = useState(false);
  useEffect(() => { let cancelled = false; const load = async () => { if (!companySlug) { setReady(true); return; } const cached = getCachedBrand(); let cachedForSlug: any = null; try { const raw = localStorage.getItem(`nuvexa:public-company:${companySlug.toLowerCase()}`); if (raw) cachedForSlug = JSON.parse(raw); } catch {} if (cachedForSlug?.primary_color && cachedForSlug?.secondary_color) applyBrand(cachedForSlug); else if (cached?.slug === companySlug && cached?.primary_color && cached?.secondary_color) applyBrand(cached); try { const { data, error } = await (supabase as any).rpc('public_get_company_by_slug', { _slug: companySlug }); const row = Array.isArray(data) ? data[0] : data; if (cancelled) return; if (!error && row?.primary_color && row?.secondary_color) { applyBrand(row); try { localStorage.setItem(`nuvexa:public-company:${companySlug.toLowerCase()}`, JSON.stringify(row)); localStorage.setItem('nuvexa:last-company', JSON.stringify(row)); } catch {} setReady(true); } else if (cachedForSlug?.primary_color && cachedForSlug?.secondary_color) setReady(true); else setReady(false); } catch { if (!cancelled && cachedForSlug?.primary_color && cachedForSlug?.secondary_color) setReady(true); } }; void load(); return () => { cancelled = true; }; }, [companySlug]);
  if (!ready) return <LoadingScreen />; return <>{children}</>;
}
function ProtectedRoute({ children }: { children: React.ReactNode }) { const { user, loading, verifying } = useAuth(); if (loading || verifying) return <LoadingScreen />; if (!user) return <Navigate to="/select-company" replace />; return <>{children}</>; }
function PublicRoute({ children }: { children: React.ReactNode }) { const { user, loading, verifying } = useAuth(); if (loading) return <LoadingScreen message="Verificando acesso..." />; if (user && !verifying) return <Navigate to="/" replace />; return <>{children}</>; }
function AppRoutes() { const location = useLocation(); const authContent = <PublicRoute><Auth /></PublicRoute>; return <Suspense fallback={<LoadingScreen />}><AdminBirthdayPdfGuard /><Routes><Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} /><Route path="/auth" element={location.search.includes('company=') ? <CompanyBrandGate>{authContent}</CompanyBrandGate> : authContent} /><Route path="/select-company" element={<PublicRoute><SelectCompany /></PublicRoute>} /><Route path="/birthday-report" element={<BirthdayShare />} /><Route path="*" element={<NotFound />} /></Routes></Suspense>; }
const App = () => (<QueryClientProvider client={queryClient}><TooltipProvider><Toaster /><Sonner /><BrowserRouter><AuthProvider><CompanyProvider><FloatingNoteProvider><AppRoutes /></FloatingNoteProvider></CompanyProvider></AuthProvider></BrowserRouter></TooltipProvider></QueryClientProvider>);
export default App;
