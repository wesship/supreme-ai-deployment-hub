import { McpDashboard } from "@/components/mcp/McpDashboard";

interface Props {
  onNavigate: (view: string) => void;
}

export default function CommandCenterMcp({ onNavigate }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">MCP Tools</h2>
        <p className="text-muted-foreground mt-1">
          Run autonomous agents and explore available MCP tools
        </p>
      </div>
      <McpDashboard />
    </div>
  );
}
