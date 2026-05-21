import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Server,
  Code,
  Brain,
  Zap,
  Database,
  Cloud,
  Settings,
  Plus,
  Key,
  ExternalLink,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  MCP_SERVER_REGISTRY,
  SERVER_CATEGORIES,
  type McpServerConfig,
} from "@/lib/mcp/serverRegistry";

interface McpServerSelectorProps {
  onConnect: (server: McpServerConfig, apiToken?: string) => Promise<void>;
  connectedServerId?: string;
  isConnecting?: boolean;
}

const categoryIcons: Record<string, React.ReactNode> = {
  hosting: <Server className="h-4 w-4" />,
  cloud: <Cloud className="h-4 w-4" />,
  development: <Code className="h-4 w-4" />,
  ai: <Brain className="h-4 w-4" />,
  automation: <Zap className="h-4 w-4" />,
  data: <Database className="h-4 w-4" />,
  custom: <Settings className="h-4 w-4" />,
};

export function McpServerSelector({
  onConnect,
  connectedServerId,
  isConnecting,
}: McpServerSelectorProps) {
  const [selectedServer, setSelectedServer] = useState<McpServerConfig | null>(null);
  const [apiToken, setApiToken] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleConnect = async () => {
    if (!selectedServer) return;

    const serverToConnect = { ...selectedServer };
    
    // Handle custom server URL
    if (selectedServer.id === "custom" && customUrl) {
      serverToConnect.gatewayUrl = customUrl;
    }

    await onConnect(serverToConnect, apiToken || undefined);
    setDialogOpen(false);
    setApiToken("");
    setCustomUrl("");
  };

  const openConnectionDialog = (server: McpServerConfig) => {
    setSelectedServer(server);
    setDialogOpen(true);
  };

  const categories = Object.entries(SERVER_CATEGORIES);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">MCP Servers</h3>
          <p className="text-sm text-muted-foreground">
            Connect to Model Context Protocol servers to access tools
          </p>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all">All</TabsTrigger>
          {categories.map(([key, { label }]) => (
            <TabsTrigger key={key} value={key} className="gap-1">
              {categoryIcons[key]}
              <span className="hidden sm:inline">{label.split(" ")[0]}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {MCP_SERVER_REGISTRY.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                isConnected={connectedServerId === server.id}
                isConnecting={!!(isConnecting && selectedServer?.id === server.id)}
                onConnect={() => openConnectionDialog(server)}
              />
            ))}
          </div>
        </TabsContent>

        {categories.map(([key]) => (
          <TabsContent key={key} value={key}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {MCP_SERVER_REGISTRY.filter((s) => s.category === key).map((server) => (
                <ServerCard
                  key={server.id}
                  server={server}
                  isConnected={connectedServerId === server.id}
                  isConnecting={!!(isConnecting && selectedServer?.id === server.id)}
                  onConnect={() => openConnectionDialog(server)}
                />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Connection Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedServer && categoryIcons[selectedServer.category]}
              Connect to {selectedServer?.name}
            </DialogTitle>
            <DialogDescription>{selectedServer?.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Setup Instructions */}
            {selectedServer?.setupInstructions && (
              <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-line">
                {selectedServer.setupInstructions}
              </div>
            )}

            {/* API Token Input */}
            {selectedServer?.auth?.type === "api_token" && (
              <div className="space-y-2">
                <Label htmlFor="api-token" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  {selectedServer.auth.description ?? "API Token"}
                </Label>
                <Input
                  id="api-token"
                  type="password"
                  placeholder="Enter your API token"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                />
              </div>
            )}

            {/* Custom URL Input */}
            {selectedServer?.id === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="custom-url">Gateway URL</Label>
                <Input
                  id="custom-url"
                  placeholder="https://your-mcp-server.com/mcp"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                />
              </div>
            )}

            {/* Documentation Link */}
            {selectedServer?.docsUrl && (
              <a
                href={selectedServer.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                View Documentation
              </a>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConnect}
              disabled={
                isConnecting ||
                (selectedServer?.auth?.type === "api_token" && !apiToken) ||
                (selectedServer?.id === "custom" && !customUrl)
              }
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ServerCardProps {
  server: McpServerConfig;
  isConnected: boolean;
  isConnecting: boolean;
  onConnect: () => void;
}

function ServerCard({ server, isConnected, isConnecting, onConnect }: ServerCardProps) {
  return (
    <Card
      className={`relative transition-all hover:shadow-md ${
        isConnected ? "ring-2 ring-primary" : ""
      }`}
    >
      {isConnected && (
        <div className="absolute top-2 right-2">
          <CheckCircle2 className="h-5 w-5 text-primary" />
        </div>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {categoryIcons[server.category]}
          <CardTitle className="text-base">{server.name}</CardTitle>
        </div>
        <CardDescription className="text-xs line-clamp-2">
          {server.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="text-xs">
            {SERVER_CATEGORIES[server.category].label.split(" ")[0]}
          </Badge>
          <Button
            size="sm"
            variant={isConnected ? "outline" : "default"}
            onClick={onConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isConnected ? (
              "Reconnect"
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                Connect
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
