// Integration test for the openai-proxy edge function.
// Sends a real chat-completion request through the deployed proxy and
// verifies the response shape matches the OpenAI chat completions API.
//
// Requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in the project .env
// (loaded automatically below) and a valid OPENAI_API_KEY secret on the server.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/openai-proxy`;

function authHeaders(extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
    ...extra,
  };
}

Deno.test("openai-proxy returns a valid chat completion for a sample request", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a terse test assistant. Reply with a single short sentence." },
        { role: "user", content: "Say the word 'pong' and nothing else." },
      ],
      temperature: 0,
      max_tokens: 16,
    }),
  });

  const rawText = await response.text();
  assertEquals(
    response.status,
    200,
    `Expected 200, got ${response.status}. Body: ${rawText.slice(0, 500)}`,
  );

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`Response was not valid JSON: ${rawText.slice(0, 500)}`);
  }

  // Validate OpenAI chat-completion response shape
  assertExists(data.id, "Response missing 'id'");
  assertEquals(data.object, "chat.completion");
  assertExists(data.model, "Response missing 'model'");
  assert(Array.isArray(data.choices) && data.choices.length > 0, "Response missing 'choices[]'");

  const choice = data.choices[0];
  assertExists(choice.message, "Choice missing 'message'");
  assertEquals(choice.message.role, "assistant");
  assert(
    typeof choice.message.content === "string" && choice.message.content.length > 0,
    "Assistant message content should be a non-empty string",
  );

  assertExists(data.usage, "Response missing 'usage'");
  assert(typeof data.usage.total_tokens === "number", "usage.total_tokens should be a number");
});

Deno.test("openai-proxy rejects requests missing model/messages with 400", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ foo: "bar" }),
  });

  const text = await response.text();
  assertEquals(response.status, 400, `Expected 400, got ${response.status}. Body: ${text.slice(0, 200)}`);
});

Deno.test("openai-proxy responds to CORS preflight (OPTIONS)", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "OPTIONS",
    headers: {
      Origin: "https://example.com",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization, content-type",
    },
  });
  await response.text();
  assert(
    response.status === 200 || response.status === 204,
    `Expected 200/204 for OPTIONS, got ${response.status}`,
  );
  assertEquals(response.headers.get("access-control-allow-origin"), "*");
});
