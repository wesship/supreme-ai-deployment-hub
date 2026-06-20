import { McpDashboard } from "@/components/mcp";
import D3vonnPageBanner from "@/components/index/D3vonnPageBanner";

export default function McpPage() {
  return (
    <>
      <D3vonnPageBanner title="MCP Tool Explorer" />
      <McpDashboard />
    </>
  );
}
