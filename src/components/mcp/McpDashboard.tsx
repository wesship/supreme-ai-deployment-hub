import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { McpToolExplorer } from "./McpToolExplorer";
import { AutonomousAgentRunner } from "./AutonomousAgentRunner";
import { Wrench, Bot } from "lucide-react";

export function McpDashboard() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-2">MCP Gateway Control Center</h2>
        <p className="text-muted-foreground">
          Connect to Docker MCP Gateway, explore tools, and run autonomous agents
        </p>
      </div>

      <Tabs defaultValue="agent" className="space-y-6">
        <TabsList>
          <TabsTrigger value="agent" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Autonomous Agent
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Tool Explorer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agent">
          <AutonomousAgentRunner />
        </TabsContent>

        <TabsContent value="tools">
          <McpToolExplorer />
        </TabsContent>
      </Tabs>
    </div>
  );
}
