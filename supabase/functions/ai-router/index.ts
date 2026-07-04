type Provider = "openai" | "anthropic" | "google" | "pinecone" | "twilio";
type Task = "chat" | "embeddings" | "rag" | "sms" | (string & {});

type RequestBody = {
  provider: Provider | "all";
  task: Task;
  input: Record<string, unknown>;
};

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_CHAT_MODEL = "gpt-4o-mini";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Connection": "keep-alive",
    },
  });
}

function getSecret(name: string, required = true) {
  const value = Deno.env.get(name);
  if (!value && required) throw new Error(`${name} secret is required`);
  return value || "";
}

function getUserId(req: Request) {
  // When Supabase Edge Functions are deployed with verify_jwt=true, the gateway
  // verifies the JWT before this handler runs. We only decode claims here for
  // observability; authorization stays at the platform layer.
  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const [, payload] = token.split(".");
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(normalized));
    return decoded.sub || null;
  } catch {
    return null;
  }
}

async function readJson(req: Request): Promise<RequestBody> {
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    throw new Error("Expected application/json");
  }
  return (await req.json()) as RequestBody;
}

async function readProviderResponse(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function handleOpenAIChat(input: Record<string, unknown>) {
  const OPENAI_API_KEY = getSecret("OPENAI_API_KEY");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(input),
  });

  const payload = await readProviderResponse(res);
  if (!res.ok) return { ok: false, status: res.status, payload };
  return { ok: true, payload };
}

async function embedText(input: string | string[]) {
  const OPENAI_API_KEY = getSecret("OPENAI_API_KEY");
  const model = getSecret("EMBEDDING_MODEL", false) || DEFAULT_EMBEDDING_MODEL;
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model, input }),
  });

  const payload = await readProviderResponse(res);
  if (!res.ok) return { ok: false, status: res.status, payload };
  return { ok: true, payload };
}

async function handleAnthropicChat(input: Record<string, unknown>) {
  const ANTHROPIC_API_KEY = getSecret("ANTHROPIC_API_KEY");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(input),
  });

  const payload = await readProviderResponse(res);
  if (!res.ok) return { ok: false, status: res.status, payload };
  return { ok: true, payload };
}

async function handleGoogleChat(input: Record<string, unknown>) {
  const GOOGLE_AI_API_KEY = getSecret("GOOGLE_AI_API_KEY");
  const model = String(input.model || "gemini-1.5-pro");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GOOGLE_AI_API_KEY)}`;

  const { model: _model, ...body } = input;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await readProviderResponse(res);
  if (!res.ok) return { ok: false, status: res.status, payload };
  return { ok: true, payload };
}

async function queryPinecone(vector: number[], input: Record<string, unknown>) {
  const PINECONE_API_KEY = getSecret("PINECONE_API_KEY");
  const PINECONE_HOST = getSecret("PINECONE_HOST").replace(/\/$/, "");
  const topK = Number(input.topK || 5);
  const namespace = typeof input.namespace === "string" ? input.namespace : undefined;
  const filter = input.filter && typeof input.filter === "object" ? input.filter : undefined;

  const res = await fetch(`${PINECONE_HOST}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": PINECONE_API_KEY,
    },
    body: JSON.stringify({
      vector,
      topK,
      namespace,
      filter,
      includeMetadata: true,
      includeValues: false,
    }),
  });

  const payload = await readProviderResponse(res);
  if (!res.ok) return { ok: false, status: res.status, payload };
  return { ok: true, payload };
}

function extractMatchText(match: Record<string, unknown>) {
  const metadata = (match.metadata || {}) as Record<string, unknown>;
  return (
    metadata.text ||
    metadata.content ||
    metadata.chunk ||
    metadata.markdown ||
    ""
  );
}

