import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import "./App.css";
import ScrollToTop from "./components/ScrollToTop";
import SkipToContent from "./components/SkipToContent";
import AuthenticatedRoute from "./components/auth/AuthenticatedRoute";
import AdminRoute from "./components/auth/AdminRoute";
import { ThemeProvider } from 'next-themes';
import { startRumCollection } from './lib/assurance/rum';

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const FloatingChatWidget = lazy(() =>
  import("./components/ai/FloatingChatWidget").then(m => ({ default: m.FloatingChatWidget }))
);
const Navbar = lazy(() => import("./components/Navbar"));
const ChatProvider = lazy(() => import("./contexts/ChatContext").then(m => ({ default: m.ChatProvider })));
const DeploymentProvider = lazy(() => import("./contexts/DeploymentContext").then(m => ({ default: m.DeploymentProvider })));
const APIProvider = lazy(() => import("./contexts/APIContext").then(m => ({ default: m.APIProvider })));
const AGUIProvider = lazy(() => import("./contexts/agui/AGUIContext").then(m => ({ default: m.AGUIProvider })));
const Toaster = lazy(() => import("./components/ui/sonner").then(m => ({ default: m.Toaster })));
const Analytics = lazy(() => import("@vercel/analytics/react").then(m => ({ default: m.Analytics })));

const Login = lazy(() => import("./pages/Login"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const FilmPage = lazy(() => import("./pages/AIFilms"));
const AIFilmStudio = lazy(() => import("./pages/AIFilmStudio"));
const CommerceStudio = lazy(() => import("./pages/CommerceStudio"));
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
const CommandCenter = lazy(() => import("./pages/CommandCenterRC1"));
const ManifestPage = lazy(() => import("./pages/ManifestPage"));
const GitHubConnectorDiagnostic = lazy(() => import("./pages/GitHubConnectorDiagnostic"));
const ChatPage = lazy(() => import("./pages/Chat"));
const VoiceStudio = lazy(() => import("./pages/VoiceStudio"));
const AdminPage = lazy(() => import("./pages/Admin"));
const DemoControlCenter = lazy(() => import("./pages/DemoControlCenter"));
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
const SecurityDashboard = lazy(() => import("./pages/security/SecurityDashboard"));
const SecurityOps = lazy(() => import("./pages/security/SecurityOps"));
const SecurityCommandCenter = lazy(() => import("./pages/security/CommandCenter"));
const SecretsVault = lazy(() => import("./pages/security/SecretsVault"));
const Pricing = lazy(() => import("./pages/Pricing"));
const ResearchOS = lazy(() => import("./pages/ResearchOS"));
const DkosIngestion = lazy(() => import("./pages/DkosIngestion"));
const PrimetimeRelease1 = lazy(() => import("./pages/PrimetimeRelease1"));
const PrimetimeScheduling = lazy(() => import("./pages/PrimetimeScheduling"));
const PrimetimeCommunications = lazy(() => import("./pages/PrimetimeCommunications"));
const PrimetimeAiAssistance = lazy(() => import("./pages/PrimetimeAiAssistance"));
const PrimetimeExecutiveCommandCenter = lazy(() => import("./pages/PrimetimeExecutiveCommandCenter"));
const PrimetimeObservability = lazy(() => import("./pages/PrimetimeObservability"));
const PrimetimeAgentOsCanary = lazy(() => import("./pages/PrimetimeAgentOsCanary"));
const AssuranceConsole = lazy(() => import("./pages/AssuranceConsole"));
const SecurityDisclosure = lazy(() => import("./pages/SecurityDisclosure"));
const EnterpriseReadiness = lazy(() => import("./pages/EnterpriseReadiness"));
const MileHighGoldenElevation = lazy(() => import("./pages/MileHighGoldenElevation"));

const AdminRouteWrapper = lazy(() =>
  import("./components/auth/AdminRoute").then(mod => {
    const AdminRoute = mod.default;
    return import("./pages/OperatorCommandCenterRC1").then(occMod => ({
      default: () => <AdminRoute><occMod.default /></AdminRoute>
    }));
  })
);

const PageLoader = () => (
  <div className="d3-ai-loader" role="status" aria-live="polite" aria-label="D3VONN.IO is preparing your workspace">
    <div className="d3-ai-loader__core">
      <div className="d3-ai-loader__ring" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold tracking-wide text-white">Preparing workspace</p>
        <p className="mt-1 text-xs text-blue-100/60">Connecting systems and loading intelligence</p>
      </div>
    </div>
  </div>
);

function CanonicalPathFallback() {
  const location = useLocation();
  const rawPathname = window.location.pathname;

  if (/^\/film(?:%60|`|\s)+$/i.test(rawPathname)) {
    return <Navigate to={{ pathname: "/film", search: location.search, hash: location.hash }} replace />;
  }

  return <NotFound />;
}

function LegacyFilmPathRepair() {
  const location = useLocation();

  useEffect(() => {
    if (/^\/film(?:%60|`|\s)+$/i.test(window.location.pathname)) {
      window.location.replace(`/film${location.search}${location.hash}`);
    }
  }, [location.hash, location.pathname, location.search]);

  return null;
}

function DeferredProviders({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
            <AGUIProvider>{children}</AGUIProvider>
          </ChatProvider>
        </APIProvider>
      </DeploymentProvider>
    </Suspense>
  );
}

