import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import ScrollToTop from "./components/ScrollToTop";
import SkipToContent from "./components/SkipToContent";
import { ThemeProvider } from 'next-themes';

// Critical path — loaded eagerly (needed on first paint)
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Lazy-load the floating chat widget (heavy: imports supabase, AI orchestrator, voice)
const FloatingChatWidget = lazy(() =>
  import("./components/ai/FloatingChatWidget").then(m => ({ default: m.FloatingChatWidget }))
);

// Lazy-load the Navbar (it imports supabase for auth state)
const Navbar = lazy(() => import("./components/Navbar"));

// Lazy-load context providers — they pull in axios, supabase, encryption, etc.
const ChatProvider = lazy(() =>
  import("./contexts/ChatContext").then(m => ({ default: m.ChatProvider }))
);
const DeploymentProvider = lazy(() =>
  import("./contexts/DeploymentContext").then(m => ({ default: m.DeploymentProvider }))
);
const APIProvider = lazy(() =>
  import("./contexts/APIContext").then(m => ({ default: m.APIProvider }))
);
const AGUIProvider = lazy(() =>
  import("./contexts/agui/AGUIContext").then(m => ({ default: m.AGUIProvider }))
);

// Lazy-load non-critical UI
const Toaster = lazy(() =>
  import("./components/ui/sonner").then(m => ({ default: m.Toaster }))
);

// Lazy-load Vercel Analytics (non-critical)
const Analytics = lazy(() =>
  import("@vercel/analytics/react").then(m => ({ default: m.Analytics }))
);

