import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Bot,
  Play,
  Square,
  Trash2,
  Loader2,
  Brain,
  Wrench,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  Eye,
} from "lucide-react";
import { useAutonomousAgent } from "@/hooks/useAutonomousAgent";
import type { AgentStep } from "@/lib/mcp";
import { cn } from "@/lib/utils";

const stepIcons: Record<AgentStep["type"], React.ReactNode> = {
  thought: <Brain className="h-4 w-4 text-purple-500" />,
  tool_call: <Wrench className="h-4 w-4 text-blue-500" />,
  tool_result: <MessageSquare className="h-4 w-4 text-green-500" />,
  observation: <Eye className="h-4 w-4 text-yellow-500" />,
  final_answer: <Lightbulb className="h-4 w-4 text-amber-500" />,
};

const statusColors: Record<string, string> = {
  idle: "bg-gray-500",
  thinking: "bg-purple-500 animate-pulse",
  executing: "bg-blue-500 animate-pulse",
  completed: "bg-green-500",
  failed: "bg-red-500",
  stopped: "bg-orange-500",
};

export function AutonomousAgentRunner() {
  const {
    run,
    isRunning,
    steps,
    status,
    error,
    startAgent,
    stopAgent,
    clearRun,
  } = useAutonomousAgent();

  const [config, setConfig] = useState({
    name: "Research Agent",
    goal: "Search for information about MCP protocol and Docker integration",
    mcpGatewayUrl: "http://localhost:8080/mcp",
    maxSteps: 10,
  });

  const handleStart = async () => {
    await startAgent({
      agentId: `agent-${Date.now()}`,
      name: config.name,
      goal: config.goal,
      mcpGatewayUrl: config.mcpGatewayUrl,
      maxSteps: config.maxSteps,
    });
  };

  return (
    <div className="space-y-6">
      {/* Configuration Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Autonomous MCP Agent
          </CardTitle>
          <CardDescription>
            Configure and run an autonomous agent that uses MCP tools
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Agent Name</Label>
              <Input
                id="name"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                disabled={isRunning}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gateway">MCP Gateway URL</Label>
              <Input
                id="gateway"
                value={config.mcpGatewayUrl}
                onChange={(e) => setConfig({ ...config, mcpGatewayUrl: e.target.value })}
                disabled={isRunning}
                placeholder="http://localhost:8080/mcp"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal">Goal / Task</Label>
            <Textarea
              id="goal"
              value={config.goal}
              onChange={(e) => setConfig({ ...config, goal: e.target.value })}
              disabled={isRunning}
              placeholder="Describe what you want the agent to accomplish..."
              rows={3}
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="maxSteps">Max Steps:</Label>
              <Input
                id="maxSteps"
                type="number"
                className="w-20"
                value={config.maxSteps}
                onChange={(e) => setConfig({ ...config, maxSteps: parseInt(e.target.value) || 10 })}
                disabled={isRunning}
                min={1}
                max={50}
              />
            </div>

            <div className="flex-1" />

            {isRunning ? (
              <Button variant="destructive" onClick={stopAgent}>
                <Square className="mr-2 h-4 w-4" />
                Stop Agent
              </Button>
            ) : (
              <Button onClick={handleStart} disabled={!config.goal.trim()}>
                <Play className="mr-2 h-4 w-4" />
                Start Agent
              </Button>
            )}

            {run && !isRunning && (
              <Button variant="outline" onClick={clearRun}>
                <Trash2 className="mr-2 h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status & Progress */}
      {status && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                Agent Execution
                <Badge className={cn("ml-2", statusColors[status])}>
                  {status}
                </Badge>
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {steps.length} steps
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div key={step.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-background">
                        {stepIcons[step.type]}
                      </div>
                      {index < steps.length - 1 && (
                        <div className="h-full w-px bg-border" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1 pb-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">
                          {step.type.replace("_", " ")}
                        </span>
                        {step.toolName && (
                          <Badge variant="outline" className="text-xs">
                            {step.toolName}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(step.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {step.content}
                      </div>
                      {step.toolArgs && Object.keys(step.toolArgs).length > 0 && (
                        <pre className="mt-2 p-2 rounded bg-muted text-xs overflow-x-auto">
                          {JSON.stringify(step.toolArgs, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}

                {isRunning && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">
                      {status === "thinking" ? "Agent is thinking..." : "Executing tool..."}
                    </span>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Final Result */}
      {run?.finalResult && (
        <Card className="border-green-500/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Final Result
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{run.finalResult}</p>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
