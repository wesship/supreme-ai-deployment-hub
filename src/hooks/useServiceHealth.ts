import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ServiceEndpoint {
  id: string;
  name: string;
  url: string;
  description: string;
  icon: string;
  category:
    | "frontend"
    | "api"
    | "database"
    | "queue"
    | "ai"
    | "orchestration";
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

interface ServerHealthService {
  id: "frontend" | "api-health";
  name: string;
  status: "online" | "offline" | "degraded";
  latency: number | null;
  error?: string;
  details?: string;
}

interface ServerHealthSnapshot {
  checkedAt: string;
  services: ServerHealthService[];
}

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://tjygexesognbkwualywq.supabase.co";

const DEFAULT_ENDPOINTS: ServiceEndpoint[] = [
  {
    id: "frontend",
    name: "Frontend & Edge",
    url: "/api/status-health",
    description: "Public web application and same-origin status endpoint",
    icon: "🌐",
    category: "frontend",
  },
  {
    id: "api-health",
    name: "API Gateway",
    url: "/api/status-health",
    description: "Public backend health endpoint",
    icon: "⚡",
    category: "api",
  },
  {
    id: "supabase-schema",
    name: "Supabase Schema Readiness",
    url: `${SUPABASE_URL}/rest/v1/rpc/dashboard_schema_readiness`,
    description:
      "Required dashboard tables, columns, authentication, and database readiness",
    icon: "🗄️",
    category: "database",
  },
];

function monitorUnavailable(): ServiceStatus[] {
  const checkedAt = new Date();
  return [
    {
      id: "frontend",
      name: "Frontend & Edge",
      url: "/api/status-health",
      status: "online",
      latency: null,
      lastChecked: checkedAt,
      details: "Web application loaded; server monitor unavailable",
    },
    {
      id: "api-health",
      name: "API Gateway",
      url: "/api/status-health",
      status: "unknown",
      latency: null,
      lastChecked: checkedAt,
      error: "Server-side health monitor unavailable",
    },
  ];
}

export function useServiceHealth() {
  const [statuses, setStatuses] = useState<Record<string, ServiceStatus>>({});
  const [isChecking, setIsChecking] = useState(false);
  const [lastSuccessfulExecution, setLastSuccessfulExecution] =
    useState<Date | null>(null);
  const checkInFlight = useRef(false);

  const checkPlatformHealth = useCallback(async (): Promise<ServiceStatus[]> => {
    try {
      const response = await fetch("/api/status-health", {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) return monitorUnavailable();

      const snapshot = (await response.json()) as ServerHealthSnapshot;
      const checkedAt = new Date(snapshot.checkedAt);

      if (
        !Array.isArray(snapshot.services) ||
        Number.isNaN(checkedAt.getTime())
      ) {
        return monitorUnavailable();
      }

      return snapshot.services.map((service) => ({
        id: service.id,
        name: service.name,
        url: "/api/status-health",
        status: service.status,
        latency: service.latency,
        lastChecked: checkedAt,
        error: service.error,
        details: service.details,
      }));
    } catch {
      return monitorUnavailable();
    }
  }, []);

  const checkSchemaReadiness =
    useCallback(async (): Promise<ServiceStatus> => {
      const endpoint = DEFAULT_ENDPOINTS[2];
      const startedAt = performance.now();

      try {
        const { data, error } = await (supabase as any).rpc(
          "dashboard_schema_readiness",
        );
        const latency = Math.round(performance.now() - startedAt);

        if (error) {
          return {
            id: endpoint.id,
            name: endpoint.name,
            url: endpoint.url,
            status: "degraded",
            latency,
            lastChecked: new Date(),
            error: `Schema readiness failed: ${
              error.message ?? "RPC unavailable"
            }`,
          };
        }

        const readiness = Array.isArray(data) ? data[0] : data;
        if (!readiness?.ready) {
          const missing = Array.isArray(readiness?.missing)
            ? readiness.missing.join(", ")
            : "required dashboard schema";

          return {
            id: endpoint.id,
            name: endpoint.name,
            url: endpoint.url,
            status: "degraded",
            latency,
            lastChecked: new Date(),
            error: `Missing: ${missing}`,
            details: "Database reachable; schema incomplete",
          };
        }

        return {
          id: endpoint.id,
          name: endpoint.name,
          url: endpoint.url,
          status: "online",
          latency,
          lastChecked: new Date(),
          details: "Dashboard schema ready",
        };
      } catch {
        return {
          id: endpoint.id,
          name: endpoint.name,
          url: endpoint.url,
          status: "offline",
          latency: Math.round(performance.now() - startedAt),
          lastChecked: new Date(),
          error: "Schema readiness endpoint unreachable",
        };
      }
    }, []);

  const checkAll = useCallback(async () => {
    if (checkInFlight.current) return;

    checkInFlight.current = true;
    setIsChecking(true);

    const checking: Record<string, ServiceStatus> = {};
    DEFAULT_ENDPOINTS.forEach((endpoint) => {
      checking[endpoint.id] = {
        id: endpoint.id,
        name: endpoint.name,
        url: endpoint.url,
        status: "checking",
        latency: null,
        lastChecked: null,
      };
    });
    setStatuses(checking);

    try {
      const [platform, schema] = await Promise.all([
        checkPlatformHealth(),
        checkSchemaReadiness(),
      ]);
      const results = [...platform, schema];
      const nextStatuses: Record<string, ServiceStatus> = {};
      results.forEach((result) => {
        nextStatuses[result.id] = result;
      });
      setStatuses(nextStatuses);

      if (results.every((result) => result.status === "online")) {
        setLastSuccessfulExecution(new Date());
      }
    } finally {
      checkInFlight.current = false;
      setIsChecking(false);
    }
  }, [checkPlatformHealth, checkSchemaReadiness]);

  useEffect(() => {
    void checkAll();
  }, [checkAll]);

  return {
    endpoints: DEFAULT_ENDPOINTS,
    statuses,
    isChecking,
    checkAll,
    lastSuccessfulExecution,
  };
}
