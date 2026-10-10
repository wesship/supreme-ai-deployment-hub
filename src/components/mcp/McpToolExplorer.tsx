import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plug, 
  PlugZap, 
  RefreshCw, 
  Play, 
  ChevronDown, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  Wrench,
  Server
} from "lucide-react";
import { useMcpGateway } from "@/hooks/useMcpGateway";
import type { McpTool, McpToolResult } from "@/lib/mcp";
import type { McpServerConfig } from "@/lib/mcp/serverRegistry";
import { McpServerSelector } from "./McpServerSelector";

export function McpToolExplorer() {
  const {
    isConnected,
    isConnecting,
    session,
    tools,
    error,
    connect,
    disconnect,
    refreshTools,
    callTool,
  } = useMcpGateway();

  const [connectedServerId, setConnectedServerId] = useState<string | undefined>();
  const [selectedTool, setSelectedTool] = useState<McpTool | null>(null);
  const [toolArgs, setToolArgs] = useState<string>("{}");
  const [toolResult, setToolResult] = useState<McpToolResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleServerConnect = async (server: McpServerConfig, apiToken?: string) => {
    // Determine the gateway URL based on server type
    let gatewayUrl = server.gatewayUrl;
    
    if (server.type === "stdio") {
      // For stdio servers, we need to proxy through our edge function
      // The edge function will spawn the process
      gatewayUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp-gateway`;
    }

    if (!gatewayUrl) {
      console.error("No gateway URL configured for server:", server.id);
      return;
    }

    // Store API token if provided (would be passed to edge function)
    if (apiToken) {
      // In a real implementation, this would be stored securely
      console.log(`[MCP] Connecting to ${server.name} with API token`);
    }

    await connect(gatewayUrl);
    setConnectedServerId(server.id);
  };

  const handleDisconnect = async () => {
    await disconnect();
    setConnectedServerId(undefined);
    setSelectedTool(null);
    setToolResult(null);
  };

  const handleCallTool = async () => {
    if (!selectedTool) return;

    setIsExecuting(true);
    setToolResult(null);

    try {
      const args = JSON.parse(toolArgs);
      const result = await callTool(selectedTool.name, args);
      setToolResult(result);
    } catch (err) {
      setToolResult({
        content: [{ type: "text", text: err instanceof Error ? err.message : "Tool call failed" }],
        isError: true,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue={isConnected ? "tools" : "servers"} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="servers" className="gap-2">
            <Server className="h-4 w-4" />
            Servers
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-2" disabled={!isConnected}>
            <Wrench className="h-4 w-4" />
            Tools {isConnected && <Badge variant="secondary" className="ml-1">{tools.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Servers Tab */}
        <TabsContent value="servers" className="space-y-4">
          {/* Connection Status */}
          {isConnected && (
            <Card>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <PlugZap className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Connected to {session?.serverInfo?.name ?? "MCP Gateway"}</p>
                    <p className="text-sm text-muted-foreground">{tools.length} tools available</p>
                  </div>
                </div>
                <Button variant="outline" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              </CardContent>
            </Card>
          )}

          {error && (
            <div className="flex items-center gap-2 p-4 rounded-md bg-destructive/10 text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Server Selector */}
          <McpServerSelector
            onConnect={handleServerConnect}
            connectedServerId={connectedServerId}
            isConnecting={isConnecting}
          />
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="space-y-4">
          {isConnected ? (
            <>
              {/* Tools List */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="h-5 w-5" />
                      Available Tools
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={refreshTools}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {tools.map((tool) => (
                        <Collapsible key={tool.name}>
                          <CollapsibleTrigger asChild>
                            <Button
                              variant={selectedTool?.name === tool.name ? "secondary" : "ghost"}
                              className="w-full justify-between"
                              onClick={() => {
                                setSelectedTool(tool);
                                setToolArgs(JSON.stringify(
                                  Object.fromEntries(
                                    Object.entries(tool.inputSchema?.properties ?? {}).map(
                                      ([key, prop]) => [key, prop.default ?? ""]
                                    )
                                  ),
                                  null,
                                  2
                                ));
                              }}
                            >
                              <span className="font-mono text-sm">{tool.name}</span>
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="px-4 py-2 text-sm text-muted-foreground">
                            {tool.description ?? "No description available"}
                            {tool.inputSchema?.properties && (
                              <div className="mt-2 space-y-1">
                                <span className="font-medium">Parameters:</span>
                                {Object.entries(tool.inputSchema.properties).map(([key, prop]) => (
                                  <div key={key} className="flex items-center gap-2 text-xs">
                                    <code className="bg-muted px-1 rounded">{key}</code>
                                    <span className="text-muted-foreground">({prop.type})</span>
                                    {tool.inputSchema?.required?.includes(key) && (
                                      <Badge variant="outline" className="text-xs">required</Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Tool Execution */}
              {selectedTool && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Play className="h-5 w-5" />
                      Execute: {selectedTool.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Arguments (JSON)</label>
                      <textarea
                        className="w-full h-32 font-mono text-sm p-3 rounded-md border bg-muted"
                        value={toolArgs}
                        onChange={(e) => setToolArgs(e.target.value)}
                        placeholder='{"param1": "value1"}'
                      />
                    </div>

                    <Button onClick={handleCallTool} disabled={isExecuting}>
                      {isExecuting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Executing...
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          Execute Tool
                        </>
                      )}
                    </Button>

                    {toolResult && (
                      <div className={`p-4 rounded-md ${toolResult.isError ? "bg-destructive/10" : "bg-muted"}`}>
                        <div className="text-sm font-medium mb-2">
                          {toolResult.isError ? "Error" : "Result"}
                        </div>
                        <ScrollArea className="h-[200px]">
                          <pre className="text-xs whitespace-pre-wrap">
                            {toolResult.content.map((c, i) => (
                              <div key={i}>{c.text ?? JSON.stringify(c, null, 2)}</div>
                            ))}
                          </pre>
                        </ScrollArea>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Plug className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No Server Connected</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Connect to an MCP server to access tools
                </p>
                <Button variant="outline" onClick={() => {}}>
                  Go to Servers
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
