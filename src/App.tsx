import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { FloatingChatWidget } from "./components/ai/FloatingChatWidget";
import "./App.css";
import Navbar from "./components/Navbar";
import ScrollToTop from "./components/ScrollToTop";
import RouteTransition from "./components/RouteTransition";
import SkipToContent from "./components/SkipToContent";
import { Toaster } from "./components/ui/sonner";
import { ChatProvider } from "./contexts/ChatContext";
import { ThemeProvider } from 'next-themes';
import { DeploymentProvider } from "./contexts/DeploymentContext";
import { APIProvider } from "./contexts/APIContext";
import { AGUIProvider } from "./contexts/agui/AGUIContext";
import { Analytics } from "@vercel/analytics/react";

// Critical path — loaded eagerly (needed on first paint)
import Index from "./pages/Index";
import AdminRoute from "./components/auth/AdminRoute";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// All other pages are lazy-loaded to reduce the initial bundle
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
const OperatorCommandCenter = lazy(() => import("./pages/OperatorCommandCenter"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));

const PageLoader = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
    <span style={{ color: "#888", fontSize: "14px" }}>Loading...</span>
  </div>
);

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <DeploymentProvider>
        <APIProvider>
          <ChatProvider>
            <AGUIProvider>
              <Router>
                <ScrollToTop />
                <SkipToContent />
                <Navbar />
                <main id="main-content" tabIndex={-1} className="min-h-screen pt-16 focus:outline-none">
                  <Suspense fallback={<PageLoader />}>
                    <RouteTransition>
                      <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/login" element={<Login />} />
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
                        <Route path="/about" element={<About />} />
                        <Route path="/contact" element={<Contact />} />
                        <Route path="/terms" element={<Terms />} />
                        <Route path="/privacy" element={<Privacy />} />
                        <Route path="/privacy-policy" element={<Privacy />} />
                        <Route path="/chat" element={<ChatPage />} />
                        <Route path="/admin" element={<AdminPage />} />
                        <Route
                          path="/occ"
                          element={
                            <AdminRoute>
                              <OperatorCommandCenter />
                            </AdminRoute>
                          }
                        />
                        <Route path="/unauthorized" element={<Unauthorized />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </RouteTransition>
                  </Suspense>
                </main>
                <FloatingChatWidget />
              </Router>
              <Toaster />
              <Analytics />
            </AGUIProvider>
          </ChatProvider>
        </APIProvider>
      </DeploymentProvider>
    </ThemeProvider>
  );
}

export default App;
