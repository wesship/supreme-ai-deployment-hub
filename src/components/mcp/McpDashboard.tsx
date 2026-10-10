import { SecureMcpRunner } from "./SecureMcpRunner";

export function McpDashboard() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-2">MCP Gateway Control Center</h2>
        <p className="text-muted-foreground">Run approved Model Context Protocol workloads through a server-governed, auditable execution boundary.</p>
      </div>
      <SecureMcpRunner />
    </div>
  );
}
