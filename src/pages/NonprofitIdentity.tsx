import { FormEvent, useEffect, useMemo, useState } from 'react';
import { KeyRound, RefreshCw, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { nonprofitCommandCenterApi, type NonprofitMembershipRow } from '@/lib/nonprofitCommandCenterApi';

const card = 'rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-lg shadow-black/20';
const input = 'w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400';
const button = 'rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50';
const ghost = 'rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-50';

const roles: NonprofitMembershipRow['role'][] = ['BOARD', 'EXECUTIVE', 'FINANCE', 'GRANT', 'PROGRAM', 'COMPLIANCE', 'AUDITOR'];

export default function NonprofitIdentity() {
  const [memberships, setMemberships] = useState<NonprofitMembershipRow[]>([]);
  const [claimToken, setClaimToken] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<NonprofitMembershipRow['role']>('PROGRAM');
  const [inviteCanApprove, setInviteCanApprove] = useState(false);
  const [issuedToken, setIssuedToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const result = await nonprofitCommandCenterApi.load();
      setMemberships(result.memberships);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load nonprofit identity state');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const governanceMembership = useMemo(
    () => memberships.find((row) => row.active && (row.role === 'BOARD' || row.role === 'EXECUTIVE')),
    [memberships],
  );

  async function claim(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await nonprofitCommandCenterApi.claimMembershipInvite(claimToken.trim());
      setClaimToken('');
      setMessage('Membership invitation claimed. Your nonprofit authority is now bound to this authenticated account.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Membership claim was blocked');
    } finally {
      setBusy(false);
    }
  }

  async function createInvite(event: FormEvent) {
    event.preventDefault();
    if (!governanceMembership) return;
    setBusy(true);
    setError('');
    setMessage('');
    setIssuedToken('');
    try {
      const rows = await nonprofitCommandCenterApi.createMembershipInvite({
        organizationId: governanceMembership.organization_id,
        email: inviteEmail.trim(),
        role: inviteRole,
        canApprove: inviteCanApprove,
        expiresHours: 72,
      });
      const token = rows[0]?.invite_token || '';
      setIssuedToken(token);
      setMessage('Invitation created. The token is shown once; deliver it to the intended person through a secure channel.');
      setInviteEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invitation creation was blocked');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-cyan-300"><ShieldCheck className="h-5 w-5" /><span className="text-sm font-semibold uppercase tracking-[0.2em]">D3VONN Nonprofit OS</span></div>
            <h1 className="text-3xl font-semibold tracking-tight">Identity & Governance</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">Bind real Supabase users to nonprofit authority through email-bound, one-time invitations. No user can self-assign a role.</p>
          </div>
          <button className={ghost} onClick={() => void refresh()} disabled={loading}><RefreshCw className={`mr-2 inline h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
        </header>

        {error && <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
        {message && <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">{message}</div>}

        <section className="grid gap-6 lg:grid-cols-2">
          <div className={card}>
            <div className="mb-4 flex items-center gap-2"><Users className="h-5 w-5 text-cyan-300" /><h2 className="text-lg font-semibold">My nonprofit roles</h2></div>
            <div className="space-y-3">
              {memberships.length === 0 && <p className="text-sm text-slate-500">No nonprofit membership is attached to this authenticated account yet.</p>}
              {memberships.map((row) => <div key={row.membership_id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold">{row.role}</p><p className="text-sm text-slate-400">{row.display_name || row.legal_name}</p></div><span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">{row.active ? 'ACTIVE' : 'INACTIVE'}</span></div><p className="mt-2 text-xs text-slate-500">Approval authority: {row.can_approve ? 'enabled by governance' : 'not enabled'}</p></div>)}
            </div>
          </div>

          <form className={card} onSubmit={claim}>
            <div className="mb-4 flex items-center gap-2"><KeyRound className="h-5 w-5 text-cyan-300" /><h2 className="text-lg font-semibold">Claim membership invitation</h2></div>
            <p className="mb-4 text-sm text-slate-400">The database verifies the token against your authenticated Supabase email. BOARD, EXECUTIVE, FINANCE and COMPLIANCE claims require an AAL2 MFA session.</p>
            <label className="text-xs uppercase tracking-wider text-slate-500">One-time invitation token</label>
            <input className={`${input} mt-2`} value={claimToken} onChange={(event) => setClaimToken(event.target.value)} autoComplete="off" required />
            <button className={`${button} mt-4`} disabled={busy || !claimToken.trim()} type="submit">Claim role</button>
          </form>
        </section>

        <section className={card}>
          <div className="mb-4 flex items-center gap-2"><UserPlus className="h-5 w-5 text-cyan-300" /><h2 className="text-lg font-semibold">Governance invitation</h2></div>
          {!governanceMembership ? (
            <p className="text-sm text-slate-500">Only an active BOARD or EXECUTIVE member can issue invitations. The staging project currently has no real Auth users, so the first legitimate identity must be created through Supabase Auth and bootstrapped without fabricating a director.</p>
          ) : (
            <form className="grid gap-4 md:grid-cols-2" onSubmit={createInvite}>
              <div><label className="text-xs uppercase tracking-wider text-slate-500">Invitee email</label><input type="email" className={`${input} mt-2`} value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} required /></div>
              <div><label className="text-xs uppercase tracking-wider text-slate-500">Role</label><select className={`${input} mt-2`} value={inviteRole} onChange={(event) => setInviteRole(event.target.value as NonprofitMembershipRow['role'])}>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></div>
              <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={inviteCanApprove} onChange={(event) => setInviteCanApprove(event.target.checked)} />Grant explicit approval capability</label>
              <div className="md:text-right"><button className={button} disabled={busy} type="submit">Create 72-hour invite</button></div>
            </form>
          )}
          {issuedToken && <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-amber-200">One-time token — copy now</p><code className="mt-2 block break-all text-sm text-amber-100">{issuedToken}</code></div>}
        </section>
      </div>
    </div>
  );
}
