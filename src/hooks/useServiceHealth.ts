import { useState, useEffect, useCallback } from "react";

export interface ServiceEndpoint {
  id: string;
  name: string;
  url: string;
  description: string;
  icon: string;
  category: 'frontend' | 'api' | 'database' | 'queue' | 'ai' | 'orchestration';
}

export interface ServiceStatus {
  id: string;
  name: string;
  url: string;
  status: "online" | "offline" | "checking" | "degraded" | "unknown";
  latency: number | null;
  lastChecked: Date | null;
  error?: string;
  details?: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.d3vonn.io';

const DEFAULT_ENDPOINTS: ServiceEndpoint[] = [
  {
    id: "frontend",
    name: "Frontend (d3vonn.io)",
    url: "https://d3vonn.io",
    description: "Main web application served via Vercel Edge Network",
    icon: "🌐",
    category: "frontend",
  },
  {
    id: "api-health",
    name: "API Gateway",
    url: `${API_BASE}/health`,
    description: "FastAPI backend orchestration service",
    icon: "⚡",
    category: "api",
  },
  {
    id: "supabase",
    name: "Supabase (Auth + DB)",
    url: "https://sognbkwualywq.supabase.co/rest/v1/",
    description: "Authentication, database, and real-time subscriptions",
    icon: "🗄️",
    category: "database",
  },
  {
    id: "redis-queue",
    name: "Redis / Queue",
    url: `${API_BASE}/health`,
    description: "Task queue and caching layer (checked via API health)",
    icon: "📦",
    category: "queue",
  },
  {
    id: "ai-providers",
    name: "AI Providers",
    url: `${API_BASE}/health`,
    description: "OpenAI, Anthropic, and HuggingFace model endpoints",
    icon: "🧠",
    category: "ai",
  },
  {
    id: "hermes",
    name: "Hermes Orchestration",
    url: `${API_BASE}/health`,
    description: "Intelligence fabric for cross-agent coordination",
    icon: "🔮",
    category: "orchestration",
  },
];

const STORAGE_KEY = "devonn-service-endpoints-v2";

export function useServiceHealth() {
  const [endpoints, setEndpoints] = useState<ServiceEndpoint[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate it has the category field (v2 format)
        if (parsed[0]?.category) return parsed;
      }
      return DEFAULT_ENDPOINTS;
    } catch {
      return DEFAULT_ENDPOINTS;
    }
  });

  const [statuses, setStatuses] = useState<Record<string, ServiceStatus>>({});
  const [isChecking, setIsChecking] = useState(false);
  const [lastSuccessfulExecution, setLastSuccessfulExecution] = useState<Date | null>(null);

  const saveEndpoints = useCallback((eps: ServiceEndpoint[]) => {
    setEndpoints(eps);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(eps));
  }, []);

  const checkService = useCallback(async (endpoint: ServiceEndpoint): Promise<ServiceStatus> => {
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      // Use different strategies based on endpoint type
      const fetchOptions: RequestInit = {
        method: "GET",
        signal: controller.signal,
      };

      // For same-origin or CORS-enabled endpoints, use cors mode
      if (endpoint.url.includes('api.d3vonn.io') || endpoint.url.includes('d3vonn.io')) {
        fetchOptions.mode = "cors";
      } else if (endpoint.url.includes('supabase.co')) {
        fetchOptions.mode = "cors";
        fetchOptions.headers = { 'Accept': 'application/json' };
      } else {
        fetchOptions.mode = "no-cors";
      }

      const response = await fetch(endpoint.url, fetchOptions);
      clearTimeout(timeout);
      const latency = Math.round(performance.now() - start);

      // For CORS requests, we can check the actual status
      if (fetchOptions.mode === "cors") {
        if (response.ok) {
          let details: string | undefined;
          try {
            const data = await response.json();
            if (data.version) details = `v${data.version}`;
            if (data.status === 'ok') details = details ? `${details} • healthy` : 'healthy';
          } catch {
            // Not JSON, but still OK
          }
          return {
            id: endpoint.id,
            name: endpoint.name,
            url: endpoint.url,
            status: "online",
            latency,
            lastChecked: new Date(),
            details,
          };
        } else if (response.status === 401 || response.status === 403) {
          // Auth-protected but responding = service is up
          return {
            id: endpoint.id,
            name: endpoint.name,
            url: endpoint.url,
            status: "online",
            latency,
            lastChecked: new Date(),
            details: "Protected endpoint responding",
          };
        } else {
          return {
            id: endpoint.id,
            name: endpoint.name,
            url: endpoint.url,
            status: "degraded",
            latency,
            lastChecked: new Date(),
            error: `HTTP ${response.status}`,
          };
        }
      }

      // For no-cors (opaque) responses, if we got here without error, it's up
      return {
        id: endpoint.id,
        name: endpoint.name,
        url: endpoint.url,
        status: "online",
        latency,
        lastChecked: new Date(),
      };
    } catch (err: any) {
      const latency = Math.round(performance.now() - start);
      return {
        id: endpoint.id,
        name: endpoint.name,
        url: endpoint.url,
        status: "offline",
        latency: err.name === "AbortError" ? null : latency,
        lastChecked: new Date(),
        error: err.name === "AbortError" ? "Timeout (8s)" : "Connection failed",
      };
    }
  }, []);

  const checkAll = useCallback(async () => {
    setIsChecking(true);
    // Mark all as checking
    const checking: Record<string, ServiceStatus> = {};
    endpoints.forEach((ep) => {
      checking[ep.id] = {
        id: ep.id,
        name: ep.name,
        url: ep.url,
        status: "checking",
        latency: null,
        lastChecked: null,
      };
    });
    setStatuses(checking);

    const results = await Promise.all(endpoints.map(checkService));
    const newStatuses: Record<string, ServiceStatus> = {};
    results.forEach((r) => { newStatuses[r.id] = r; });
    setStatuses(newStatuses);
    setIsChecking(false);

    // Track last successful execution
    const allOnline = results.every(r => r.status === 'online');
    if (allOnline) {
      setLastSuccessfulExecution(new Date());
    }
  }, [endpoints, checkService]);

  const addEndpoint = useCallback((endpoint: Omit<ServiceEndpoint, "id">) => {
    const newEp = { ...endpoint, id: crypto.randomUUID() };
    saveEndpoints([...endpoints, newEp]);
  }, [endpoints, saveEndpoints]);

  const updateEndpoint = useCallback((id: string, updates: Partial<ServiceEndpoint>) => {
    saveEndpoints(endpoints.map((ep) => (ep.id === id ? { ...ep, ...updates } : ep)));
  }, [endpoints, saveEndpoints]);

  const removeEndpoint = useCallback((id: string) => {
    saveEndpoints(endpoints.filter((ep) => ep.id !== id));
    setStatuses((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }, [endpoints, saveEndpoints]);

  const resetToDefaults = useCallback(() => {
    saveEndpoints(DEFAULT_ENDPOINTS);
  }, [saveEndpoints]);

  // Auto-check on mount and every 30 seconds
  useEffect(() => {
    checkAll();
    const interval = setInterval(checkAll, 30_000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    endpoints,
    statuses,
    isChecking,
    checkAll,
    addEndpoint,
    updateEndpoint,
    removeEndpoint,
    resetToDefaults,
    lastSuccessfulExecution,
  };
}
