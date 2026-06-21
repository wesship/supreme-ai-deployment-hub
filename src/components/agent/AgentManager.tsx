
import React, { useState, useRef, useEffect } from "react";
import { useAgents } from "@/hooks/agents";
import { Task, AgentResponse } from "@/types/agent";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw } from "lucide-react";
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
    <div className="container mx-auto p-4">
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold">AI Agent Manager</h2>
          <Button variant="outline" onClick={refreshAgents} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh Agents
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="create">Create Agent</TabsTrigger>
            <TabsTrigger value="manage">Manage Agents</TabsTrigger>
            <TabsTrigger value="workflow">DAG Workflow</TabsTrigger>
          </TabsList>

          <TabsContent value="create">
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

          <TabsContent value="manage">
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

          <TabsContent value="workflow">
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
