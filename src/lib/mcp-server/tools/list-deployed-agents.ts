import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

interface DeployedAgentRow {
  id: string;
  name: string;
  status: string;
  health_score: number | null;
  last_heartbeat: string | null;
  total_runs: number | null;
  successful_runs: number | null;
  failed_runs: number | null;
  created_at: string;
}

const toAgentJson = (a: DeployedAgentRow) => ({
  id: a.id,
  name: a.name,
  status: a.status,
  healthScore: a.health_score ?? null,
  lastHeartbeat: a.last_heartbeat,
  totalRuns: a.total_runs ?? 0,
  successfulRuns: a.successful_runs ?? 0,
  failedRuns: a.failed_runs ?? 0,
  createdAt: a.created_at,
});

export default defineTool({
  name: "list_deployed_agents",
  title: "List deployed agents",
  description:
    "List the signed-in user's deployed agents on D3VONN.IO with their status, health score, and run counts.",
  inputSchema: {
    status: z
      .enum(["running", "stopped", "error", "paused"])
      .optional()
      .describe("Filter agents by status."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("deployed_agents")
      .select(
        "id, name, status, health_score, last_heartbeat, total_runs, successful_runs, failed_runs, created_at",
      )
      .order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const agents = (data ?? []) as DeployedAgentRow[];
    return {
      content: [{ type: "text", text: JSON.stringify(agents.map(toAgentJson), null, 2) }],
      structuredContent: { agents: agents.map(toAgentJson) },
    };
  },
});
