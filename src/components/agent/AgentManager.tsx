
import React, { useState, useRef, useEffect } from "react";
import { useAgents } from "@/hooks/agents";
import { Task } from "@/types/agent";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, BrainCircuit, Cable, Database, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import CreateAgentTab from "./tabs/CreateAgentTab";
import ManageAgentsTab from "./tabs/ManageAgentsTab";
import WorkflowTab from "./tabs/WorkflowTab";

const AgentManager: React.FC = () => {
  const {
    agents,
    loading,
    generating,
    selectedAgent,
    lastResponse,
    setSelectedAgent,
    generateAgent,
    runAgent,
    refreshAgents,
  } = useAgents();

  const [taskDescription, setTaskDescription] = useState("");
  const [context, setContext] = useState("");
  const [includeContext, setIncludeContext] = useState(false);
  const [userId, setUserId] = useState("user_" + Math.random().toString(36).substring(2, 8));
  const [file, setFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState("create");
  const [yamlDAG, setYamlDAG] = useState(`workflow_name: research_pipeline
steps:
  - agent: ResearchFetcher
    input: "query"
  - agent: Summarizer
    depends_on: ResearchFetcher
  - agent: Formatter
    depends_on: Summarizer`);
  const [dagResponse, setDagResponse] = useState<any>(null);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  // Initialize WebSocket connection for logs
  useEffect(() => {
    try {
      // Get token from localStorage if available
      const token = localStorage.getItem("authToken") || "guest-token";
      
      // Create WebSocket connection
      socketRef.current = new WebSocket(`ws://localhost:8000/ws/logs?token=${token}`);
      
      // Setup message handler
      socketRef.current.onmessage = (event) => {
        setLogMessages(prev => [...prev, event.data]);
      };
      
      // Setup error handler
      socketRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        // Add error message to logs
        setLogMessages(prev => [...prev, `[ERROR] WebSocket connection failed. Real-time logs unavailable.`]);
      };
      
      // Cleanup function
      return () => {
        if (socketRef.current) {
          socketRef.current.close();
        }
      };
    } catch (error) {
      console.error("Failed to initialize WebSocket:", error);
      setLogMessages([`[ERROR] WebSocket initialization failed. Real-time logs unavailable.`]);
    }
  }, []);

  return (
    <div className="mx-auto w-full p-0">
      <div className="flex flex-col gap-6">
        <div className="d3-chrome-panel rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="d3-system-status">Hermes orchestration active</div>
              <h2 className="mt-4 text-2xl font-bold sm:text-3xl">Executive AI Workforce</h2>
              <p className="mt-2 max-w-2xl text-sm text-white/60">Deploy specialized agents, inspect their operational state, and govern execution from one workspace.</p>
            </div>
          <Button variant="outline" onClick={refreshAgents} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh Agents
          </Button>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { label: 'Workforce', value: agents.length, icon: Activity },
              { label: 'Memory', value: 'Connected', icon: BrainCircuit },
              { label: 'Knowledge', value: 'DKOS', icon: Database },
              { label: 'Integrations', value: 'Ready', icon: Cable },
              { label: 'Governance', value: 'Protected', icon: ShieldCheck },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <Icon className="h-4 w-4 text-blue-200" aria-hidden="true" />
                <div className="mt-3 text-sm font-semibold text-white">{value}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/45">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList aria-label="AI workforce sections" className="grid h-auto w-full grid-cols-1 gap-1 rounded-xl bg-black/30 p-1 sm:grid-cols-3">
            <TabsTrigger value="create">Create Agent</TabsTrigger>
            <TabsTrigger value="manage">Manage Agents</TabsTrigger>
            <TabsTrigger value="workflow">DAG Workflow</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="d3-chrome-panel rounded-2xl p-3 sm:p-5">
            <CreateAgentTab 
              taskDescription={taskDescription}
              setTaskDescription={setTaskDescription}
              context={context}
              setContext={setContext}
              includeContext={includeContext}
              setIncludeContext={setIncludeContext}
              userId={userId}
              setUserId={setUserId}
              file={file}
              setFile={setFile}
              lastResponse={lastResponse}
              generating={generating}
              generateAgent={async (task: Task) => {
                try {
                  return await generateAgent(task);
                } catch (error) {
                  console.error("Error generating agent:", error);
                  throw error;
                }
              }}
              setActiveTab={setActiveTab}
            />
          </TabsContent>

          <TabsContent value="manage" className="d3-chrome-panel rounded-2xl p-3 sm:p-5">
            <ManageAgentsTab 
              agents={agents}
              loading={loading}
              selectedAgent={selectedAgent}
              setSelectedAgent={setSelectedAgent}
              taskDescription={taskDescription}
              setTaskDescription={setTaskDescription}
              context={context}
              setContext={setContext}
              includeContext={includeContext}
              lastResponse={lastResponse}
              runAgent={async (agentId: string, task: Task) => {
                try {
                  return await runAgent(agentId, task);
                } catch (error) {
                  console.error("Error running agent:", error);
                  throw error;
                }
              }}
            />
          </TabsContent>

          <TabsContent value="workflow" className="d3-chrome-panel rounded-2xl p-3 sm:p-5">
            <WorkflowTab 
              yamlDAG={yamlDAG}
              setYamlDAG={setYamlDAG}
              dagResponse={dagResponse}
              setDagResponse={setDagResponse}
              logMessages={logMessages}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AgentManager;
