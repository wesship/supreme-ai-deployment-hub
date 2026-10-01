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
    const action = body?.action;

    if (action === "authorize") {
      const releaseCertificateId = body?.release_certificate_id;
      const payloadHash = body?.payload_hash;
      const confirmationPhrase = body?.confirmation_phrase;
      if (typeof releaseCertificateId !== "string" || typeof payloadHash !== "string" || typeof confirmationPhrase !== "string") {
        return json({ error: "release_certificate_id, payload_hash, and confirmation_phrase required" }, 400);
      }
      const { data: rows, error } = await client.rpc("nonprofit_authorize_irreversible_production_action", {
        p_release_certificate_id: releaseCertificateId,
        p_payload_hash: payloadHash,
        p_confirmation_phrase: confirmationPhrase,
      });
      if (error) return json({ error: error.message, code: "IRREVERSIBLE_APPROVAL_BLOCKED" }, 403);
      const result = Array.isArray(rows) ? rows[0] : rows;
      return json({
        ...result,
        human_confirmation_required: true,
        exact_phrase_required: "AUTHORIZE IRREVERSIBLE PRODUCTION SUBMISSION",
        production_send_available: false,
        production_execution_enabled: false,
        network_request_performed: false,
        application_payload_transmitted: false,
      });
    }

    if (action === "claim") {
      const approvalId = body?.approval_id;
      const expectedPayloadHash = body?.expected_payload_hash;
      if (typeof approvalId !== "string" || typeof expectedPayloadHash !== "string") {
        return json({ error: "approval_id and expected_payload_hash required" }, 400);
      }
      const { data: rows, error } = await client.rpc("nonprofit_claim_irreversible_production_action", {
        p_approval_id: approvalId,
        p_expected_payload_hash: expectedPayloadHash,
      });
      if (error) return json({ error: error.message, code: "IRREVERSIBLE_CLAIM_BLOCKED" }, 403);
      const result = Array.isArray(rows) ? rows[0] : rows;
      return json({
        ...result,
        one_time_claimed: true,
        production_send_available: false,
        production_execution_enabled: false,
        network_request_performed: false,
        application_payload_transmitted: false,
        next_gate_required: "live production connector transmission implementation",
      });
    }

    return json({ error: "action must be authorize or claim" }, 400);
  } catch (error) {
    return json({
      error: error instanceof Error ? error.message : "INTERNAL_ERROR",
      production_send_available: false,
      production_execution_enabled: false,
      network_request_performed: false,
      application_payload_transmitted: false,
    }, 500);
  }
});