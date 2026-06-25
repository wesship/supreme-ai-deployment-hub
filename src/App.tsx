import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
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
import ProtectedRoute from "./components/auth/ProtectedRoute";
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
const MoneyHub = lazy(() => import("./pages/MoneyHub"));
const AITherapy = lazy(() => import("./pages/AITherapy"));
const SovereigntyMatrix = lazy(() => import("./pages/SovereigntyMatrix"));
const Music = lazy(() => import("./pages/Music"));
const Backtesting = lazy(() => import("./pages/Backtesting"));
const JetsonControl = lazy(() => import("./pages/JetsonControl"));
const LaunchApp = lazy(() => import("./pages/LaunchApp"));
const AIAgents = lazy(() => import("./pages/AIAgents"));
const BusinessAutomation = lazy(() => import("./pages/BusinessAutomation"));

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
                        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                        <Route path="/film" element={<ProtectedRoute><FilmPage /></ProtectedRoute>} />
                        <Route path="/deployment" element={<ProtectedRoute><DeploymentDashboard /></ProtectedRoute>} />
                        <Route path="/api" element={<ProtectedRoute><APIManagement /></ProtectedRoute>} />
                        <Route path="/documentation" element={<Documentation />} />
                        <Route path="/agents" element={<ProtectedRoute><AgentDashboard /></ProtectedRoute>} />
                        <Route path="/devonn" element={<ProtectedRoute><DevonnDashboard /></ProtectedRoute>} />
                        <Route path="/flow" element={<ProtectedRoute><FlowEditor /></ProtectedRoute>} />
                        <Route path="/workflows" element={<ProtectedRoute><WorkflowManagement /></ProtectedRoute>} />
                        <Route path="/agent-demo" element={<ProtectedRoute><AgentDemo /></ProtectedRoute>} />
                        <Route path="/enhanced-agents" element={<ProtectedRoute><EnhancedAgentDemo /></ProtectedRoute>} />
                        <Route path="/marketplace" element={<ProtectedRoute><AgentMarketplace /></ProtectedRoute>} />
                        <Route path="/mcp" element={<ProtectedRoute><McpPage /></ProtectedRoute>} />
                        <Route path="/status" element={<ProtectedRoute><StatusDashboard /></ProtectedRoute>} />
                        <Route path="/manifest" element={<ProtectedRoute><ManifestPage /></ProtectedRoute>} />
                        <Route path="/github-diagnostic" element={<ProtectedRoute><GitHubConnectorDiagnostic /></ProtectedRoute>} />
                        <Route path="/command-center" element={<ProtectedRoute><CommandCenter /></ProtectedRoute>} />
                        <Route path="/about" element={<About />} />
                        <Route path="/contact" element={<Contact />} />
                        <Route path="/terms" element={<Terms />} />
                        <Route path="/privacy" element={<Privacy />} />
                        <Route path="/privacy-policy" element={<Privacy />} />
                        <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
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
                        <Route path="/moneyhub" element={<ProtectedRoute><MoneyHub /></ProtectedRoute>} />
                        <Route path="/ai-therapy" element={<ProtectedRoute><AITherapy /></ProtectedRoute>} />
                        <Route path="/therapy" element={<ProtectedRoute><AITherapy /></ProtectedRoute>} />
                        <Route path="/sovereignty" element={<ProtectedRoute><SovereigntyMatrix /></ProtectedRoute>} />
                        <Route path="/sovereignty-matrix" element={<ProtectedRoute><SovereigntyMatrix /></ProtectedRoute>} />
                        <Route path="/music" element={<ProtectedRoute><Music /></ProtectedRoute>} />
                        <Route path="/backtesting" element={<ProtectedRoute><Backtesting /></ProtectedRoute>} />
                        <Route path="/jetson" element={<ProtectedRoute><JetsonControl /></ProtectedRoute>} />
                        <Route path="/jetson-control" element={<ProtectedRoute><JetsonControl /></ProtectedRoute>} />
                        <Route path="/app" element={<ProtectedRoute><LaunchApp /></ProtectedRoute>} />
                        <Route path="/ai-agents" element={<AIAgents />} />
                        <Route path="/business-automation" element={<BusinessAutomation />} />
                        <Route path="/platform" element={<Navigate to="/#platform" replace />} />
                        <Route path="/signin" element={<Navigate to="/login" replace />} />
                        <Route path="/signup" element={<Navigate to="/login" replace />} />
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
