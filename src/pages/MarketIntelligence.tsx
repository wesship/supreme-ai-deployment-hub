import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

type ProviderName = "koyfin" | "finviz" | "messari" | "hermes_research_os";
type AssetClass = "equity" | "etf" | "crypto" | "macro" | "mixed";

type ProviderStatus = {
  provider: ProviderName;
  enabled: boolean;
  configured: boolean;
  mode: "read_only" | "research_router";
  execution_enabled: boolean;
  notes: string;
};

type MarketSignal = {
  provider: ProviderName;
  asset_class: AssetClass;
  symbol?: string | null;
  title: string;
  summary: string;
  source_url?: string | null;
  confidence: number;
  tags: string[];
};

type MarketResponse = {
  schema: "d3vonn.market-intelligence.v1";
  status: "ready" | "configuration_required";
  providers: ProviderStatus[];
  routing: {
    orchestrator: "hermes";
    research_layer: "backend.research_os";
    execution_allowed: boolean;
    signing_allowed: boolean;
    broadcast_allowed: boolean;
    workflow: string[];
  };
  signals: MarketSignal[];
  provider_errors: Record<string, string>;
};

type HealthResponse = {
  status: string;
  mode: string;
  orchestrator: string;
  execution_enabled: boolean;
  signing_enabled: boolean;
  broadcast_enabled: boolean;
  providers: ProviderStatus[];
};

const PROVIDERS: Array<{ id: Exclude<ProviderName, "hermes_research_os">; label: string; focus: string }> = [
  { id: "koyfin", label: "Koyfin", focus: "Portfolio + macro intelligence" },
  { id: "finviz", label: "Finviz", focus: "Equity screening + breadth" },
  { id: "messari", label: "Messari", focus: "Crypto + protocol intelligence" },
];

