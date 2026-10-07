import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const API_BASE = (import.meta.env.VITE_API_URL || "https://api.d3vonn.io").replace(/\/$/, "");

type Persona = {
  persona_id: string;
  display_name: string;
  niche: string;
  declared_age: number;
};

type Campaign = {
  campaign_id: string;
  persona_id: string;
  objective: string;
  state: string;
  hermes_goal_id?: string | null;
  hermes_task_id?: string | null;
};

type CampaignAsset = {
  id?: string;
  asset_id?: string;
  provider: string;
  capability: string;
  provider_job_id: string;
  status: string;
  rights_verified: boolean;
  qa_passed: boolean;
};

type HealthPayload = {
  status: string;
  providers?: {
    providers?: Array<{
      provider: string;
      configured: boolean;
      transport: string;
      endpoint?: string | null;
    }>;
  };
  certification_boundary: string;
  external_publish_enabled: boolean;
};

async function authFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sign in required.");
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...(init.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.detail === "string" ? data.detail : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

export default function InfluencerStudio() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [asset, setAsset] = useState<CampaignAsset | null>(null);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [providerProbe, setProviderProbe] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("Nova");
  const [niche, setNiche] = useState("fashion-tech");
  const [bible, setBible] = useState("Synthetic creator focused on fashion, technology, and modern design.");
  const [objective, setObjective] = useState("Create a launch portrait campaign.");
  const [prompt, setPrompt] = useState("Editorial portrait, natural light, premium fashion-tech campaign.");
  const [provider, setProvider] = useState("eromify");
  const [comfyWorkflow, setComfyWorkflow] = useState("");

  const configuredProviders = useMemo(
    () => health?.providers?.providers?.filter((item) => item.configured) || [],
    [health],
  );

  const run = useCallback(async <T,>(label: string, fn: () => Promise<T>) => {
    setBusy(label);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setBusy(null);
    }
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const data = await authFetch<HealthPayload>("/api/influencer-studio/health");
      setHealth(data);
      const first = data.providers?.providers?.find((item) => item.configured);
      if (first) setProvider(first.provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => { void loadHealth(); }, [loadHealth]);

  const refreshSnapshot = useCallback(async (id?: string) => {
    const campaignId = id || campaign?.campaign_id;
    if (!campaignId) return;
    const data = await authFetch<any>(`/api/influencer-studio/campaigns/${campaignId}`);
    setSnapshot(data);
    const current = data?.assets?.[0];
    if (current) setAsset(current);
    setCampaign((prev) => prev ? { ...prev, state: data.state } : prev);
  }, [campaign?.campaign_id]);

  const createPersona = async () => {
    await run("Creating persona", async () => {
      const data = await authFetch<{ persona: Persona }>("/api/influencer-studio/personas", {
        method: "POST",
        body: JSON.stringify({
          display_name: displayName,
          character_bible: bible,
          niche,
          declared_age: 21,
          synthetic_disclosure: true,
          provenance: { source: "d3vonn_influencer_studio" },
        }),
      });
      setPersona(data.persona);
      setCampaign(null);
      setAsset(null);
      setSnapshot(null);
    });
  };

  const createCampaign = async () => {
    if (!persona) return;
    await run("Creating campaign", async () => {
      const data = await authFetch<{ campaign: Campaign }>("/api/influencer-studio/campaigns", {
        method: "POST",
        body: JSON.stringify({ persona_id: persona.persona_id, objective }),
      });
      setCampaign(data.campaign);
      setAsset(null);
      await refreshSnapshot(data.campaign.campaign_id);
    });
  };

  const plan = async () => {
    if (!campaign) return;
    await run("Binding Hermes", async () => {
      const data = await authFetch<{ campaign: Campaign }>(
        `/api/influencer-studio/campaigns/${campaign.campaign_id}/plan`,
        { method: "POST" },
      );
      setCampaign(data.campaign);
      await refreshSnapshot(data.campaign.campaign_id);
    });
  };

  const probeProvider = async () => {
    await run("Probing provider", async () => {
      const data = await authFetch<any>(`/api/influencer-studio/providers/${provider}/probe`);
      setProviderProbe(data);
    });
  };

  const generate = async () => {
    if (!campaign) return;
    await run("Generating media", async () => {
      const options: Record<string, unknown> = {};
      if (provider === "comfyui-wan") {
        if (!comfyWorkflow.trim()) throw new Error("Paste a ComfyUI API-format workflow before generating.");
        options.workflow = JSON.parse(comfyWorkflow);
        options.model_family = "wan";
      }
      const data = await authFetch<{ campaign: Campaign; asset: CampaignAsset }>(
        `/api/influencer-studio/campaigns/${campaign.campaign_id}/generate`,
        {
          method: "POST",
          body: JSON.stringify({
            provider,
            capability: "text_to_image",
            prompt,
            reference_assets: [],
            options,
          }),
        },
      );
      setCampaign(data.campaign);
      setAsset(data.asset);
      await refreshSnapshot(data.campaign.campaign_id);
    });
  };

  const refreshAsset = async () => {
    if (!campaign || !asset) return;
    const id = asset.id || asset.asset_id;
    if (!id) return;
    await run("Refreshing provider job", async () => {
      const data = await authFetch<{ asset: CampaignAsset }>(
        `/api/influencer-studio/campaigns/${campaign.campaign_id}/assets/${id}/refresh`,
        { method: "POST" },
      );
      setAsset(data.asset);
      await refreshSnapshot();
    });
  };

  const enterQa = async () => {
    if (!campaign) return;
    await run("Entering QA", async () => {
      const data = await authFetch<{ campaign: Campaign }>(
        `/api/influencer-studio/campaigns/${campaign.campaign_id}/qa`,
        { method: "POST" },
      );
      setCampaign(data.campaign);
      await refreshSnapshot();
    });
  };

  const certifyAsset = async () => {
    if (!campaign || !asset) return;
    const id = asset.id || asset.asset_id;
    if (!id) return;
    await run("Certifying asset", async () => {
      const data = await authFetch<{ asset: CampaignAsset }>(
        `/api/influencer-studio/campaigns/${campaign.campaign_id}/assets/${id}/certify`,
        {
          method: "PATCH",
          body: JSON.stringify({ rights_verified: true, qa_passed: true }),
        },
      );
      setAsset(data.asset);
      await refreshSnapshot();
    });
  };

  const requestApproval = async () => {
    if (!campaign) return;
    await run("Requesting approval", async () => {
      const data = await authFetch<{ campaign: Campaign }>(
        `/api/influencer-studio/campaigns/${campaign.campaign_id}/approval`,
        { method: "POST" },
      );
      setCampaign(data.campaign);
      await refreshSnapshot();
    });
  };

  const certifyReady = async () => {
    if (!campaign) return;
    await run("Certifying release boundary", async () => {
      const data = await authFetch<{ campaign: Campaign }>(
        `/api/influencer-studio/campaigns/${campaign.campaign_id}/ready`,
        { method: "POST", body: JSON.stringify({}) },
      );
      setCampaign(data.campaign);
      await refreshSnapshot();
    });
  };

  const state = campaign?.state || "not_started";
  const actionClass = "rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-7xl px-5 py-10">
        <div className="mb-8 flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">D3VONN.IO</p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Influencer Studio</h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-400">
              Persona → Hermes planning → provider generation → provenance → QA → human approval → READY_TO_PUBLISH.
              External publishing stays disabled in this certification gate.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-sm">
            <div className="text-neutral-400">Campaign state</div>
            <div className="mt-1 font-mono text-emerald-300">{state}</div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold">1. Persona</h2>
            <div className="mt-4 space-y-3">
              <input className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" />
              <input className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Niche" />
              <textarea className="min-h-28 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" value={bible} onChange={(e) => setBible(e.target.value)} placeholder="Character bible" />
              <button className={actionClass} disabled={!!busy} onClick={() => void createPersona()}>
                Create synthetic persona
              </button>
              {persona && <p className="break-all text-xs text-neutral-500">ID: {persona.persona_id}</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold">2. Campaign + Hermes</h2>
            <div className="mt-4 space-y-3">
              <textarea className="min-h-24 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" value={objective} onChange={(e) => setObjective(e.target.value)} />
              <button className={actionClass} disabled={!persona || !!busy} onClick={() => void createCampaign()}>Create campaign</button>
              <button className={actionClass} disabled={!campaign || campaign.state !== "draft" || !!busy} onClick={() => void plan()}>Bind Hermes planning task</button>
              {campaign?.hermes_task_id && <p className="break-all text-xs text-neutral-500">Hermes task: {campaign.hermes_task_id}</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold">3. Media provider</h2>
            <div className="mt-4 space-y-3">
              <select className="w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2" value={provider} onChange={(e) => setProvider(e.target.value)}>
                {(configuredProviders.length ? configuredProviders : [{ provider: "eromify", configured: false, transport: "mcp" }]).map((item) => (
                  <option key={item.provider} value={item.provider}>{item.provider}{item.configured ? "" : " — not configured"}</option>
                ))}
              </select>
              <textarea className="min-h-24 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              {provider === "comfyui-wan" && (
                <textarea className="min-h-28 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs" value={comfyWorkflow} onChange={(e) => setComfyWorkflow(e.target.value)} placeholder="ComfyUI API-format workflow JSON" />
              )}
              <button className={actionClass} disabled={!!busy} onClick={() => void probeProvider()}>Probe provider</button>
              <button className={actionClass} disabled={!campaign || !["planning", "generating"].includes(campaign.state) || !!busy} onClick={() => void generate()}>Generate</button>
              <button className={actionClass} disabled={!asset || !!busy} onClick={() => void refreshAsset()}>Refresh provider job</button>
              {asset && <p className="text-xs text-neutral-500">Job {asset.provider_job_id}: {asset.status}</p>}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-center gap-3">
            <button className={actionClass} disabled={!campaign || campaign.state !== "generating" || !!busy} onClick={() => void enterQa()}>Enter QA</button>
            <button className={actionClass} disabled={!campaign || campaign.state !== "qa" || !asset || !!busy} onClick={() => void certifyAsset()}>Verify rights + pass QA</button>
            <button className={actionClass} disabled={!campaign || campaign.state !== "qa" || !!busy} onClick={() => void requestApproval()}>Request approval</button>
            <button className={actionClass} disabled={!campaign || campaign.state !== "approval" || !!busy} onClick={() => void certifyReady()}>Certify READY_TO_PUBLISH</button>
            <button className={actionClass} disabled={!campaign || !!busy} onClick={() => void refreshSnapshot()}>Refresh snapshot</button>
          </div>
          {busy && <p className="mt-4 text-sm text-amber-200">{busy}…</p>}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">Provider health</h2>
            <pre className="overflow-auto text-xs text-neutral-300">{JSON.stringify({ health, probe: providerProbe }, null, 2)}</pre>
          </section>
          <section className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">Campaign audit snapshot</h2>
            <pre className="overflow-auto text-xs text-neutral-300">{JSON.stringify(snapshot, null, 2)}</pre>
          </section>
        </div>
      </div>
    </div>
  );
}
