import { lazy, Suspense, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import ForgotPassword from "./pages/ForgotPassword.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import NotFound from "./pages/NotFound.tsx";
import { isSupabaseConfigured } from "./integrations/supabase/client";
import ConfigurationRequired from "./components/auth/ConfigurationRequired";
import { getLocalPreviewUser, isLocalPreviewAuthEnabled } from "./lib/localAuth";

const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const FlowDetail = lazy(() => import("./pages/FlowDetail.tsx"));
const Alerts = lazy(() => import("./pages/Alerts.tsx"));
const Analytics = lazy(() => import("./pages/Analytics.tsx"));
const Investors = lazy(() => import("./pages/Investors.tsx"));
const Docs = lazy(() => import("./pages/Docs.tsx"));
const Setup = lazy(() => import("./pages/Setup.tsx"));
const Demo = lazy(() => import("./pages/Demo.tsx"));
const DemoDashboard = lazy(() => import("./pages/DemoDashboard.tsx"));
const CommandCenter = lazy(() => import("./pages/CommandCenter.tsx"));
const LocalPreviewDashboard = lazy(() => import("./pages/LocalPreviewDashboard.tsx"));
const LocalPreviewAnalytics = lazy(() => import("./pages/LocalPreviewAnalytics.tsx"));
const SampleFlowDetail = lazy(() => import("./pages/SampleFlowDetail.tsx"));
const SampleSpending = lazy(() => import("./pages/SampleSpending.tsx"));

const queryClient = new QueryClient();

const AuthenticatedRoute = ({ children }: { children: ReactNode }) => {
  if (isSupabaseConfigured) return <>{children}</>;
  if (isLocalPreviewAuthEnabled && getLocalPreviewUser()) return <>{children}</>;
  if (isLocalPreviewAuthEnabled) return <Navigate to="/login" replace />;
  return <ConfigurationRequired />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/demo" element={<DemoDashboard />} />
            <Route path="/demo/spending" element={<SampleSpending mode="demo" />} />
            <Route path="/demo/management" element={<CommandCenter />} />
            <Route path="/demo/replay" element={<Demo />} />
            <Route path="/demo/flows/:id" element={<SampleFlowDetail mode="demo" />} />
            <Route path="/command-center" element={<AuthenticatedRoute><CommandCenter /></AuthenticatedRoute>} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<AuthenticatedRoute>{isSupabaseConfigured ? <Dashboard /> : <LocalPreviewDashboard />}</AuthenticatedRoute>} />
            <Route path="/flows/:id" element={<AuthenticatedRoute>{isSupabaseConfigured ? <FlowDetail /> : <SampleFlowDetail mode="preview" />}</AuthenticatedRoute>} />
            <Route path="/alerts" element={<AuthenticatedRoute><Alerts /></AuthenticatedRoute>} />
            <Route path="/analytics" element={<AuthenticatedRoute>{isSupabaseConfigured ? <Analytics /> : <LocalPreviewAnalytics />}</AuthenticatedRoute>} />
            <Route path="/investors" element={<Investors />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/setup" element={<AuthenticatedRoute><Setup /></AuthenticatedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
