import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navbar from "@/components/navbar";
import AdvancedChatbot from "@/components/advanced-chatbot";
import Footer from "@/components/footer";
import Welcome from "@/pages/welcome";
import Dashboard from "@/pages/dashboard";
import IotAnalysisPage from "@/pages/iot-analysis";
import SafetyPage from "@/pages/safety";
import ExportPage from "@/pages/export";
import MedicineSearch from "@/pages/medicine-search";
import HistoryPage from "@/pages/history";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Welcome} />
      <Route path="/analyze" component={Dashboard} />
      <Route path="/medicine-search" component={MedicineSearch} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/iot-analysis" component={IotAnalysisPage} />
      <Route path="/safety" component={SafetyPage} />
      <Route path="/export" component={ExportPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="relative min-h-screen overflow-hidden text-foreground">
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 -z-10"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.18),transparent_45%)]" />
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-primary/20 to-transparent" />
            <div className="absolute inset-x-0 top-24 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
          </div>

          <div className="relative z-10 flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1 px-3 pb-16 animate-in fade-in duration-500 md:px-6">
              <Toaster />
              <Router />
            </main>
            <Footer />
          </div>

          <AdvancedChatbot />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
