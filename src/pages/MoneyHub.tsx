import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Activity,
  Bot,
  CircleDollarSign,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react';

type AgentStatus = 'idle' | 'running' | 'paused' | 'error';

type RpcResult = {
  data: unknown;
  error: { message?: string } | null;
};

interface MoneyAgent {
  id: string;
  user_id: string;
  name: string;
  category: string;
  description: string | null;
  status: AgentStatus | null;
  total_earned: number | null;
  runs_count: number | null;
  last_run_at: string | null;
  created_at: string | null;
}

interface Earning {
  id: string;
  agent_id: string;
  amount: number;
  source: string;
  description: string | null;
  earned_at: string | null;
}

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const integer = new Intl.NumberFormat('en-US');

const statusStyle: Record<AgentStatus, string> = {
  running: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  idle: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
  paused: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  error: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
};

async function callMoneyHubRpc(name: string, args: Record<string, unknown>): Promise<RpcResult> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    params?: Record<string, unknown>,
  ) => Promise<RpcResult>;
  return rpc(name, args);
}

const MoneyHub = () => {
  const [agents, setAgents] = useState<MoneyAgent[]>([]);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updatingAgent, setUpdatingAgent] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', category: 'automation', description: '' });

  const loadMoneyHub = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    setError(null);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error('Sign in is required to access MoneyHub.');

      const { data: agentRows, error: agentsError } = await supabase
        .from('money_agents')
        .select('id,user_id,name,category,description,status,total_earned,runs_count,last_run_at,created_at')
        .order('total_earned', { ascending: false });
      if (agentsError) throw agentsError;

      const allEarnings: Earning[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data: rows, error: earningsError } = await supabase
          .from('agent_earnings')
          .select('id,agent_id,amount,source,description,earned_at')
          .order('earned_at', { ascending: false })
          .range(from, from + pageSize - 1);
        if (earningsError) throw earningsError;
        const page = (rows ?? []) as Earning[];
        allEarnings.push(...page);
        if (page.length < pageSize) break;
      }

      setAgents((agentRows ?? []) as MoneyAgent[]);
      setEarnings(allEarnings);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'MoneyHub data could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadMoneyHub();

    const channel = supabase
      .channel('moneyhub-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'money_agents' }, () => {
        void loadMoneyHub(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_earnings' }, () => {
        void loadMoneyHub(true);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadMoneyHub]);

  const metrics = useMemo(() => {
    const dayAgo = Date.now() - 86_400_000;
    const tracked = earnings.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const last24h = earnings.reduce((sum, item) => {
      if (!item.earned_at || new Date(item.earned_at).getTime() < dayAgo) return sum;
      return sum + Number(item.amount || 0);
    }, 0);
    return {
      tracked,
      last24h,
      running: agents.filter((agent) => agent.status === 'running').length,
      runs: agents.reduce((sum, agent) => sum + Number(agent.runs_count || 0), 0),
    };
  }, [agents, earnings]);

  const agentNames = useMemo(() => new Map(agents.map((agent) => [agent.id, agent.name])), [agents]);

  const createAgent = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;

    setCreating(true);
    setError(null);
    try {
      const { error: rpcError } = await callMoneyHubRpc('moneyhub_create_agent', {
        p_name: form.name.trim(),
        p_category: form.category.trim() || 'automation',
        p_description: form.description.trim() || null,
      });
      if (rpcError) throw new Error(rpcError.message || 'Agent could not be created.');
      setForm({ name: '', category: 'automation', description: '' });
      setShowCreate(false);
      await loadMoneyHub(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Agent could not be created.');
    } finally {
      setCreating(false);
    }
  };

  const setAgentStatus = async (agent: MoneyAgent, status: 'running' | 'paused' | 'idle') => {
    setUpdatingAgent(agent.id);
    setError(null);
    try {
      const { error: rpcError } = await callMoneyHubRpc('moneyhub_set_agent_status', {
        p_agent_id: agent.id,
        p_status: status,
      });
      if (rpcError) throw new Error(rpcError.message || 'Agent status could not be updated.');
      await loadMoneyHub(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Agent status could not be updated.');
    } finally {
      setUpdatingAgent(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#060914] px-6 py-24 text-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
          Connecting MoneyHub…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#060914] text-white">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
        <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-indigo-300">
              <WalletCards className="h-4 w-4" /> Financial operations workspace
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">MoneyHub</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Governed Money Agent operations, earnings visibility, performance ranking, and reconciliation signals.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void loadMoneyHub(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 hover:bg-white/[0.08] disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium hover:bg-indigo-400">
              <Plus className="h-4 w-4" /> Add Money Agent
            </button>
          </div>
        </header>

        {error && <div role="alert" className="mb-6 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</div>}

        <section aria-label="MoneyHub overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Tracked earnings', value: money.format(metrics.tracked), icon: CircleDollarSign },
            { label: 'Last 24 hours', value: money.format(metrics.last24h), icon: TrendingUp },
            { label: 'Running agents', value: `${metrics.running} / ${agents.length}`, icon: Activity },
            { label: 'Agent runs', value: integer.format(metrics.runs), icon: Bot },
          ].map((metric) => (
            <article key={metric.label} className="rounded-2xl border border-white/[0.08] bg-[#0b1222] p-5">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-slate-500">
                {metric.label}<metric.icon className="h-4 w-4 text-indigo-300" />
              </div>
              <div className="mt-4 text-2xl font-semibold">{metric.value}</div>
            </article>
          ))}
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.65fr_1fr]">
          <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b1222]">
            <div className="border-b border-white/[0.07] px-5 py-4">
              <h2 className="font-semibold">Agent performance</h2>
              <p className="mt-1 text-xs text-slate-500">Financial totals are read-only from the browser; lifecycle controls use governed RPCs.</p>
            </div>
            {agents.length === 0 ? (
              <div className="px-6 py-14 text-center text-sm text-slate-500">No Money Agents yet.</div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {agents.map((agent, index) => {
                  const status = (agent.status ?? 'idle') as AgentStatus;
                  const busy = updatingAgent === agent.id;
                  return (
                    <div key={agent.id} className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="w-6 text-xs text-slate-600">#{index + 1}</span>
                          <div>
                            <div className="font-medium">{agent.name}</div>
                            <div className="text-xs text-slate-500">{agent.category} · {integer.format(Number(agent.runs_count || 0))} runs</div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-emerald-300">{money.format(Number(agent.total_earned || 0))}</div>
                        <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] ${statusStyle[status]}`}>{status}</span>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setAgentStatus(agent, status === 'running' ? 'paused' : 'running')}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 hover:bg-white/[0.06] disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : status === 'running' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        {status === 'running' ? 'Pause' : 'Start'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b1222]">
            <div className="border-b border-white/[0.07] px-5 py-4">
              <h2 className="font-semibold">Recent earnings</h2>
              <p className="mt-1 text-xs text-slate-500">Recorded by server-side earning workflows.</p>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {earnings.slice(0, 12).map((earning) => (
                <div key={earning.id} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{agentNames.get(earning.agent_id) || earning.source}</div>
                      <div className="mt-1 truncate text-xs text-slate-500">{earning.description || earning.source}</div>
                    </div>
                    <div className="text-sm font-semibold text-emerald-300">{money.format(Number(earning.amount || 0))}</div>
                  </div>
                </div>
              ))}
              {earnings.length === 0 && <div className="px-5 py-10 text-center text-sm text-slate-500">No recorded earnings yet.</div>}
            </div>
          </section>
        </div>

        <footer className="mt-6 flex flex-col gap-2 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>MoneyHub is an operational reporting workspace; it does not execute trades or provide investment advice.</span>
          <span>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Not yet refreshed'}</span>
        </footer>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="moneyhub-create-title">
          <form onSubmit={createAgent} className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b1222] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 id="moneyhub-create-title" className="text-lg font-semibold">Create Money Agent</h2>
              <button type="button" onClick={() => setShowCreate(false)} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-white/5"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <label className="block text-sm text-slate-300">Name<input maxLength={120} required value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 outline-none focus:border-indigo-400/60" /></label>
              <label className="block text-sm text-slate-300">Category<input maxLength={80} value={form.category} onChange={(e) => setForm((v) => ({ ...v, category: e.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 outline-none focus:border-indigo-400/60" /></label>
              <label className="block text-sm text-slate-300">Description<textarea maxLength={1000} rows={4} value={form.description} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 outline-none focus:border-indigo-400/60" /></label>
            </div>
            <button type="submit" disabled={creating || !form.name.trim()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium hover:bg-indigo-400 disabled:opacity-50">
              {creating && <Loader2 className="h-4 w-4 animate-spin" />} Create agent
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default MoneyHub;