export default function MarketIntelligence() {
  const [query, setQuery] = useState("US market breadth, macro risk, and crypto momentum");
  const [assetClass, setAssetClass] = useState<AssetClass>("mixed");
  const [symbols, setSymbols] = useState("SPY,QQQ,BTC,ETH");
  const [selected, setSelected] = useState<Array<Exclude<ProviderName, "hermes_research_os">>>([
    "koyfin",
    "finviz",
    "messari",
  ]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [result, setResult] = useState<MarketResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/market-intelligence/health`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`Health ${response.status}`))))
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const statusByProvider = useMemo(() => {
    const entries = (health?.providers || result?.providers || []).map((provider) => [provider.provider, provider] as const);
    return Object.fromEntries(entries) as Partial<Record<ProviderName, ProviderStatus>>;
  }, [health, result]);

  function toggleProvider(provider: Exclude<ProviderName, "hermes_research_os">) {
    setSelected((current) =>
      current.includes(provider) ? current.filter((item) => item !== provider) : [...current, provider]
    );
  }

  async function runMarketIntelligence() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/market-intelligence/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          asset_class: assetClass,
          symbols: symbols
            .split(",")
            .map((symbol) => symbol.trim().toUpperCase())
            .filter(Boolean),
          providers: selected,
          save_to_dkos: false,
          max_results_per_source: 5,
        }),
      });
      if (!response.ok) throw new Error(`Market Intelligence request failed: ${response.status}`);
      setResult(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown Market Intelligence error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto max-w-7xl px-6 py-10">
        <header className="rounded-3xl border border-cyan-400/20 bg-slate-900/70 p-8 shadow-2xl shadow-cyan-950/30">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">D3VONN Market Intelligence Hub</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">One research cockpit. Zero custody.</h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-300">
            Hermes routes read-only market intelligence across Koyfin, Finviz, Messari, and Research OS. This surface cannot place trades, sign transactions, broadcast, or handle wallet keys.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <SafetyBadge label="Orchestrator" value="Hermes" />
            <SafetyBadge label="Mode" value="Read only" />
            <SafetyBadge label="Signing" value="Disabled" />
            <SafetyBadge label="Broadcast" value="Disabled" />
          </div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <label htmlFor="market-query" className="text-sm font-semibold text-slate-300">Research command</label>
            <textarea
              id="market-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="mt-3 min-h-32 w-full rounded-xl border border-slate-700 bg-slate-950 p-4 text-slate-100 outline-none ring-cyan-400/30 focus:ring-4"
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-slate-300">
                Asset class
                <select
                  value={assetClass}
                  onChange={(event) => setAssetClass(event.target.value as AssetClass)}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"
                >
                  <option value="mixed">Mixed</option>
                  <option value="equity">Equity</option>
                  <option value="etf">ETF</option>
                  <option value="crypto">Crypto</option>
                  <option value="macro">Macro</option>
                </select>
              </label>
              <label className="text-sm text-slate-300">
                Symbols
                <input
                  value={symbols}
                  onChange={(event) => setSymbols(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"
                  placeholder="SPY,QQQ,BTC,ETH"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {PROVIDERS.map((provider) => {
                const status = statusByProvider[provider.id];
                const active = selected.includes(provider.id);
                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => toggleProvider(provider.id)}
                    className={`rounded-xl border p-4 text-left transition ${
                      active ? "border-cyan-400/50 bg-cyan-400/10" : "border-slate-800 bg-slate-950"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{provider.label}</span>
                      <span className={`text-xs ${status?.enabled && status?.configured ? "text-emerald-300" : "text-amber-300"}`}>
                        {status?.enabled && status?.configured ? "ready" : "bridge needed"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">{provider.focus}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-400">
                This public research surface is read-only. DKOS persistence requires an authorized OCC workflow.
              </p>
              <button
                type="button"
                onClick={runMarketIntelligence}
                disabled={loading || query.trim().length < 2 || selected.length === 0}
                className="rounded-xl bg-cyan-300 px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Collecting..." : "Run Market Intelligence"}
              </button>
            </div>
            {error && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-950/40 p-3 text-red-200">{error}</p>}
          </section>

          <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-bold">Provider Gate</h2>
            <div className="mt-4 space-y-4">
              {PROVIDERS.map((provider) => {
                const status = statusByProvider[provider.id];
                return (
                  <div key={provider.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{provider.label}</span>
                      <span className={`text-xs ${status?.enabled && status?.configured ? "text-emerald-300" : "text-slate-500"}`}>
                        {status?.enabled && status?.configured ? "connected" : "not connected"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{status?.notes || "Health check pending"}</p>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>

        {result && (
          <div className="mt-8 space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Hermes routing</p>
                  <h2 className="mt-1 text-2xl font-bold">{result.status === "ready" ? "Collection ready" : "Provider bridge configuration required"}</h2>
                </div>
                <span className="rounded-full bg-slate-950 px-4 py-2 text-sm text-slate-300">{result.signals.length} signals</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {result.routing.workflow.map((step) => (
                  <span key={step} className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">{step}</span>
                ))}
              </div>
            </section>

            {Object.keys(result.provider_errors).length > 0 && (
              <section className="rounded-2xl border border-amber-400/30 bg-amber-950/20 p-6">
                <h2 className="font-bold text-amber-200">Provider collection errors</h2>
                {Object.entries(result.provider_errors).map(([provider, message]) => (
                  <p key={provider} className="mt-2 text-sm text-amber-100/80"><strong>{provider}:</strong> {message}</p>
                ))}
              </section>
            )}

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-bold">Ranked market signals</h2>
              <div className="mt-4 space-y-4">
                {result.signals.length === 0 && <p className="text-sm text-slate-400">No normalized signals returned yet.</p>}
                {result.signals.map((signal, index) => (
                  <article key={`${signal.provider}-${signal.symbol || "market"}-${index}`} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">{signal.provider} · {signal.asset_class}</p>
                        <h3 className="mt-1 font-bold text-slate-100">
                          {signal.source_url ? <a href={signal.source_url} target="_blank" rel="noreferrer" className="hover:text-cyan-200">{signal.title}</a> : signal.title}
                        </h3>
                      </div>
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">{Math.round(signal.confidence * 100)}% confidence</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-400">{signal.summary}</p>
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

function SafetyBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 font-bold text-cyan-200">{value}</p>
    </div>
  );
}
