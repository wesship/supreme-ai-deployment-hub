import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Activity,
  Bot,
  CircleDollarSign,
  Clock3,
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

const number = new Intl.NumberFormat('en-US');

const statusStyle: Record<AgentStatus, string> = {
  running: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  idle: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
  paused: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  error: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
};

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

      // Page through earnings so dashboard totals are not silently capped by PostgREST's row limit.
      const allEarnings: Earning[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data: earningRows, error: earningsError } = await supabase
          .from('agent_earnings')
          .select('id,agent_id,amount,source,description,earned_at')
          .order('earned_at', { ascending: false })
          .range(from, from + pageSize - 1);
        if (earningsError) throw earningsError;
        const page = (earningRows ?? []) as Earning[];
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
    const now = Date.now();
    const dayAgo = now - 86_400_000;
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

  const agentNames = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent.name])),
    [agents],
  );

  const createAgent = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;

    setCreating(true);
    setError(null);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error('Sign in is required to create an agent.');

      const { error: insertError } = await supabase.from('money_agents').insert({
        user_id: userData.user.id,
        name: form.name.trim(),
        category: form.category.trim() || 'automation',
        description: form.description.trim() || null,
        status: 'idle',
      });
      if (insertError) throw insertError;

      setForm({ name: '', category: 'automation', description: '' });
      setShowCreate(false);
      await loadMoneyHub(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Agent could not be created.');
    } finally {
      setCreating(false);
    }
  };

  const setAgentStatus = async (agent: MoneyAgent, status: AgentStatus) => {
    setUpdatingAgent(agent.id);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('money_agents')
        .update({
          status,
          last_run_at: status === 'running' ? new Date().toISOString() : agent.last_run_at,
        })
        .eq('id', agent.id);
      if (updateError) throw updateError;
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
              <WalletCards className="h-4 w-4" />
              Financial intelligence workspace
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">MoneyHub</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Live earnings, Money Agent operations, performance visibility, and reconciliation signals in one control surface.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadMoneyHub(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-950/30 transition hover:bg-indigo-400"
            >
              <Plus className="h-4 w-4" />
              Add Money Agent
            </button>
          </div>
        </header>

        {error && (
          <div role="alert" className="mb-6 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        <section aria-label="MoneyHub overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Tracked earnings', value: money.format(metrics.tracked), icon: CircleDollarSign, tone: 'text-emerald-300' },
            { label: 'Last 24 hours', value: money.format(metrics.last24h), icon: TrendingUp, tone: 'text-cyan-300' },
            { label: 'Running agents', value: `${metrics.running} / ${agents.length}`, icon: Activity, tone: 'text-indigo-300' },
            { label: 'Agent runs', value: number.format(metrics.runs), icon: Bot, tone: 'text-violet-300' },
          ].map((metric) => (
            <article key={metric.label} className="rounded-2xl border border-white/[0.08] bg-[#0b1222] p-5 shadow-xl shadow-black/10">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.16em] text-slate-500">{metric.label}</span>
                <metric.icon className={`h-4 w-4 ${metric.tone}`} />
              </div>
              <div className="mt-4 text-2xl font-semibold tracking-tight">{metric.value}</div>
            </article>
          ))}
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.65fr_1fr]">
          <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b1222]">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
              <div>
                <h2 className="font-semibold">Agent performance</h2>
                <p className="mt-1 text-xs text-slate-500">Ranked by lifetime earnings recorded on each agent.</p>
              </div>
              <span className="text-xs text-slate-500">{agents.length} agents</span>
            </div>

            {agents.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <Bot className="mx-auto h-8 w-8 text-slate-600" />
                <h3 className="mt-3 font-medium">No Money Agents yet</h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                  Create your first agent to start tracking its runs, status, and earnings.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {agents.map((agent, index) => {
                  const status = (agent.status ?? 'idle') as AgentStatus;
                  const isUpdating = updatingAgent === agent.id;
                  return (
                    <div key={agent.id} className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="w-6 text-xs tabular-nums text-slate-600">#{index + 1}</span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-100">{agent.name}</div>
                            <div className="mt-1 truncate text-xs text-slate-500">{agent.category} · {number.format(agent.runs_count ?? 0)} runs</div>
                          </div>
                        </div>
                      </div>
                      <div className="md:text-right">
                        <div className="text-sm font-semibold text-emerald-300">{money.format(Number(agent.total_earned ?? 0))}</div>
                        <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] capitalize ${statusStyle[status]}`}>
                          {status}
                        </span>
                      </div>
                      <div className="flex gap-2 md:justify-end">
                        <button
                          type="button"
                          title={status === 'running' ? 'Pause agent' : 'Start agent'}
                          aria-label={`${status === 'running' ? 'Pause' : 'Start'} ${agent.name}`}
                          disabled={isUpdating}
                          onClick={() => void setAgentStatus(agent, status === 'running' ? 'paused' : 'running')}
                          className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-slate-300 transition hover:bg-white/[0.09] disabled:opacity-40"
                        >
                          {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : status === 'running' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b1222]">
            <div className="border-b border-white/[0.07] px-5 py-4">
              <h2 className="font-semibold">Recent earnings</h2>
              <p className="mt-1 text-xs text-slate-500">Latest verified entries from agent_earnings.</p>
            </div>
            {earnings.length === 0 ? (
              <div className="px-6 py-14 text-center text-sm text-slate-500">No earnings have been recorded yet.</div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {earnings.slice(0, 12).map((earning) => (
                  <div key={earning.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-slate-200">{agentNames.get(earning.agent_id) ?? 'Money Agent'}</div>
                      <div className="mt-1 truncate text-xs text-slate-500">{earning.source}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-medium text-emerald-300">+{money.format(Number(earning.amount))}</div>
                      <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-slate-600">
                        <Clock3 className="h-3 w-3" />
                        {earning.earned_at ? new Date(earning.earned_at).toLocaleDateString() : 'Pending'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <footer className="mt-5 flex flex-col gap-1 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>Operational reporting only. MoneyHub does not execute trades or provide investment advice.</span>
          <span>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Awaiting sync'}</span>
        </footer>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="new-money-agent">
          <form onSubmit={createAgent} className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d1425] p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 id="new-money-agent" className="text-lg font-semibold">Add Money Agent</h2>
                <p className="mt-1 text-sm text-slate-500">Register an agent in your MoneyHub workspace.</p>
              </div>
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-white" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="block text-sm text-slate-300">
              Agent name
              <input
                required
                autoFocus
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5 text-white outline-none transition placeholder:text-slate-700 focus:border-indigo-400/50"
                placeholder="Revenue Scout"
              />
            </label>
            <label className="mt-4 block text-sm text-slate-300">
              Category
              <input
                required
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5 text-white outline-none transition focus:border-indigo-400/50"
                placeholder="automation"
              />
            </label>
            <label className="mt-4 block text-sm text-slate-300">
              Description <span className="text-slate-600">(optional)</span>
              <textarea
                rows={3}
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5 text-white outline-none transition focus:border-indigo-400/50"
                placeholder="What this agent earns or monitors"
              />
            </label>
            <button
              type="submit"
              disabled={creating || !form.name.trim()}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create agent
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default MoneyHub;
