import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import LoginPage from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Artworks from "@/pages/artworks";
import Contacts from "@/pages/contacts";
import Pipeline from "@/pages/pipeline";
import Exhibitions from "@/pages/exhibitions";
import Activities from "@/pages/activities";
import Followups from "@/pages/followups";
import SalesHistory from "@/pages/sales-history";
import NotFound from "@/pages/not-found";


function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/artworks" component={Artworks} />
      <Route path="/contacts" component={Contacts} />
      <Route path="/pipeline" component={Pipeline} />
      <Route path="/exhibitions" component={Exhibitions} />
      <Route path="/followups" component={Followups} />
      <Route path="/sales-history" component={SalesHistory} />
      <Route path="/activities" component={Activities} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <Router hook={useHashLocation}>
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full overflow-hidden">
          <AppSidebar />
          <div className="flex flex-col flex-1 min-w-0">
            <header className="flex items-center justify-between gap-2 px-4 py-2.5 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-20">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <ThemeToggle />
            </header>
            <main className="flex-1 overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
              <AppRouter />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </Router>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AuthenticatedApp />
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
