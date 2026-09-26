import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_deployment_status",
  title: "Get deployment status",
  description:
    "Summarize the signed-in user's D3VONN.IO fleet: agent counts by status, total runs, and average health score.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("deployed_agents")
      .select("status, health_score, total_runs, successful_runs, failed_runs");
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const rows = (data ?? []) as {
      status: string;
      health_score: number | null;
      total_runs: number | null;
      successful_runs: number | null;
      failed_runs: number | null;
    }[];

    const byStatus: Record<string, number> = {};
    let healthSum = 0;
    let healthCount = 0;
    let totalRuns = 0;
    let successfulRuns = 0;
    let failedRuns = 0;
    for (const row of rows) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
      if (typeof row.health_score === "number") {
        healthSum += row.health_score;
        healthCount += 1;
      }
      totalRuns += row.total_runs ?? 0;
      successfulRuns += row.successful_runs ?? 0;
      failedRuns += row.failed_runs ?? 0;
    }

    const summary = {
      totalAgents: rows.length,
      byStatus,
      totalRuns,
      successfulRuns,
      failedRuns,
      averageHealthScore: healthCount > 0 ? Math.round((healthSum / healthCount) * 100) / 100 : null,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: { summary },
    };
  },
});
