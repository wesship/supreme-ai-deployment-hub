import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Server,
  Key,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
  Copy,
  Loader2,
  Shield,
} from "lucide-react";
import { useMcpConnections } from "@/hooks/useMcpConnections";
import { useAPIKeys } from "@/hooks/useAPIKeys";

interface Props {
  onNavigate: (view: string) => void;
}

export default function CommandCenterSettings({ onNavigate }: Props) {
  const { connections, isLoading: mcpLoading, setActiveConnection, deleteConnection } = useMcpConnections();
  const { availableAPIs, getAPIKey, getMaskedAPIKey, toggleKeyVisibility, isKeyVisible, copyAPIKeyToClipboard, rotateKeys } = useAPIKeys();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">Manage MCP connections and API keys</p>
      </div>

      {/* MCP Connections */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Server className="h-5 w-5" /> MCP Connections
        </h2>
        {mcpLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : connections.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Server className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No MCP connections configured yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Go to <button className="underline text-primary" onClick={() => onNavigate("mcp")}>MCP Tools</button> to connect a server.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {connections.map((conn) => (
              <Card key={conn.id}>
                <CardContent className="py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm">{conn.server_name}</h3>
                      <Badge variant={conn.is_active ? "default" : "secondary"} className="text-[10px]">
                        {conn.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{conn.category}</p>
                  </div>
                  <Switch checked={conn.is_active} onCheckedChange={(checked) => setActiveConnection(conn.id, checked)} />
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteConnection(conn.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* API Keys */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Key className="h-5 w-5" /> API Keys
          </h2>
          <Button variant="outline" size="sm" onClick={() => rotateKeys()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Rotate All
          </Button>
        </div>
        {availableAPIs.length > 0 ? (
          <div className="space-y-3">
            {availableAPIs.map((name) => (
              <Card key={name}>
                <CardContent className="py-4 flex items-center gap-4">
                  <Shield className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm">{name}</h3>
                    <code className="text-xs text-muted-foreground font-mono">
                      {isKeyVisible(name) ? getAPIKey(name) : getMaskedAPIKey(name)}
                    </code>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleKeyVisibility(name)}>
                    {isKeyVisible(name) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyAPIKeyToClipboard(name)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <Key className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No API keys configured.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
