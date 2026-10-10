import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

type EvidenceItem = {
  id: string;
  source: string;
  title: string;
  url?: string;
  snippet?: string;
  score?: number;
  score_reasons?: string[];
};

type ResearchResponse = {
  summary: string;
  plan: {
    intent: string;
    routes: Array<{ source: string; reason: string; priority: number }>;
    token_strategy: string;
    lead_enrichment_recommended: boolean;
  };
  evidence: EvidenceItem[];
  leads: Array<{ company?: string; person?: string; website?: string; confidence?: number }>;
  enrichment?: { status: string; submitted: number; message?: string };
  dkos?: { status: string; records: number; message?: string };
};

export default function ResearchOS() {
  const [query, setQuery] = useState("Find companies that need AI automation in insurance");
  const [enrichLeads, setEnrichLeads] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runResearch() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/research/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          enrich_leads: enrichLeads,
          save_to_dkos: true,
          max_results_per_source: 5,
          metadata: { origin: "research_os_dashboard" },
        }),
      });

      if (!response.ok) {
        throw new Error(`Research OS request failed: ${response.status}`);
      }

      setResult(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown Research OS error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 rounded-3xl border border-cyan-400/20 bg-slate-900/70 p-8 shadow-2xl shadow-cyan-950/30">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Hermes Research OS</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">Internet Eyes + Lead Intelligence</h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-300">
            Route Hermes across GitHub, YouTube, Reddit, X/Grok, LinkedIn, web/RSS, score the evidence first, then push qualified leads to Clay and DKOS.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <label className="text-sm font-semibold text-slate-300" htmlFor="research-query">Research command</label>
            <textarea
              id="research-query"
              className="mt-3 min-h-36 w-full rounded-xl border border-slate-700 bg-slate-950 p-4 text-slate-100 outline-none ring-cyan-400/30 focus:ring-4"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={enrichLeads}
                  onChange={(event) => setEnrichLeads(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-950"
                />
                Queue extracted leads for Clay enrichment
              </label>
              <button
                onClick={runResearch}
                disabled={loading || query.trim().length < 3}
                className="rounded-xl bg-cyan-300 px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Researching..." : "Run Research OS"}
              </button>
            </div>
            {error && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-950/40 p-3 text-red-200">{error}</p>}
          </div>

          <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-bold">Runtime Checklist</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li>Agent Reach installed in Python runtime</li>
              <li>Optional: GITHUB_TOKEN, YOUTUBE_API_KEY</li>
              <li>Optional: CLAY_WEBHOOK_URL</li>
              <li>DKOS: SUPABASE_URL + SERVICE_ROLE_KEY</li>
              <li>Scheduled monitoring via Hermes/Railway cron</li>
            </ul>
          </aside>
        </div>

        {result && (
          <div className="mt-8 space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-2xl font-bold">Executive Summary</h2>
              <p className="mt-3 text-slate-300">{result.summary}</p>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <Metric label="Intent" value={result.plan.intent} />
                <Metric label="Evidence" value={String(result.evidence.length)} />
                <Metric label="Leads" value={String(result.leads.length)} />
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <h2 className="text-xl font-bold">Routes</h2>
                <div className="mt-4 space-y-3">
                  {result.plan.routes.map((route) => (
                    <div key={`${route.source}-${route.priority}`} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-bold text-cyan-200">{route.source}</span>
                        <span className="text-xs text-slate-400">priority {route.priority}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">{route.reason}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <h2 className="text-xl font-bold">Clay + DKOS</h2>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <p>Clay: {result.enrichment?.status || "not requested"} {result.enrichment?.submitted ? `(${result.enrichment.submitted} submitted)` : ""}</p>
                  {result.enrichment?.message && <p className="text-slate-400">{result.enrichment.message}</p>}
                  <p>DKOS: {result.dkos?.status || "unknown"} {result.dkos?.records ? `(${result.dkos.records} records)` : ""}</p>
                  {result.dkos?.message && <p className="text-slate-400">{result.dkos.message}</p>}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-bold">Ranked Evidence</h2>
              <div className="mt-4 space-y-4">
                {result.evidence.map((item) => (
                  <article key={item.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">{item.source}</p>
                        <h3 className="mt-1 font-bold text-slate-100">{item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="hover:text-cyan-200">{item.title}</a> : item.title}</h3>
                      </div>
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">score {item.score?.toFixed(2) ?? "0.00"}</span>
                    </div>
                    {item.snippet && <p className="mt-3 text-sm text-slate-400">{item.snippet.slice(0, 420)}</p>}
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-cyan-200">{value}</p>
    </div>
  );
}
