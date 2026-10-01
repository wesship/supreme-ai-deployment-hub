import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

function randomToken(bytes = 32) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(data).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "AUTH_REQUIRED" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "INVALID_TOKEN" }, 401);

    const body = await req.json();
    const shadowRunId = body?.shadow_run_id;
    if (!shadowRunId || typeof shadowRunId !== "string") return json({ error: "shadow_run_id required" }, 400);

    const primaryPlaintext = randomToken();
    const expiryPlaintext = randomToken();

    const { data: issuedRows, error: issueError } = await serviceClient.rpc(
      "nonprofit_issue_production_execution_token",
      { p_shadow_run_id: shadowRunId, p_plaintext_token: primaryPlaintext, p_issued_by: "gate31-dry-commit", p_ttl_seconds: 300 },
    );
    if (issueError) return json({ error: issueError.message, stage: "issue" }, 403);
    const issued = Array.isArray(issuedRows) ? issuedRows[0] : issuedRows;

    const { data: preflightRows, error: preflightError } = await userClient.rpc(
      "nonprofit_validate_production_preflight",
      { p_shadow_run_id: shadowRunId },
    );
    if (preflightError) return json({ error: preflightError.message, stage: "preflight" }, 403);
    const preflight = Array.isArray(preflightRows) ? preflightRows[0] : preflightRows;

    const { data: consumeRows, error: consumeError } = await serviceClient.rpc(
      "nonprofit_consume_production_execution_token",
      {
        p_execution_token_id: issued.execution_token_id,
        p_plaintext_token: primaryPlaintext,
        p_expected_request_body_hash: issued.request_body_hash,
        p_consumed_by: "gate31-dry-commit",
      },
    );
    if (consumeError) return json({ error: consumeError.message, stage: "consume" }, 403);
    const consumed = Array.isArray(consumeRows) ? consumeRows[0] : consumeRows;

    let replayStatus = "REPLAY_NOT_TESTED";
    const { error: replayError } = await serviceClient.rpc(
      "nonprofit_consume_production_execution_token",
      {
        p_execution_token_id: issued.execution_token_id,
        p_plaintext_token: primaryPlaintext,
        p_expected_request_body_hash: issued.request_body_hash,
        p_consumed_by: "gate31-replay-test",
      },
    );
    if (replayError) replayStatus = "REPLAY_BLOCKED";

    const { data: expiryIssueRows, error: expiryIssueError } = await serviceClient.rpc(
      "nonprofit_issue_production_execution_token",
      { p_shadow_run_id: shadowRunId, p_plaintext_token: expiryPlaintext, p_issued_by: "gate31-expiry-test", p_ttl_seconds: 60 },
    );
    if (expiryIssueError) return json({ error: expiryIssueError.message, stage: "expiry_issue" }, 403);
    const expiryIssued = Array.isArray(expiryIssueRows) ? expiryIssueRows[0] : expiryIssueRows;

    const { error: expireError } = await serviceClient.rpc(
      "nonprofit_expire_execution_token_for_dry_commit_test",
      { p_execution_token_id: expiryIssued.execution_token_id },
    );
    if (expireError) return json({ error: expireError.message, stage: "expiry_force" }, 500);

    let expiryStatus = "EXPIRY_NOT_TESTED";
    const { error: expiredConsumeError } = await serviceClient.rpc(
      "nonprofit_consume_production_execution_token",
      {
        p_execution_token_id: expiryIssued.execution_token_id,
        p_plaintext_token: expiryPlaintext,
        p_expected_request_body_hash: expiryIssued.request_body_hash,
        p_consumed_by: "gate31-expiry-test",
      },
    );
    if (expiredConsumeError) expiryStatus = "EXPIRY_BLOCKED";

    const simulatedReceipt = {
      schema_version: "grantassist.production-dry-commit-receipt.v1",
      request_body_hash: issued.request_body_hash,
      token_plaintext_exposed: false,
      network_request_performed: false,
      application_payload_transmitted: false,
      production_execution_enabled: false,
      production_send_available: false,
    };

    const { data: recordRows, error: recordError } = await serviceClient.rpc(
      "nonprofit_record_production_dry_commit_run",
      {
        p_shadow_run_id: shadowRunId,
        p_execution_token_id: issued.execution_token_id,
        p_validation_status: preflight?.preflight_status || "BLOCKED",
        p_consume_status: consumed?.token_status || "FAILED",
        p_replay_status: replayStatus,
        p_expiry_status: expiryStatus,
        p_simulated_receipt: simulatedReceipt,
      },
    );
    if (recordError) return json({ error: recordError.message, stage: "record" }, 500);
    const recorded = Array.isArray(recordRows) ? recordRows[0] : recordRows;

    return json({
      ...recorded,
      validation_status: preflight?.preflight_status,
      consume_status: consumed?.token_status,
      replay_status: replayStatus,
      expiry_status: expiryStatus,
      token_plaintext_exposed: false,
      network_request_performed: false,
      application_payload_transmitted: false,
      production_execution_enabled: false,
      production_send_available: false,
    });
  } catch (error) {
    return json({
      error: error instanceof Error ? error.message : "INTERNAL_ERROR",
      token_plaintext_exposed: false,
      network_request_performed: false,
      application_payload_transmitted: false,
      production_execution_enabled: false,
      production_send_available: false,
    }, 500);
  }
});
