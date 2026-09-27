import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PRODUCTION_ENDPOINT = Deno.env.get("NONPROFIT_PRODUCTION_SUBMISSION_ENDPOINT") || "";
const PRODUCTION_ALLOWED_HOSTS = new Set(
  (Deno.env.get("NONPROFIT_PRODUCTION_ALLOWED_HOSTS") || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);
const PRODUCTION_CREDENTIAL_PRESENT = Boolean(
  Deno.env.get("NONPROFIT_PRODUCTION_CREDENTIAL_TOKEN") ||
  Deno.env.get("NONPROFIT_PRODUCTION_CREDENTIAL_PROFILE"),
);

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

async function sha256Text(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function validateProductionEndpoint(raw: string) {
  if (!raw) throw new Error("PRODUCTION_ENDPOINT_NOT_CONFIGURED");

  const endpoint = new URL(raw);
  const host = endpoint.hostname.toLowerCase();

  if (endpoint.protocol !== "https:") throw new Error("HTTPS_REQUIRED");
  if (!PRODUCTION_ALLOWED_HOSTS.has(host)) throw new Error("PRODUCTION_HOST_NOT_ALLOWLISTED");

  const looksSandbox =
    host.includes("sandbox") ||
    host.includes("staging") ||
    host.includes("test") ||
    host.includes("dev") ||
    host === "localhost" ||
    host.endsWith(".local");

  if (looksSandbox) throw new Error("PRODUCTION_HOST_IDENTITY_INVALID");

  return endpoint;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const endpoint = validateProductionEndpoint(PRODUCTION_ENDPOINT);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "INVALID_TOKEN" }, 401);

    const requestBody = await req.json();
    const promotionId = requestBody?.promotion_id;
    if (!promotionId || typeof promotionId !== "string") {
      return json({ error: "promotion_id required" }, 400);
    }

    const { data: preparedRows, error: prepareError } = await userClient.rpc(
      "nonprofit_prepare_production_shadow",
      { p_promotion_id: promotionId },
    );

    if (prepareError) return json({ error: prepareError.message, code: "SHADOW_PREPARE_BLOCKED" }, 403);

    const prepared = Array.isArray(preparedRows) ? preparedRows[0] : preparedRows;
    if (!prepared) return json({ error: "PRODUCTION_SHADOW_NOT_PREPARED" }, 500);

    const productionContract = prepared.production_contract || {};
    const credentialProfilePresent = PRODUCTION_CREDENTIAL_PRESENT;
    const tlsValidated = endpoint.protocol === "https:";
    const hostAllowlisted = PRODUCTION_ALLOWED_HOSTS.has(endpoint.hostname.toLowerCase());
    const protectedEnvironmentApprovalPresent = Boolean(prepared.protected_environment_approval_ref);

    const idempotencyKey =
      `grantassist-production-shadow-${prepared.promotion_id}-${String(prepared.evidence_hash).slice(0, 20)}`;

    const shadowEnvelope = {
      schema_version: "grantassist.production-shadow.v1",
      mode: "SHADOW_ONLY",
      production_endpoint_host: endpoint.hostname,
      request_method: "POST",
      connector_kind: prepared.connector_kind,
      promotion_id: prepared.promotion_id,
      sandbox_certification_id: prepared.sandbox_certification_id,
      protected_environment_approval_ref: prepared.protected_environment_approval_ref,
      sandbox_evidence_hash: prepared.evidence_hash,
      application_payload_reference: "NOT_LOADED_IN_SHADOW_MODE",
      application_payload_transmitted: false,
      production_execution_enabled: false,
      production_contract: productionContract,
    };

    const requestBodyHash = await sha256Text(JSON.stringify(shadowEnvelope));

    const requestHeaders = {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
      "X-GrantAssist-Mode": "shadow",
      "X-GrantAssist-Request-SHA256": requestBodyHash,
      Authorization: credentialProfilePresent ? "PRESENT_REDACTED" : "MISSING",
    };

    const receiptParserContract = {
      expected_http_status_class: "2xx",
      receipt_id_header: "x-grantassist-receipt-id",
      received_payload_hash_header: "x-grantassist-received-sha256",
      json_receipt_id_field: "receipt_id",
      json_received_payload_hash_field: "received_payload_hash",
      receipt_hash_must_equal_request_payload_hash: true,
    };

    const shadowValid =
      credentialProfilePresent &&
      tlsValidated &&
      hostAllowlisted &&
      protectedEnvironmentApprovalPresent &&
      productionContract?.tls_required === true &&
      productionContract?.idempotency_required === true &&
      productionContract?.payload_hash_required === true &&
      productionContract?.receipt_hash_required === true &&
      productionContract?.execution_enabled === false;

    const shadowStatus = shadowValid ? "SHADOW_VALID" : "SHADOW_BLOCKED";

    const { data: recordedId, error: recordError } = await serviceClient.rpc(
      "nonprofit_record_production_shadow_run",
      {
        p_promotion_id: prepared.promotion_id,
        p_production_endpoint_host: endpoint.hostname,
        p_credential_profile_present: credentialProfilePresent,
        p_tls_validated: tlsValidated,
        p_host_allowlisted: hostAllowlisted,
        p_protected_environment_approval_present: protectedEnvironmentApprovalPresent,
        p_request_headers: requestHeaders,
        p_request_body_hash: requestBodyHash,
        p_idempotency_key: idempotencyKey,
        p_receipt_parser_contract: receiptParserContract,
        p_shadow_status: shadowStatus,
      },
    );

    if (recordError) {
      console.error("shadow persistence failed", recordError);
      return json({ error: "SHADOW_PERSISTENCE_FAILED" }, 500);
    }

    return json({
      shadow_run_id: recordedId,
      shadow_status: shadowStatus,
      production_endpoint_host: endpoint.hostname,
      credential_profile_present: credentialProfilePresent,
      tls_validated: tlsValidated,
      host_allowlisted: hostAllowlisted,
      protected_environment_approval_present: protectedEnvironmentApprovalPresent,
      request_method: "POST",
      request_headers: requestHeaders,
      request_body_hash: requestBodyHash,
      idempotency_key: idempotencyKey,
      receipt_parser_contract: receiptParserContract,
      network_probe_performed: false,
      application_payload_transmitted: false,
      production_execution_enabled: false,
      production_send_available: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "INTERNAL_ERROR";
    const blocked = [
      "PRODUCTION_ENDPOINT_NOT_CONFIGURED",
      "HTTPS_REQUIRED",
      "PRODUCTION_HOST_NOT_ALLOWLISTED",
      "PRODUCTION_HOST_IDENTITY_INVALID",
    ].includes(message);

    return json({
      error: message,
      network_probe_performed: false,
      application_payload_transmitted: false,
      production_execution_enabled: false,
      production_send_available: false,
    }, blocked ? 403 : 500);
  }
});