// All other pages are lazy-loaded to reduce the initial bundle
const Login = lazy(() => import("./pages/Login"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const FilmPage = lazy(() => import("./pages/Film"));
const WorkflowManagement = lazy(() => import("./pages/WorkflowManagement"));
const DeploymentDashboard = lazy(() => import("./pages/DeploymentDashboard"));
const APIManagement = lazy(() => import("./pages/APIManagement"));
const Documentation = lazy(() => import("./pages/Documentation"));
const DevonnDashboard = lazy(() => import("./pages/DevonnDashboard"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const AgentDashboard = lazy(() => import("./pages/AgentDashboard"));
const FlowEditor = lazy(() => import("./pages/FlowEditor"));
const AgentDemo = lazy(() => import("./pages/AgentDemo"));
const EnhancedAgentDemo = lazy(() => import("./pages/EnhancedAgentDemo"));
const AgentMarketplace = lazy(() => import("./pages/AgentMarketplace"));
const McpPage = lazy(() => import("./pages/McpPage"));
const StatusDashboard = lazy(() => import("./pages/StatusDashboard"));
const CommandCenter = lazy(() => import("./pages/CommandCenter"));
const ManifestPage = lazy(() => import("./pages/ManifestPage"));
const GitHubConnectorDiagnostic = lazy(() => import("./pages/GitHubConnectorDiagnostic"));
const ChatPage = lazy(() => import("./pages/Chat"));
const AdminPage = lazy(() => import("./pages/Admin"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));
const MoneyHub = lazy(() => import("./pages/MoneyHub"));
const AITherapy = lazy(() => import("./pages/AITherapy"));
const SovereigntyMatrix = lazy(() => import("./pages/SovereigntyMatrix"));
const Music = lazy(() => import("./pages/Music"));
const Backtesting = lazy(() => import("./pages/Backtesting"));
const JetsonControl = lazy(() => import("./pages/JetsonControl"));
const LaunchApp = lazy(() => import("./pages/LaunchApp"));
const AIAgents = lazy(() => import("./pages/AIAgents"));
const BusinessAutomation = lazy(() => import("./pages/BusinessAutomation"));
const Solutions = lazy(() => import("./pages/Solutions"));
const Resources = lazy(() => import("./pages/Resources"));
const Security = lazy(() => import("./pages/Security"));
const Pricing = lazy(() => import("./pages/Pricing"));
const ResearchOS = lazy(() => import("./pages/ResearchOS"));
const DkosIngestion = lazy(() => import("./pages/DkosIngestion"));
const GrowthPlaybook = lazy(() => import("./pages/GrowthPlaybook"));

// Wrapper for AdminRoute since lazy components can't directly accept children as JSX
const AdminRouteWrapper = lazy(() =>
  import("./components/auth/AdminRoute").then(mod => {
    const AdminRoute = mod.default;
    return import("./pages/OperatorCommandCenter").then(occMod => ({
      default: () => <AdminRoute><occMod.default /></AdminRoute>
    }));
  })
);

const PageLoader = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
    <span style={{ color: "#888", fontSize: "14px" }}>Loading...</span>
  </div>
);

/**
 * DeferredProviders — wraps children in context providers but only mounts them
 * after the initial paint (via idle callback) to avoid blocking FCP/LCP.
 */
function DeferredProviders({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Use requestIdleCallback if available, otherwise setTimeout
    const id = ('requestIdleCallback' in window)
      ? (window as any).requestIdleCallback(() => setReady(true))
      : setTimeout(() => setReady(true), 50);
    return () => {
      if ('cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(id);
      } else {
        clearTimeout(id);
      }
    };
  }, []);

  if (!ready) return <>{children}</>;

  return (
    <Suspense fallback={<>{children}</>}>
      <DeploymentProvider>
        <APIProvider>
          <ChatProvider>
            <AGUIProvider>
              {children}
            </AGUIProvider>
          </ChatProvider>
        </APIProvider>
      </DeploymentProvider>
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <Router>
        <ScrollToTop />
        <SkipToContent />
        <Suspense fallback={null}>
          <Navbar />
        </Suspense>
        <DeferredProviders>
          <main id="main-content" tabIndex={-1} className="min-h-screen pt-16 focus:outline-none">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/auth" element={<AuthCallback />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/auth/confirm" element={<AuthCallback />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/film" element={<FilmPage />} />
                <Route path="/deployment" element={<DeploymentDashboard />} />
                <Route path="/api" element={<APIManagement />} />
                <Route path="/documentation" element={<Documentation />} />
                <Route path="/agents" element={<AgentDashboard />} />
                <Route path="/devonn" element={<DevonnDashboard />} />
                <Route path="/flow" element={<FlowEditor />} />
                <Route path="/workflows" element={<WorkflowManagement />} />
                <Route path="/agent-demo" element={<AgentDemo />} />
                <Route path="/enhanced-agents" element={<EnhancedAgentDemo />} />
                <Route path="/marketplace" element={<AgentMarketplace />} />
                <Route path="/mcp" element={<McpPage />} />
                <Route path="/status" element={<StatusDashboard />} />
                <Route path="/manifest" element={<ManifestPage />} />
                <Route path="/github-diagnostic" element={<GitHubConnectorDiagnostic />} />
                <Route path="/command-center" element={<CommandCenter />} />
                <Route path="/dkos-ingestion" element={<DkosIngestion />} />
                <Route path="/knowledge-ingestion" element={<DkosIngestion />} />
                <Route path="/growth" element={<GrowthPlaybook />} />
                <Route path="/growth-playbook" element={<GrowthPlaybook />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/privacy-policy" element={<Privacy />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/occ" element={<AdminRouteWrapper />} />
                <Route path="/unauthorized" element={<Unauthorized />} />
                <Route path="/moneyhub" element={<MoneyHub />} />
                <Route path="/ai-therapy" element={<AITherapy />} />
                <Route path="/therapy" element={<AITherapy />} />
                <Route path="/sovereignty" element={<SovereigntyMatrix />} />
                <Route path="/sovereignty-matrix" element={<SovereigntyMatrix />} />
                <Route path="/music" element={<Music />} />
                <Route path="/backtesting" element={<Backtesting />} />
                <Route path="/jetson" element={<JetsonControl />} />
                <Route path="/jetson-control" element={<JetsonControl />} />
                <Route path="/app" element={<LaunchApp />} />
                <Route path="/ai-agents" element={<AIAgents />} />
                <Route path="/business-automation" element={<BusinessAutomation />} />
                <Route path="/solutions" element={<Solutions />} />
                <Route path="/resources" element={<Resources />} />
                <Route path="/security" element={<Security />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/research-os" element={<ResearchOS />} />
                <Route path="/platform" element={<Navigate to="/#platform" replace />} />
                <Route path="/signin" element={<Navigate to="/login" replace />} />
                <Route path="/sign-in" element={<Navigate to="/login" replace />} />
                <Route path="/log-in" element={<Navigate to="/login" replace />} />
                <Route path="/signup" element={<Navigate to="/login" replace />} />
                <Route path="/sign-up" element={<Navigate to="/login" replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </main>
          <Suspense fallback={null}>
            <FloatingChatWidget />
          </Suspense>
        </DeferredProviders>
        <Suspense fallback={null}>
          <Toaster />
          <Analytics />
        </Suspense>
      </Router>
    </ThemeProvider>
  );
}

export default App;
