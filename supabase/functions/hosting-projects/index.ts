import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const PLATFORM_ROOT_DOMAIN = Deno.env.get("PLATFORM_ROOT_DOMAIN") ?? "d3vonn.io";
const DEFAULT_HOSTING_PROVIDER = Deno.env.get("DEFAULT_HOSTING_PROVIDER") ?? "vercel";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeSlug = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

const reserved = new Set(["www", "api", "admin", "app", "auth", "status", "cdn", "assets", "mail", "smtp", "stream"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

  // Use the caller JWT so all writes are constrained by database RLS.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Invalid or expired token" }, 401);

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("hosting_projects")
      .select("id,name,slug,status,created_at,hosting_domain_bindings(id,hostname,mode,status,certificate_status),hosting_deployments(id,provider_id,status,health_url,created_at)")
      .order("created_at", { ascending: false });
    if (error) return json({ error: error.message }, 400);
    return json({ projects: data });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { name?: string; slug?: string; provider?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const name = body.name?.trim();
  const slug = normalizeSlug(body.slug ?? name ?? "");
  if (!name || !slug) return json({ error: "name and a valid slug are required" }, 400);
  if (reserved.has(slug)) return json({ error: "That hostname is reserved" }, 409);
  if (slug.length > 63) return json({ error: "Slug must be 63 characters or fewer" }, 400);

  const { data: zone, error: zoneError } = await supabase
    .from("hosting_domain_zones")
    .select("id,root_domain")
    .eq("root_domain", PLATFORM_ROOT_DOMAIN)
    .eq("status", "active")
    .single();
  if (zoneError || !zone) return json({ error: "Active platform domain zone is unavailable" }, 503);

  const { data: project, error: projectError } = await supabase
    .from("hosting_projects")
    .insert({ owner_id: user.id, name, slug })
    .select("id,name,slug,status,created_at")
    .single();
  if (projectError) {
    const conflict = projectError.code === "23505";
    return json({ error: conflict ? "Project slug already exists for this account" : projectError.message }, conflict ? 409 : 400);
  }

  const hostname = `${slug}.${zone.root_domain}`;
  const provider = body.provider?.trim() || DEFAULT_HOSTING_PROVIDER;

  const { data: deployment, error: deploymentError } = await supabase
    .from("hosting_deployments")
    .insert({ project_id: project.id, provider_id: provider, status: "queued" })
    .select("id,provider_id,status,created_at")
    .single();

  if (deploymentError) {
    await supabase.from("hosting_projects").delete().eq("id", project.id);
    return json({ error: deploymentError.message }, 400);
  }

  const { data: domain, error: domainError } = await supabase
    .from("hosting_domain_bindings")
    .insert({
      project_id: project.id,
      deployment_id: deployment.id,
      zone_id: zone.id,
      hostname,
      mode: "platform-subdomain",
      status: "pending",
      certificate_status: "pending",
    })
    .select("id,hostname,mode,status,certificate_status")
    .single();

  if (domainError) {
    await supabase.from("hosting_projects").delete().eq("id", project.id);
    return json({ error: domainError.code === "23505" ? "Hostname is already allocated" : domainError.message }, domainError.code === "23505" ? 409 : 400);
  }

  return json({
    project,
    deployment,
    domain,
    url: `https://${hostname}`,
    next: "deployment-worker",
  }, 201);
});