async function handlePineconeRag(input: Record<string, unknown>) {
  const query = String(input.query || "").trim();
  if (!query) throw new Error("RAG input requires { query: string }");

  const embedding = await embedText(query);
  if (!embedding.ok) return embedding;

  const vector = embedding.payload?.data?.[0]?.embedding;
  if (!Array.isArray(vector)) {
    return { ok: false, status: 502, payload: { error: "Embedding provider returned no vector" } };
  }

  const pinecone = await queryPinecone(vector, input);
  if (!pinecone.ok) return pinecone;

  const matches = Array.isArray(pinecone.payload?.matches) ? pinecone.payload.matches : [];
  const normalizedMatches = matches.map((match: Record<string, unknown>) => ({
    id: match.id,
    score: match.score,
    text: extractMatchText(match),
    metadata: match.metadata || {},
  }));

  if (input.answer !== true) {
    return {
      ok: true,
      payload: {
        query,
        matches: normalizedMatches,
      },
    };
  }

  const context = normalizedMatches
    .map((match: Record<string, unknown>, idx: number) => `SOURCE ${idx + 1}\n${match.text || ""}`)
    .join("\n\n---\n\n");

  const answer = await handleOpenAIChat({
    model: String(input.model || DEFAULT_CHAT_MODEL),
    messages: [
      {
        role: "system",
        content: "Answer using the retrieved D3VONN.IO knowledge context. If the context is insufficient, say what is missing.",
      },
      {
        role: "user",
        content: `Question:\n${query}\n\nRetrieved context:\n${context}`,
      },
    ],
  });

  if (!answer.ok) return answer;

  return {
    ok: true,
    payload: {
      query,
      matches: normalizedMatches,
      answer: answer.payload,
    },
  };
}

async function handleTwilioSMS(input: Record<string, unknown>) {
  const TWILIO_SID = getSecret("TWILIO_ACCOUNT_SID");
  const TWILIO_TOKEN = getSecret("TWILIO_AUTH_TOKEN");
  const FROM = getSecret("TWILIO_FROM_NUMBER");

  const to = String(input.to || "").trim();
  const bodyText = String(input.body || "").trim();
  if (!to) throw new Error("Twilio input requires { to: string }");
  if (!bodyText) throw new Error("Twilio input requires { body: string }");

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
  const form = new URLSearchParams({ From: FROM, To: to, Body: bodyText });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
    },
    body: form.toString(),
  });

  const payload = await readProviderResponse(res);
  if (!res.ok) return { ok: false, status: res.status, payload };
  return { ok: true, payload };
}

function pickProvider(provider: Provider | "all", task: Task): Provider {
  if (provider !== "all") return provider;
  if (task === "rag") return "pinecone";
  if (task === "sms") return "twilio";
  return "openai";
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed", requestId }, 405);
    }

    const body = await readJson(req);
    if (!body.provider) return json({ error: "Missing provider", requestId }, 400);
    if (!body.task) return json({ error: "Missing task", requestId }, 400);

    const provider = pickProvider(body.provider, body.task);
    const userId = getUserId(req);

    let result: { ok: boolean; status?: number; payload: unknown };
    if (body.task === "chat") {
      if (provider === "openai") result = await handleOpenAIChat(body.input || {});
      else if (provider === "anthropic") result = await handleAnthropicChat(body.input || {});
      else if (provider === "google") result = await handleGoogleChat(body.input || {});
      else return json({ error: `Provider ${provider} not supported for task=chat`, requestId }, 400);
    } else if (body.task === "embeddings") {
      if (provider !== "openai") return json({ error: "OpenAI provider required for task=embeddings", requestId }, 400);
      const input = body.input?.input;
      if (typeof input !== "string" && !Array.isArray(input)) {
        return json({ error: "Embeddings input requires { input: string | string[] }", requestId }, 400);
      }
      result = await embedText(input);
    } else if (body.task === "sms") {
      if (provider !== "twilio") return json({ error: "Twilio provider required for task=sms", requestId }, 400);
      result = await handleTwilioSMS(body.input || {});
    } else if (body.task === "rag") {
      if (provider !== "pinecone") return json({ error: "Pinecone provider required for task=rag", requestId }, 400);
      result = await handlePineconeRag(body.input || {});
    } else {
      return json({ error: `Unsupported task: ${body.task}`, requestId }, 400);
    }

    console.log(JSON.stringify({
      level: "info",
      requestId,
      userId,
      provider,
      task: body.task,
      durationMs: Date.now() - startedAt,
      ok: result.ok,
      status: result.status || 200,
    }));

    if (!result.ok) return json({ requestId, ...(result.payload as Record<string, unknown>) }, result.status || 500);
    return json({ requestId, ...(result.payload as Record<string, unknown>) });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(JSON.stringify({
      level: "error",
      requestId,
      durationMs: Date.now() - startedAt,
      error: message,
    }));
    return json({ error: message, requestId }, 500);
  }
});
