import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hermes-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const signature = req.headers.get("x-hermes-signature");
    const webhookSecret = Deno.env.get("HERMES_WEBHOOK_SECRET");
    if (!webhookSecret) return json({ error: "Server misconfiguration." }, 500);
    if (!signature) return json({ error: "Unauthorized. Missing X-Hermes-Signature header." }, 401);

    const bodyText = await req.text();
    if (!(await verifyHMACSignature(bodyText, signature, webhookSecret))) {
      return json({ error: "Forbidden. Invalid signature." }, 403);
    }

    const body = JSON.parse(bodyText);
    const kind = body.kind;
    const goalId = body.goal_id;
    const taskPayload = body.task_payload ?? body.payload ?? {};

    if (!kind || !goalId) {
      return json({ error: "Missing required fields: 'kind' and 'goal_id'." }, 400);
    }

    const allowedKinds = ["tars.plan", "tars.research", "tars.summarize", "tars.followup"];
    if (!allowedKinds.includes(kind)) {
      return json({ error: `Unknown task kind '${kind}'. Allowed: ${allowedKinds.join(", ")}` }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: task, error } = await supabase
      .from("hermes_tasks")
      .insert({
        kind,
        goal_id: goalId,
        payload: taskPayload,
        input_data: taskPayload,
        title: body.title || `External ${kind} Task`,
        description: body.description || "Enqueued via HMAC webhook",
        status: "PENDING",
        depth: 0,
        max_depth: body.max_depth ?? 3,
        task_type: "external_webhook",
        source: "enqueue-task",
        priority: 5,
        retry_count: 0,
        agent_name: "TARS",
      })
      .select()
      .single();

    if (error) throw error;

    return json({ success: true, task_id: task.id, kind, goal_id: goalId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[enqueue-task] Error:", message);
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyHMACSignature(bodyText: string, signature: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyText));
  const calculated = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (calculated.length !== signature.length) return false;

  let diff = 0;
  for (let i = 0; i < calculated.length; i += 1) {
    diff |= calculated.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}
