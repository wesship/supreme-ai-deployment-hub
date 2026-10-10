import React from "react";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Loader2, Send, List } from "lucide-react";
import { Task, Agent, AgentResponse } from "@/types/agent";

interface ManageAgentsTabProps {
  agents: Agent[];
  loading: boolean;
  selectedAgent: Agent | null;
  setSelectedAgent: (agent: Agent) => void;
  taskDescription: string;
  setTaskDescription: (value: string) => void;
  context: string;
  setContext: (value: string) => void;
  includeContext: boolean;
  lastResponse: string | null;
  runAgent: (agentId: string, task: Task) => Promise<AgentResponse>;
}

const ManageAgentsTab: React.FC<ManageAgentsTabProps> = ({
  agents,
  loading,
  selectedAgent,
  setSelectedAgent,
  taskDescription,
  setTaskDescription,
  context,
  setContext,
  includeContext,
  lastResponse,
  runAgent,
}) => {
  const handleRunAgent = async () => {
    if (!selectedAgent || !taskDescription) {
      return;
    }

    const task: Task = {
      user_id: `user_${crypto.randomUUID()}`,
      task_description: taskDescription,
      context: includeContext ? context : undefined,
    };

    try {
      await runAgent(selectedAgent.id, task);
    } catch (error) {
      console.error("Error running agent:", error);
    }
  };

  return (
    <div className="grid md:grid-cols-3 gap-4 mt-4">
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle>Available Agents</CardTitle>
          <CardDescription>
            {agents.length} agent{agents.length !== 1 ? "s" : ""} available
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center p-4 text-muted-foreground">
              No agents found. Create one first.
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className={`p-3 rounded-lg cursor-pointer hover:bg-accent ${selectedAgent?.id === agent.id ? "bg-accent" : ""}`}
                    onClick={() => setSelectedAgent(agent)}
                  >
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-sm text-muted-foreground truncate">{agent.desc}</div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>{selectedAgent ? `Run Agent: ${selectedAgent.name}` : "Select an Agent"}</CardTitle>
          {selectedAgent && <CardDescription>{selectedAgent.desc}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedAgent ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="runTaskDescription">Task Description</Label>
                <Textarea
                  id="runTaskDescription"
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Describe what you want the agent to do..."
                  rows={4}
                />
              </div>
              {includeContext && (
                <div className="space-y-2">
                  <Label htmlFor="runContext">Context</Label>
                  <Textarea
                    id="runContext"
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="Provide additional context..."
                    rows={3}
                  />
                </div>
              )}
              <Button onClick={handleRunAgent} disabled={!taskDescription || loading} className="w-full">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {loading ? "Running..." : "Run Agent"}
              </Button>
              {lastResponse && (
                <div className="mt-4">
                  <Separator className="my-4" />
                  <Label>Agent Response:</Label>
                  <ScrollArea className="h-[200px] w-full rounded-md border p-4 mt-2">
                    <pre className="whitespace-pre-wrap">{lastResponse}</pre>
                  </ScrollArea>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-center">
              <List className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No Agent Selected</h3>
              <p className="text-muted-foreground">Select an agent from the list to run it</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ManageAgentsTab;
