import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Fingerprint,
  GitCommit,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Acknowledgement {
  id: string;
  status: string;
  commit_sha: string | null;
  canonical_context_version: string | null;
  canonical_context_sha256: string | null;
  verification_status: string | null;
  created_at: string | null;
  completed_at: string | null;
  correlation_id: string | null;
}

interface RecencyStatus {
  status: "synchronized" | "attention_required" | "never_synchronized";
  synchronized: boolean;
  pending_manual_review: number;
  runtime: {
    mode: string | null;
    deployed_commit_sha: string | null;
    canonical_context: {
      present?: boolean;
      version?: string | null;
      content_sha256?: string | null;
      source?: string | null;
    };
  };
  latest_acknowledgement: Acknowledgement | null;
  last_verified: Acknowledgement | null;
}

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  "https://api.d3vonn.io"
).replace(/\/$/, "");

function short(value: string | null | undefined, length = 12) {
  if (!value) return "Unavailable";
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString();
}

export default function OCCRecencyStatus() {
  const [data, setData] = useState<RecencyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("An authenticated operator session is required.");

      const response = await fetch(`${API_BASE}/api/hermes/recency/status`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const detail =
          body && typeof body === "object" && "detail" in body
            ? (body as { detail: unknown }).detail
            : null;
        const message =
          typeof detail === "string"
            ? detail
            : detail
              ? JSON.stringify(detail)
              : `Recency status request failed (${response.status})`;
        throw new Error(message);
      }
      setData(body as RecencyStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load recency status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const healthy = data?.status === "synchronized";
  const attention = data?.status === "attention_required";
  const verified = data?.last_verified;
  const canonical = data?.runtime.canonical_context;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-blue-300/15 bg-gradient-to-br from-blue-500/[0.08] via-black/20 to-emerald-500/[0.05] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`grid h-11 w-11 place-items-center rounded-xl border ${
              healthy
                ? "border-emerald-300/20 bg-emerald-400/10"
                : attention
                  ? "border-amber-300/20 bg-amber-400/10"
                  : "border-white/10 bg-white/[0.04]"
            }`}>
              {healthy ? (
                <ShieldCheck className="h-5 w-5 text-emerald-300" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-300" />
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-blue-200/55">
                Canonical intelligence
              </p>
              <h2 className="mt-1 text-xl font-semibold text-white">
                {healthy
                  ? "Knowledge is synchronized"
                  : attention
                    ? "Operator review required"
                    : "Synchronization not yet proven"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
                Reconciles the context running in Railway with the most recent verified Hermes acknowledgement.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={loading}
            className="border-white/15 bg-white/[0.03] text-white hover:bg-white/[0.07]"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Runtime mode",
                value: data.runtime.mode || "unknown",
                detail: canonical?.source || "source unavailable",
                icon: Database,
              },
              {
                label: "Context version",
                value: canonical?.version || "unversioned",
                detail: canonical?.present === false ? "not present" : "deployed repository",
                icon: CheckCircle2,
              },
              {
                label: "Deployed commit",
                value: short(data.runtime.deployed_commit_sha),
                detail: short(verified?.commit_sha),
                title: data.runtime.deployed_commit_sha,
                icon: GitCommit,
              },
              {
                label: "Manual reviews",
                value: String(data.pending_manual_review),
                detail: data.pending_manual_review ? "attention required" : "queue clear",
                icon: AlertTriangle,
              },
            ].map(({ label, value, detail, title, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <Icon className="h-5 w-5 text-blue-200" aria-hidden="true" />
                <p className="mt-4 text-xs uppercase tracking-[0.14em] text-white/35">{label}</p>
                <p className="mt-2 font-mono text-sm font-semibold text-white" title={title || value}>
                  {value}
                </p>
                <p className="mt-1 text-xs text-white/35">{detail}</p>
              </div>
            ))}
          </div>

          <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="flex items-center gap-2">
                <Fingerprint className="h-5 w-5 text-blue-200" aria-hidden="true" />
                <h3 className="font-semibold text-white">Canonical fingerprint</h3>
              </div>
              <dl className="mt-5 space-y-4 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-white/35">Runtime SHA-256</dt>
                  <dd className="mt-1 break-all font-mono text-xs text-blue-100" title={canonical?.content_sha256 || undefined}>
                    {canonical?.content_sha256 || "Unavailable"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-white/35">Last verified SHA-256</dt>
                  <dd className="mt-1 break-all font-mono text-xs text-blue-100" title={verified?.canonical_context_sha256 || undefined}>
                    {verified?.canonical_context_sha256 || "Unavailable"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="flex items-center gap-2">
                <Clock3 className="h-5 w-5 text-emerald-300" aria-hidden="true" />
                <h3 className="font-semibold text-white">Last verified synchronization</h3>
              </div>
              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-1">
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-white/35">Task state</dt>
                  <dd className="mt-1 font-semibold text-emerald-200">{verified?.status || "Unavailable"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-white/35">Completed</dt>
                  <dd className="mt-1 text-white/70">{formatDate(verified?.completed_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-white/35">Verification</dt>
                  <dd className="mt-1 text-white/70">{verified?.verification_status || "Unavailable"}</dd>
                </div>
              </dl>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