function App() {
  useEffect(() => { startRumCollection(); }, []);
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <Router>
        <ScrollToTop />
        <LegacyFilmPathRepair />
        <SkipToContent />
        <Suspense fallback={null}><Navbar /></Suspense>
        <DeferredProviders>
          <main id="main-content" tabIndex={-1} className="min-h-screen pt-16 focus:outline-none">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/mile-high-golden-elevation" element={<MileHighGoldenElevation />} />
                <Route path="/login" element={<Login />} />
                <Route path="/auth" element={<AuthCallback />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/auth/confirm" element={<AuthCallback />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/film" element={<FilmPage />} />
                <Route path="/ai-films" element={<FilmPage />} />
                <Route path="/ai-films/studio" element={<AuthenticatedRoute><AIFilmStudio /></AuthenticatedRoute>} />
                <Route path="/ai-films/commerce" element={<AuthenticatedRoute><CommerceStudio /></AuthenticatedRoute>} />
                <Route path="/deployment" element={<DeploymentDashboard />} />
                <Route path="/api" element={<APIManagement />} />
                <Route path="/documentation" element={<Documentation />} />
                <Route path="/agents" element={<AgentDashboard />} />
                <Route path="/ai-workforce" element={<AgentDashboard />} />
                <Route path="/devonn" element={<DevonnDashboard />} />
                <Route path="/flow" element={<FlowEditor />} />
                <Route path="/workflows" element={<WorkflowManagement />} />
                <Route path="/agent-demo" element={<AgentDemo />} />
                <Route path="/enhanced-agents" element={<EnhancedAgentDemo />} />
                <Route path="/marketplace" element={<AgentMarketplace />} />
                <Route path="/mcp" element={<AuthenticatedRoute><McpPage /></AuthenticatedRoute>} />
                <Route path="/status" element={<StatusDashboard />} />
                <Route path="/manifest" element={<ManifestPage />} />
                <Route path="/github-diagnostic" element={<GitHubConnectorDiagnostic />} />
                <Route path="/command-center" element={<CommandCenter />} />
                <Route path="/operations" element={<CommandCenter />} />
                <Route path="/dkos-ingestion" element={<DkosIngestion />} />
                <Route path="/knowledge-ingestion" element={<DkosIngestion />} />
                <Route path="/primetime" element={<PrimetimeRelease1 />} />
                <Route path="/primetime/release-1" element={<PrimetimeRelease1 />} />
                <Route path="/primetime/scheduling" element={<PrimetimeScheduling />} />
                <Route path="/primetime/release-2" element={<PrimetimeScheduling />} />
                <Route path="/primetime/communications" element={<PrimetimeCommunications />} />
                <Route path="/primetime/release-3" element={<PrimetimeCommunications />} />
                <Route path="/primetime/ai-assistance" element={<PrimetimeAiAssistance />} />
                <Route path="/primetime/release-4" element={<PrimetimeAiAssistance />} />
                <Route path="/primetime/executive-command-center" element={<PrimetimeExecutiveCommandCenter />} />
                <Route path="/primetime/release-5" element={<PrimetimeExecutiveCommandCenter />} />
                <Route path="/primetime/observability" element={<AuthenticatedRoute><PrimetimeObservability /></AuthenticatedRoute>} />
                <Route path="/primetime/release-7" element={<AuthenticatedRoute><PrimetimeObservability /></AuthenticatedRoute>} />
                <Route path="/primetime/agent-os-canary" element={<AuthenticatedRoute><PrimetimeAgentOsCanary /></AuthenticatedRoute>} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/privacy-policy" element={<Privacy />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/voice-studio" element={<VoiceStudio />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/demo-control" element={<AdminRoute><DemoControlCenter /></AdminRoute>} />
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
                <Route path="/app" element={<AuthenticatedRoute><LaunchApp /></AuthenticatedRoute>} />
                <Route path="/ai-agents" element={<AIAgents />} />
                <Route path="/business-automation" element={<BusinessAutomation />} />
                <Route path="/solutions" element={<Solutions />} />
                <Route path="/resources" element={<Resources />} />
                <Route path="/security" element={<Security />} />
                <Route path="/security/disclosure" element={<SecurityDisclosure />} />
                <Route path="/enterprise" element={<Security />} />
                <Route path="/enterprise-readiness" element={<EnterpriseReadiness />} />
                <Route path="/assurance" element={<AdminRoute><AssuranceConsole /></AdminRoute>} />
                <Route path="/security/ops" element={<SecurityOps />} />
                <Route path="/security/dashboard" element={<SecurityDashboard />} />
                <Route path="/security/command-center" element={<SecurityCommandCenter />} />
                <Route path="/security/secrets" element={<AdminRoute><SecretsVault /></AdminRoute>} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/research-os" element={<ResearchOS />} />
                <Route path="/analytics" element={<Navigate to="/app" replace />} />
                <Route path="/rag" element={<Navigate to="/dkos-ingestion" replace />} />
                <Route path="/platform" element={<Navigate to="/#platform" replace />} />
                <Route path="/signin" element={<Navigate to="/login" replace />} />
                <Route path="/sign-in" element={<Navigate to="/login" replace />} />
                <Route path="/log-in" element={<Navigate to="/login" replace />} />
                <Route path="/signup" element={<Navigate to="/login" replace />} />
                <Route path="/sign-up" element={<Navigate to="/login" replace />} />
                <Route path="*" element={<CanonicalPathFallback />} />
              </Routes>
            </Suspense>
          </main>
          <Suspense fallback={null}><FloatingChatWidget /></Suspense>
        </DeferredProviders>
        <Suspense fallback={null}><Toaster /><Analytics /></Suspense>
      </Router>
    </ThemeProvider>
  );
}

export default App;
