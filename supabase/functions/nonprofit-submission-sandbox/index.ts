import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SANDBOX_ENDPOINT = Deno.env.get("NONPROFIT_SANDBOX_SUBMISSION_ENDPOINT") || "";
const ALLOWED_HOSTS = new Set(
  (Deno.env.get("NONPROFIT_SANDBOX_ALLOWED_HOSTS") || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const deniedProductionHosts = new Set([
  "grants.gov",
  "www.grants.gov",
  "apply07.grants.gov",
  "sam.gov",
  "www.sam.gov",
]);

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

function validateSandboxEndpoint(raw: string) {
  if (!raw) throw new Error("SANDBOX_ENDPOINT_NOT_CONFIGURED");

  const endpoint = new URL(raw);
  const host = endpoint.hostname.toLowerCase();

  if (endpoint.protocol !== "https:") throw new Error("HTTPS_REQUIRED");
  if (!ALLOWED_HOSTS.has(host)) throw new Error("SANDBOX_HOST_NOT_ALLOWLISTED");
  if (deniedProductionHosts.has(host) || host.endsWith(".grants.gov") || host.endsWith(".sam.gov")) {
    throw new Error("PRODUCTION_DOMAIN_BLOCKED");
  }

  const clearlyNonProduction =
    host.includes("sandbox") ||
    host.includes("staging") ||
    host.includes("test") ||
    host.includes("dev");

  if (!clearlyNonProduction) throw new Error("NON_PRODUCTION_HOST_MARKER_REQUIRED");

  return endpoint;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const endpoint = validateSandboxEndpoint(SANDBOX_ENDPOINT);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "INVALID_TOKEN" }, 401);

    const requestBody = await req.json();
    const certificationId = requestBody?.certification_id;
    if (!certificationId || typeof certificationId !== "string") {
      return json({ error: "certification_id required" }, 400);
    }

    const { data: preparedRows, error: prepareError } = await userClient.rpc(
      "nonprofit_prepare_external_sandbox_transmission",
      { p_certification_id: certificationId },
    );

    if (prepareError) {
      return json({ error: prepareError.message, code: "PREPARE_BLOCKED" }, 403);
    }

    const prepared = Array.isArray(preparedRows) ? preparedRows[0] : preparedRows;
    if (!prepared) return json({ error: "TRANSMISSION_ENVELOPE_NOT_CREATED" }, 500);

    const payload = prepared.frozen_payload;
    const certifiedHash = prepared.payload_hash as string;
    const idempotencyKey = prepared.idempotency_key as string;
    const transmissionId = prepared.transmission_id as string;

    const outboundBody = JSON.stringify({
      schema_version: "grantassist.external-sandbox.v1",
      mode: "SANDBOX_ONLY",
      certification_id: certificationId,
      workflow_id: prepared.workflow_id,
      connector_kind: prepared.connector_kind,
      payload_sha256: certifiedHash,
      payload,
    });

    let response: Response;
    let responseText = "";
    let responseBodyHash: string | null = null;
    let receiptHash: string | null = null;
    let receiptId: string | null = null;

    try {
      response = await fetch(endpoint.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
          "X-GrantAssist-Mode": "sandbox",
          "X-GrantAssist-Payload-SHA256": certifiedHash,
        },
        body: outboundBody,
        signal: AbortSignal.timeout(15_000),
      });

      responseText = await response.text();
      responseBodyHash = await sha256Text(responseText);

      const headerReceiptHash = response.headers.get("x-grantassist-received-sha256");
      const headerReceiptId = response.headers.get("x-grantassist-receipt-id");

      receiptHash = headerReceiptHash;
      receiptId = headerReceiptId;

      if (!receiptHash && responseText) {
        try {
          const parsed = JSON.parse(responseText);
          receiptHash = parsed?.received_payload_hash || parsed?.payload_sha256 || null;
          receiptId = receiptId || parsed?.receipt_id || null;
        } catch {
          // A non-JSON response is acceptable only if the required receipt hash header exists.
        }
      }

      const hashVerified = receiptHash === certifiedHash;
      const acknowledged = response.ok && hashVerified;
      const requestStatus = acknowledged ? "ACKNOWLEDGED" : "FAILED";

      const { error: receiptError } = await serviceClient.rpc(
        "record_external_sandbox_receipt",
        {
          p_transmission_id: transmissionId,
          p_endpoint_host: endpoint.hostname,
          p_request_status: requestStatus,
          p_response_status: response.status,
          p_response_body_hash: responseBodyHash,
          p_response_receipt: {
            receipt_id: receiptId,
            received_payload_hash: receiptHash,
            certified_payload_hash: certifiedHash,
            hash_verified: hashVerified,
            content_type: response.headers.get("content-type"),
          },
        },
      );

      if (receiptError) {
        console.error("receipt persistence failed", receiptError);
        return json({ error: "RECEIPT_PERSISTENCE_FAILED" }, 500);
      }

      if (!acknowledged) {
        return json({
          transmission_id: transmissionId,
          status: "FAILED",
          endpoint_host: endpoint.hostname,
          response_status: response.status,
          certified_payload_hash: certifiedHash,
          received_payload_hash: receiptHash,
          hash_verified: hashVerified,
          production_destination: false,
        }, 502);
      }

      return json({
        transmission_id: transmissionId,
        status: "ACKNOWLEDGED",
        endpoint_host: endpoint.hostname,
        response_status: response.status,
        receipt_id: receiptId,
        certified_payload_hash: certifiedHash,
        received_payload_hash: receiptHash,
        hash_verified: true,
        idempotency_key: idempotencyKey,
        production_destination: false,
      });
    } catch (networkError) {
      const message = networkError instanceof Error ? networkError.message : "NETWORK_FAILURE";

      const { error: receiptError } = await serviceClient.rpc(
        "record_external_sandbox_receipt",
        {
          p_transmission_id: transmissionId,
          p_endpoint_host: endpoint.hostname,
          p_request_status: "FAILED",
          p_response_status: null,
          p_response_body_hash: null,
          p_response_receipt: {
            error: message,
            certified_payload_hash: certifiedHash,
            hash_verified: false,
          },
        },
      );

      if (receiptError) console.error("failed to persist network failure", receiptError);
      return json({ error: "SANDBOX_NETWORK_FAILURE", detail: message }, 502);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "INTERNAL_ERROR";
    const blocked = [
      "SANDBOX_ENDPOINT_NOT_CONFIGURED",
      "HTTPS_REQUIRED",
      "SANDBOX_HOST_NOT_ALLOWLISTED",
      "PRODUCTION_DOMAIN_BLOCKED",
      "NON_PRODUCTION_HOST_MARKER_REQUIRED",
    ].includes(message);

    return json({ error: message, production_destination: false }, blocked ? 403 : 500);
  }
});
