import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Gavel, LockKeyhole, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { nonprofitCommandCenterApi, type NonprofitBoardRule, type NonprofitBoardStatusRow } from '@/lib/nonprofitCommandCenterApi';

function pillClass(ok: boolean) {
  return ok
    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
    : 'border-amber-400/30 bg-amber-400/10 text-amber-200';
}

export default function NonprofitBoardGovernance() {
  const [rules, setRules] = useState<NonprofitBoardRule[]>([]);
  const [rows, setRows] = useState<NonprofitBoardStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await nonprofitCommandCenterApi.loadBoardGovernance();
      setRules(data.rules);
      setRows(data.board);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load nonprofit board governance.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const rule = rules[0];
  const governanceActive = Boolean(rule?.effective && rule.status === 'ADOPTED');
  const sessions = useMemo(() => new Set(rows.map((row) => row.session_id).filter(Boolean)).size, [rows]);
  const resolutions = useMemo(() => rows.filter((row) => row.resolution_id).length, [rows]);

  const invoke = async (key: string, fn: () => Promise<unknown>) => {
    setWorking(key);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Governance action was blocked.');
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">D3VONN.IO Institute</p>
            <h1 className="mt-2 text-3xl font-semibold">Board Governance + Resolution Engine</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Human-only board authority with quorum, recusal, vote, written-consent, resolution, approval, and audit controls.
            </p>
          </div>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        <div className={`mt-6 rounded-xl border p-4 ${pillClass(governanceActive)}`}>
          <div className="flex items-start gap-3">
            {governanceActive ? <CheckCircle2 className="mt-0.5 h-5 w-5" /> : <AlertTriangle className="mt-0.5 h-5 w-5" />}
            <div>
              <p className="font-semibold">{governanceActive ? 'Governance rules adopted and effective' : 'Fail-closed: governance rules are not yet effective'}</p>
              <p className="mt-1 text-sm opacity-90">
                {governanceActive
                  ? 'Board actions may proceed only through qualified, MFA-authenticated directors and the enforced approval workflow.'
                  : 'No board resolution can be finalized until legitimate directors exist and the governing rules are adopted from real organizational evidence.'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            ['Rule state', rule?.status ?? 'NO VISIBLE RULE', ShieldCheck],
            ['Effective', governanceActive ? 'YES' : 'NO', LockKeyhole],
            ['Sessions', String(sessions), Users],
            ['Resolutions', String(resolutions), Gavel],
          ].map(([label, value, Icon]) => (
            <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="flex items-center justify-between text-slate-400"><span className="text-xs uppercase tracking-wide">{String(label)}</span><Icon className="h-4 w-4" /></div>
              <div className="mt-3 text-xl font-semibold">{String(value)}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-lg font-semibold">Governance standard</h2>
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
            <div><span className="text-slate-400">Quorum</span><div className="mt-1 font-medium">{rule?.quorum_mode ?? 'Pending evidence-backed adoption'}</div></div>
            <div><span className="text-slate-400">Voting</span><div className="mt-1 font-medium">{rule?.vote_mode ?? 'Pending evidence-backed adoption'}</div></div>
            <div><span className="text-slate-400">Written consent</span><div className="mt-1 font-medium">{rule?.written_consent_mode ?? 'Pending evidence-backed adoption'}</div></div>
          </div>
          <p className="mt-4 text-xs text-slate-400">Authority basis: {rule?.authority_basis ?? 'Not established in staging. No software-generated legal authority is substituted.'}</p>
        </div>

        {error && <div className="mt-6 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Board sessions and agenda</h2>
            <span className="text-xs text-slate-400">AAL2 + active BOARD membership enforced server-side</span>
          </div>

          {loading ? (
            <p className="mt-5 text-sm text-slate-400">Loading governance state…</p>
          ) : rows.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-slate-700 p-5 text-sm text-slate-300">
              No legitimate board sessions exist in staging. This is expected while Gate 21 has no claimed BOARD identities. No demo vote, fake director, or synthetic resolution is created.
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr><th className="pb-3">Session</th><th className="pb-3">Agenda</th><th className="pb-3">Status</th><th className="pb-3">Attendance</th><th className="pb-3">Votes</th><th className="pb-3">Resolution</th><th className="pb-3">Human actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {rows.map((row) => (
                    <tr key={`${row.session_id}:${row.agenda_item_id ?? 'session'}`}>
                      <td className="py-4"><div className="font-medium">{row.title}</div><div className="text-xs text-slate-400">{row.session_type} · {row.session_status}</div></td>
                      <td className="py-4"><div>{row.agenda_title ?? '—'}</div>{row.related_party && <span className="mt-1 inline-block rounded border border-amber-500/30 px-2 py-0.5 text-xs text-amber-200">RELATED PARTY</span>}</td>
                      <td className="py-4">{row.agenda_status ?? '—'}</td>
                      <td className="py-4">{row.present_directors ?? 0}</td>
                      <td className="py-4">Y {row.yes_votes ?? 0} / N {row.no_votes ?? 0} / A {row.abstain_votes ?? 0}</td>
                      <td className="py-4">{row.resolution_number ?? '—'}</td>
                      <td className="py-4">
                        <div className="flex flex-wrap gap-2">
                          <button disabled={working !== null} onClick={() => void invoke(`attendance:${row.session_id}`, () => nonprofitCommandCenterApi.markBoardAttendance(row.session_id, 'PRESENT'))} className="rounded border border-slate-700 px-2 py-1 text-xs disabled:opacity-40">Present</button>
                          {row.agenda_item_id && ['YES','NO','ABSTAIN'].map((vote) => <button key={vote} disabled={working !== null} onClick={() => void invoke(`vote:${row.agenda_item_id}:${vote}`, () => nonprofitCommandCenterApi.castBoardVote(row.agenda_item_id!, vote as 'YES'|'NO'|'ABSTAIN'))} className="rounded border border-slate-700 px-2 py-1 text-xs disabled:opacity-40">{vote}</button>)}
                          {row.agenda_item_id && <button disabled={working !== null || !governanceActive} onClick={() => void invoke(`finalize:${row.agenda_item_id}`, () => nonprofitCommandCenterApi.finalizeBoardItem(row.agenda_item_id!))} className="rounded border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-xs text-sky-200 disabled:opacity-40">Finalize</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5 text-sm text-slate-300">
          <div className="flex items-center gap-2 font-semibold text-white"><LockKeyhole className="h-4 w-4" /> Reserved human authority</div>
          <p className="mt-2">AI agents may prepare agendas, research conflicts, draft resolutions, and summarize evidence. They cannot be directors, establish quorum, cast votes, create legal authority, or approve their own actions.</p>
        </div>
      </div>
    </div>
  );
}
