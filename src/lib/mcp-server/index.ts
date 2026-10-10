import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listAgentTemplatesTool from "./tools/list-agent-templates";
import listDeployedAgentsTool from "./tools/list-deployed-agents";
import getDeploymentStatusTool from "./tools/get-deployment-status";

// The OAuth issuer MUST be the direct Supabase host, built from the project
// ref — never from SUPABASE_URL (which is the .lovable.cloud proxy here).
// VITE_SUPABASE_PROJECT_ID is inlined by Vite at build time, so this stays
// import-safe with no runtime env read.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "supreme-ai-deployment-hub",
  title: "supreme-ai-deployment-hub",
  version: "0.1.0",
  instructions:
    "D3VONN.IO agent deployment hub. Use `list_agent_templates` to browse the marketplace catalog, `list_deployed_agents` to see the caller's deployed agents, and `get_deployment_status` for a fleet summary.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listAgentTemplatesTool, listDeployedAgentsTool, getDeploymentStatusTool],
});
