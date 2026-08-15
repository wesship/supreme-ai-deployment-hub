import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" };
}

export function requireServiceRole(req: Request): boolean {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return false;
  try {
    const part = token.split(".")[1];
    if (!part) return false;
    const normalized = part
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(part.length / 4) * 4, "=");
    const payload = JSON.parse(atob(normalized));
    return payload?.role === "service_role";
  } catch {
    return false;
  }
}

export const getSupabaseClient = () => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase service configuration missing");
  return createClient(url, key);
};

export async function callLLM(messages: ChatMessage[], options: LLMOptions = {}) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  const baseUrl = Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1";
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model || "gpt-4o-mini",
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.max_tokens,
      response_format: options.response_format,
    }),
  });
  if (!response.ok) throw new Error(`LLM call failed: ${response.status}`);
  const data = await response.json();
  return data.choices[0].message.content;
}

export async function recordTaskEvent(
  supabase: any,
  taskId: string,
  goalId: string,
  type: string,
  payload: any,
) {
  const { error } = await supabase.from("hermes_events").insert({
    task_id: taskId,
    goal_id: goalId,
    type,
    payload,
    created_at: new Date().toISOString(),
  });
  if (error) console.error("recordTaskEvent", error.message);
}

export async function recordCheckpoint(
  supabase: any,
  taskId: string,
  goalId: string,
  title: string,
  content: string,
  metadata: any = {},
) {
  const { error } = await supabase.from("hermes_checkpoints").insert({
    task_id: taskId,
    goal_id: goalId,
    title,
    content,
    metadata,
    created_at: new Date().toISOString(),
  });
  if (error) console.error("recordCheckpoint", error.message);
}
