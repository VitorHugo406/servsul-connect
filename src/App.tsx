import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { FloatingNoteProvider } from "@/contexts/FloatingNoteContext";
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const SelectCompany = lazy(() => import("./pages/SelectCompany"));
const BirthdayShare = lazy(() => import("./pages/BirthdayShare"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();
function LoadingScreen() { return <div className="flex min-h-screen items-center justify-center bg-background"><div className="flex flex-col items-center gap-4"><div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" /><p className="text-muted-foreground">Carregando...</p></div></div>; }
function ProtectedRoute({ children }: { children: React.ReactNode }) { const { user, loading, verifying } = useAuth(); if (loading || verifying) return <LoadingScreen />; if (!user) return <Navigate to="/select-company" replace />; return <>{children}</>; }
function PublicRoute({ children }: { children: React.ReactNode }) { const { user, loading, verifying } = useAuth(); if (loading) return <LoadingScreen />; if (user && !verifying) return <Navigate to="/" replace />; return <>{children}</>; }
function AppRoutes() { return <Suspense fallback={<LoadingScreen />}><Routes><Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} /><Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} /><Route path="/select-company" element={<PublicRoute><SelectCompany /></PublicRoute>} /><Route path="/birthday-report" element={<BirthdayShare />} /><Route path="*" element={<NotFound />} /></Routes></Suspense>; }
const App = () => (<QueryClientProvider client={queryClient}><TooltipProvider><Toaster /><Sonner /><BrowserRouter><AuthProvider><CompanyProvider><FloatingNoteProvider><AppRoutes /></FloatingNoteProvider></CompanyProvider></AuthProvider></BrowserRouter></TooltipProvider></QueryClientProvider>);
export default App;
