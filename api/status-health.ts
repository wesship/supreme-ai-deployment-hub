type HealthState = "online" | "offline" | "degraded";

interface HealthService {
  id: "frontend" | "api-health";
  name: string;
  description: string;
  icon: string;
  category: "frontend" | "api";
  status: HealthState;
  latency: number | null;
  details?: string;
  error?: string;
}

interface HealthSnapshot {
  checkedAt: string;
  services: HealthService[];
}

type FetchResponse = Pick<Response, "ok" | "status" | "json">;
type Fetcher = (
  input: string,
  init?: RequestInit,
) => Promise<FetchResponse>;

const runtimeEnv =
  (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env ?? {};

const API_BASE =
  runtimeEnv.D3VONN_API_URL ||
  runtimeEnv.DEVONN_API_URL ||
  runtimeEnv.API_URL ||
  runtimeEnv.VITE_D3VONN_API_URL ||
  runtimeEnv.VITE_DEVONN_API_URL ||
  runtimeEnv.VITE_API_URL ||
  "https://devonn-ai-api.up.railway.app";

function apiDetails(data: unknown): string {
  if (!data || typeof data !== "object") return "Healthy response received";

  const payload = data as Record<string, unknown>;
  const version =
    typeof payload.version === "string" ? "v" + payload.version : undefined;
  const state =
    payload.status === "ok" || payload.status === "healthy"
      ? "healthy"
      : undefined;

  return [version, state].filter(Boolean).join(" • ") ||
    "Healthy response received";
}

async function checkApi(
  fetcher: Fetcher,
  apiBase: string,
): Promise<HealthService> {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);

  try {
    const response = await fetcher(
      apiBase.replace(/\/+$/, "") + "/health",
      {
        method: "GET",
        headers: { Accept: "application/json" },
        redirect: "follow",
        signal: controller.signal,
      },
    );
    const latency = Math.round(performance.now() - startedAt);

    if (response.ok) {
      let details = "Healthy response received";
      try {
        details = apiDetails(await response.json());
      } catch {
        // A successful non-JSON response still proves the endpoint is online.
      }

      return {
        id: "api-health",
        name: "API Gateway",
        description: "Public backend health endpoint",
        icon: "⚡",
        category: "api",
        status: "online",
        latency,
        details,
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        id: "api-health",
        name: "API Gateway",
        description: "Public backend health endpoint",
        icon: "⚡",
        category: "api",
        status: "online",
        latency,
        details: "Protected endpoint responding",
      };
    }

    return {
      id: "api-health",
      name: "API Gateway",
      description: "Public backend health endpoint",
      icon: "⚡",
      category: "api",
      status: "degraded",
      latency,
      error: "Health endpoint returned HTTP " + response.status,
    };
  } catch (error) {
    const timedOut =
      error instanceof Error && error.name === "AbortError";

    return {
      id: "api-health",
      name: "API Gateway",
      description: "Public backend health endpoint",
      icon: "⚡",
      category: "api",
      status: "offline",
      latency: timedOut
        ? null
        : Math.round(performance.now() - startedAt),
      error: timedOut
        ? "Health check timed out"
        : "Health endpoint unreachable",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function createHealthSnapshot(
  fetcher: Fetcher = fetch,
  apiBase = API_BASE,
): Promise<HealthSnapshot> {
  const api = await checkApi(fetcher, apiBase);

  return {
    checkedAt: new Date().toISOString(),
    services: [
      {
        id: "frontend",
        name: "Frontend & Edge",
        description: "Public web application and same-origin status endpoint",
        icon: "🌐",
        category: "frontend",
        status: "online",
        latency: 0,
        details: "Status endpoint responding",
      },
      api,
    ],
  };
}

export async function GET(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return Response.json(
      { error: "Method not allowed" },
      {
        status: 405,
        headers: { Allow: "GET" },
      },
    );
  }

  const snapshot = await createHealthSnapshot();

  return Response.json(snapshot, {
    headers: {
      "Cache-Control":
        "public, max-age=0, s-maxage=20, stale-while-revalidate=40",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
