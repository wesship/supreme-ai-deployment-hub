import { type FormEvent, type ReactNode, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, MessageSquareText, ShieldAlert, UserPlus } from 'lucide-react';
import { primetimeRelease1Api, type PrimetimeRecord } from '@/lib/primetimeRelease1Api';

function recordValue(record: PrimetimeRecord, key: string, fallback = '') {
  const current = record[key];
  return typeof current === 'string' || typeof current === 'number' ? String(current) : fallback;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="text-sm text-slate-300">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

const inputClass = 'w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-400';
const buttonClass = 'rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50';

interface FormsProps {
  workspaceId: string;
  userId: string;
  people: PrimetimeRecord[];
  leads: PrimetimeRecord[];
  stages: PrimetimeRecord[];
  onChanged: () => void;
}

export function PrimetimeRelease1Forms({ workspaceId, userId, people, leads, stages, onChanged }: FormsProps) {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [person, setPerson] = useState({ first_name: '', last_name: '', email: '', phone: '', source: 'manual' });
  const [lead, setLead] = useState({ person_id: '', pipeline_stage_id: '', source: 'manual', next_action: 'Follow up', next_action_due_at: '' });
  const [task, setTask] = useState({ lead_id: '', title: '', due_at: '', priority: 'normal' });
  const [activity, setActivity] = useState({ lead_id: '', person_id: '', activity_type: 'note', summary: '' });
  const [consent, setConsent] = useState({ person_id: '', channel: 'email', consent_state: 'granted', source: 'manual attestation' });
  const [suppression, setSuppression] = useState({ person_id: '', channel: 'email', reason: 'Opt-out request' });

  async function submit(event: FormEvent, action: () => Promise<unknown>, success: string) {
    event.preventDefault();
    if (!workspaceId) return;
    setStatus('');
    setError('');
    try {
      await action();
      setStatus(success);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete PRIMETIME action');
    }
  }

  const firstStage = recordValue(stages[0] || {}, 'id');

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Controlled create and update actions</h2>
          <p className="mt-1 text-sm text-slate-400">These forms call only governed Release 1 endpoints. No delete actions are exposed for regulated records.</p>
        </div>
        <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200">Audit logged</span>
      </div>
      {status && <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-100"><CheckCircle2 className="h-4 w-4" /> {status}</div>}
      {error && <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-300/20 bg-red-300/10 p-3 text-sm text-red-100"><AlertTriangle className="h-4 w-4" /> {error}</div>}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <form className="rounded-xl border border-white/10 bg-slate-950/60 p-4" onSubmit={(event) => submit(event, () => primetimeRelease1Api.createPerson({ workspace_id: workspaceId, ...person }), 'Person draft created for review.')}>
          <div className="mb-4 flex items-center gap-2 text-white"><UserPlus className="h-5 w-5 text-blue-300" /><h3 className="font-semibold">Create person</h3></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name"><input className={inputClass} value={person.first_name} onChange={(event) => setPerson({ ...person, first_name: event.target.value })} /></Field>
            <Field label="Last name"><input className={inputClass} value={person.last_name} onChange={(event) => setPerson({ ...person, last_name: event.target.value })} /></Field>
            <Field label="Email"><input className={inputClass} value={person.email} onChange={(event) => setPerson({ ...person, email: event.target.value })} /></Field>
            <Field label="Phone"><input className={inputClass} value={person.phone} onChange={(event) => setPerson({ ...person, phone: event.target.value })} /></Field>
          </div>
          <button className={`${buttonClass} mt-4`} disabled={!workspaceId}>Create person</button>
        </form>

        <form className="rounded-xl border border-white/10 bg-slate-950/60 p-4" onSubmit={(event) => submit(event, () => primetimeRelease1Api.createLead({ workspace_id: workspaceId, owner_id: userId, pipeline_stage_id: lead.pipeline_stage_id || firstStage, person_id: lead.person_id || undefined, source: lead.source, status: 'open', consent_state: 'unknown', next_action: lead.next_action, next_action_due_at: lead.next_action_due_at }), 'Lead created with required Release 1 controls.')}>
          <div className="mb-4 flex items-center gap-2 text-white"><FileText className="h-5 w-5 text-blue-300" /><h3 className="font-semibold">Create lead</h3></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Person"><select className={inputClass} value={lead.person_id} onChange={(event) => setLead({ ...lead, person_id: event.target.value })}><option value="">No linked person</option>{people.map((item) => <option key={recordValue(item, 'id')} value={recordValue(item, 'id')}>{recordValue(item, 'first_name')} {recordValue(item, 'last_name')}</option>)}</select></Field>
            <Field label="Stage"><select className={inputClass} value={lead.pipeline_stage_id} onChange={(event) => setLead({ ...lead, pipeline_stage_id: event.target.value })}>{stages.map((stage) => <option key={recordValue(stage, 'id')} value={recordValue(stage, 'id')}>{recordValue(stage, 'name')}</option>)}</select></Field>
            <Field label="Source"><input className={inputClass} value={lead.source} onChange={(event) => setLead({ ...lead, source: event.target.value })} required /></Field>
            <Field label="Next action"><input className={inputClass} value={lead.next_action} onChange={(event) => setLead({ ...lead, next_action: event.target.value })} required /></Field>
            <Field label="Next-action deadline"><input className={inputClass} type="datetime-local" value={lead.next_action_due_at} onChange={(event) => setLead({ ...lead, next_action_due_at: event.target.value })} required /></Field>
          </div>
          <button className={`${buttonClass} mt-4`} disabled={!workspaceId || !userId || !lead.next_action_due_at || !(lead.pipeline_stage_id || firstStage)}>Create lead</button>
        </form>

        <form className="rounded-xl border border-white/10 bg-slate-950/60 p-4" onSubmit={(event) => submit(event, () => primetimeRelease1Api.createTask({ workspace_id: workspaceId, owner_id: userId, lead_id: task.lead_id || undefined, title: task.title, due_at: task.due_at || undefined, priority: task.priority }), 'Task created.')}>
          <div className="mb-4 flex items-center gap-2 text-white"><CheckCircle2 className="h-5 w-5 text-blue-300" /><h3 className="font-semibold">Create task</h3></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Lead"><select className={inputClass} value={task.lead_id} onChange={(event) => setTask({ ...task, lead_id: event.target.value })}><option value="">No linked lead</option>{leads.map((item) => <option key={recordValue(item, 'id')} value={recordValue(item, 'id')}>{recordValue(item, 'source', 'Lead')} · {recordValue(item, 'next_action')}</option>)}</select></Field>
            <Field label="Title"><input className={inputClass} value={task.title} onChange={(event) => setTask({ ...task, title: event.target.value })} required /></Field>
            <Field label="Due"><input className={inputClass} type="datetime-local" value={task.due_at} onChange={(event) => setTask({ ...task, due_at: event.target.value })} /></Field>
            <Field label="Priority"><select className={inputClass} value={task.priority} onChange={(event) => setTask({ ...task, priority: event.target.value })}><option>low</option><option>normal</option><option>high</option><option>urgent</option></select></Field>
          </div>
          <button className={`${buttonClass} mt-4`} disabled={!workspaceId || !userId || !task.title}>Create task</button>
        </form>

        <form className="rounded-xl border border-white/10 bg-slate-950/60 p-4" onSubmit={(event) => submit(event, () => primetimeRelease1Api.createActivity({ workspace_id: workspaceId, lead_id: activity.lead_id || undefined, person_id: activity.person_id || undefined, activity_type: activity.activity_type, summary: activity.summary }), 'Activity recorded and audit event written.')}>
          <div className="mb-4 flex items-center gap-2 text-white"><MessageSquareText className="h-5 w-5 text-blue-300" /><h3 className="font-semibold">Record activity</h3></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Lead"><select className={inputClass} value={activity.lead_id} onChange={(event) => setActivity({ ...activity, lead_id: event.target.value })}><option value="">No linked lead</option>{leads.map((item) => <option key={recordValue(item, 'id')} value={recordValue(item, 'id')}>{recordValue(item, 'source', 'Lead')}</option>)}</select></Field>
            <Field label="Person"><select className={inputClass} value={activity.person_id} onChange={(event) => setActivity({ ...activity, person_id: event.target.value })}><option value="">No linked person</option>{people.map((item) => <option key={recordValue(item, 'id')} value={recordValue(item, 'id')}>{recordValue(item, 'first_name')} {recordValue(item, 'last_name')}</option>)}</select></Field>
            <Field label="Type"><input className={inputClass} value={activity.activity_type} onChange={(event) => setActivity({ ...activity, activity_type: event.target.value })} required /></Field>
            <Field label="Summary"><input className={inputClass} value={activity.summary} onChange={(event) => setActivity({ ...activity, summary: event.target.value })} required /></Field>
          </div>
          <button className={`${buttonClass} mt-4`} disabled={!workspaceId || !activity.summary}>Record activity</button>
        </form>

        <form className="rounded-xl border border-white/10 bg-slate-950/60 p-4" onSubmit={(event) => submit(event, () => primetimeRelease1Api.recordConsent({ workspace_id: workspaceId, person_id: consent.person_id, channel: consent.channel, consent_state: consent.consent_state, source: consent.source, evidence: { captured_by: 'primetime_release1_ui' } }), 'Consent record created.')}>
          <div className="mb-4 flex items-center gap-2 text-white"><ShieldAlert className="h-5 w-5 text-emerald-300" /><h3 className="font-semibold">Record consent</h3></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Person"><select className={inputClass} value={consent.person_id} onChange={(event) => setConsent({ ...consent, person_id: event.target.value })}><option value="">Select person</option>{people.map((item) => <option key={recordValue(item, 'id')} value={recordValue(item, 'id')}>{recordValue(item, 'first_name')} {recordValue(item, 'last_name')}</option>)}</select></Field>
            <Field label="Channel"><select className={inputClass} value={consent.channel} onChange={(event) => setConsent({ ...consent, channel: event.target.value })}><option>email</option><option>sms</option><option>voice</option><option>mail</option><option>in_person</option></select></Field>
            <Field label="State"><select className={inputClass} value={consent.consent_state} onChange={(event) => setConsent({ ...consent, consent_state: event.target.value })}><option>granted</option><option>revoked</option><option>expired</option><option>unknown</option><option>not_required</option></select></Field>
            <Field label="Source"><input className={inputClass} value={consent.source} onChange={(event) => setConsent({ ...consent, source: event.target.value })} required /></Field>
          </div>
          <button className={`${buttonClass} mt-4`} disabled={!workspaceId || !consent.person_id}>Record consent</button>
        </form>

        <form className="rounded-xl border border-white/10 bg-slate-950/60 p-4" onSubmit={(event) => submit(event, () => primetimeRelease1Api.createSuppressionRecord({ workspace_id: workspaceId, person_id: suppression.person_id, channel: suppression.channel, reason: suppression.reason }), 'Suppression record created.')}>
          <div className="mb-4 flex items-center gap-2 text-white"><ShieldAlert className="h-5 w-5 text-red-300" /><h3 className="font-semibold">Create suppression record</h3></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Person"><select className={inputClass} value={suppression.person_id} onChange={(event) => setSuppression({ ...suppression, person_id: event.target.value })}><option value="">Select person</option>{people.map((item) => <option key={recordValue(item, 'id')} value={recordValue(item, 'id')}>{recordValue(item, 'first_name')} {recordValue(item, 'last_name')}</option>)}</select></Field>
            <Field label="Channel"><select className={inputClass} value={suppression.channel} onChange={(event) => setSuppression({ ...suppression, channel: event.target.value })}><option>email</option><option>sms</option><option>voice</option><option>mail</option><option>in_person</option></select></Field>
            <Field label="Reason"><input className={inputClass} value={suppression.reason} onChange={(event) => setSuppression({ ...suppression, reason: event.target.value })} required /></Field>
          </div>
          <button className={`${buttonClass} mt-4 bg-red-500 hover:bg-red-400`} disabled={!workspaceId || !suppression.person_id || !suppression.reason}>Create suppression</button>
        </form>
      </div>
    </section>
  );
}
