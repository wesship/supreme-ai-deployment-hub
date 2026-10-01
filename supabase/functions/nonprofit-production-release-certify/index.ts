import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await client.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "INVALID_TOKEN" }, 401);

    const body = await req.json();
    const dryCommitCertificationId = body?.dry_commit_certification_id;
    const subjectRef = body?.subject_ref;

    if (!dryCommitCertificationId || typeof dryCommitCertificationId !== "string") {
      return json({ error: "dry_commit_certification_id required" }, 400);
    }
    if (!subjectRef || typeof subjectRef !== "string") {
      return json({ error: "subject_ref required" }, 400);
    }

    const { data: rows, error } = await client.rpc("nonprofit_evaluate_production_release", {
      p_dry_commit_certification_id: dryCommitCertificationId,
      p_subject_ref: subjectRef,
    });

    if (error) return json({ error: error.message, code: "RELEASE_CERTIFICATION_BLOCKED" }, 403);

    const result = Array.isArray(rows) ? rows[0] : rows;
    if (!result) return json({ error: "RELEASE_CERTIFICATION_RESULT_MISSING" }, 500);

    return json({
      release_run_id: result.release_run_id,
      decision: result.decision,
      blocker_reasons: result.blocker_reasons,
      release_evidence_hash: result.release_evidence_hash,
      certificate_id: result.certificate_id,
      certificate_expires_at: result.certificate_expires_at,
      production_send_available: false,
      production_execution_enabled: false,
      application_payload_transmitted: false,
      network_request_performed: false,
      secrets_read_by_this_function: false,
      meaning:
        result.decision === "GO"
          ? "GO means eligible for the next production-send implementation gate; it is not authorization to submit a grant."
          : "NO_GO means one or more release prerequisites remain blocked.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "INTERNAL_ERROR";
    return json({
      error: message,
      production_send_available: false,
      production_execution_enabled: false,
      application_payload_transmitted: false,
      network_request_performed: false,
      secrets_read_by_this_function: false,
    }, 500);
  }
});
