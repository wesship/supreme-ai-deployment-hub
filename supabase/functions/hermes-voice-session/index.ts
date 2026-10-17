// Authentication-only preflight. No provider credentials or Hermes actions are issued.
// Remains fail-closed until persistent sessions, quotas and revocation are verified.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status: number, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const allowedOrigin = Deno.env.get("VOICE_UI_ALLOWED_ORIGIN");
  if (!allowedOrigin || !origin || origin !== allowedOrigin) {
    return json({ error: "Origin not allowed" }, 403);
  }
  const headers = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, headers);
  if (Number(req.headers.get("content-length") || "0") > 4096) {
    return json({ error: "Request too large" }, 413, headers);
  }
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401, headers);
  const url = Deno.env.get("SUPABASE_URL");
  const publishable = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !publishable) return json({ error: "Unavailable" }, 503, headers);
  const client = createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(auth.slice(7));
  if (error || !data.user || data.user.is_anonymous) {
    return json({ error: "Unauthorized" }, 401, headers);
  }
  // No session token is returned until a database-backed issuance/revocation flow exists.
  return json({ status: "not_configured", authenticated: true, voiceEnabled: false }, 503, headers);
});
