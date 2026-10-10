import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  category: string;
  version: string;
  tags: string[] | null;
  pricing_model: string;
  price: number | null;
  downloads: number | null;
  avg_rating: number | null;
  is_featured: boolean | null;
  is_verified: boolean | null;
}

const toTemplateJson = (t: TemplateRow) => ({
  id: t.id,
  name: t.name,
  description: t.description,
  category: t.category,
  version: t.version,
  tags: t.tags ?? [],
  pricingModel: t.pricing_model,
  price: t.price ?? 0,
  downloads: t.downloads ?? 0,
  avgRating: t.avg_rating ?? 0,
  isFeatured: t.is_featured ?? false,
  isVerified: t.is_verified ?? false,
});

export default defineTool({
  name: "list_agent_templates",
  title: "List agent templates",
  description:
    "List published agent templates from the D3VONN.IO marketplace catalog, optionally filtered by category.",
  inputSchema: {
    category: z.string().trim().min(1).optional().describe("Filter templates by category."),
    limit: z.number().int().min(1).max(50).default(20).describe("Maximum number of templates to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ category, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("agent_templates")
      .select(
        "id, name, description, category, version, tags, pricing_model, price, downloads, avg_rating, is_featured, is_verified",
      )
      .eq("status", "published")
      .order("downloads", { ascending: false })
      .limit(limit);
    if (category) query = query.eq("category", category);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const templates = (data ?? []) as TemplateRow[];
    return {
      content: [{ type: "text", text: JSON.stringify(templates.map(toTemplateJson), null, 2) }],
      structuredContent: { templates: templates.map(toTemplateJson) },
    };
  },
});
