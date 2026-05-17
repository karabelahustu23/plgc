import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "next-themes";
import { Layout } from "@/components/Layout";
import { useEffect } from "react";
import "@/lib/i18n";

import Login from "@/pages/login";
import Onboarding from "@/pages/onboarding";
import Home from "@/pages/home";
import Store from "@/pages/store";
import MyEsims from "@/pages/my-esims";
import Family from "@/pages/family";
import Wallet from "@/pages/wallet";
import Referral from "@/pages/referral";
import Support from "@/pages/support";
import Admin from "@/pages/admin";
import Profile from "@/pages/profile";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, adminOnly = false }: { component: any, adminOnly?: boolean }) {
  const { user, profile, loading } = useAuth();
  const [_, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/login");
    } else if (!loading && adminOnly && profile?.role !== "admin") {
      setLocation("/");
    }
  }, [user, loading, setLocation, adminOnly, profile]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse h-8 w-8 rounded-full bg-primary" /></div>;
  }

  if (!user) return null;
  if (adminOnly && profile?.role !== "admin") return null;

  return <Component />;
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/" component={() => <ProtectedRoute component={Home} />} />
        <Route path="/store/:locationCode" component={() => <ProtectedRoute component={Store} />} />
        <Route path="/my-esims" component={() => <ProtectedRoute component={MyEsims} />} />
        <Route path="/family" component={() => <ProtectedRoute component={Family} />} />
        <Route path="/wallet" component={() => <ProtectedRoute component={Wallet} />} />
        <Route path="/referral" component={() => <ProtectedRoute component={Referral} />} />
        <Route path="/support" component={() => <ProtectedRoute component={Support} />} />
        <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />
        <Route path="/admin" component={() => <ProtectedRoute component={Admin} adminOnly />} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
