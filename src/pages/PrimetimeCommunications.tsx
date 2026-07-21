import { FormEvent, useEffect, useMemo, useState } from 'react';

import { primetimeRelease1Api, PrimetimeRecord } from '@/lib/primetimeRelease1Api';
import { supabase } from '@/integrations/supabase/client';

const uuidFallback = '00000000-0000-4000-8000-000000000000';

function text(value: unknown, fallback = '—'): string {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function getId(record: PrimetimeRecord | undefined): string {
  return text(record?.id, uuidFallback);
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 shadow-xl">
      <h2 className="mb-4 text-lg font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm text-slate-300">
      <span>{label}</span>
      {children}
    </label>
  );
}

const inputClass = 'rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none';

export default function PrimetimeCommunications() {
  const [workspaceId, setWorkspaceId] = useState('');
  const [userId, setUserId] = useState(uuidFallback);
  const [workspaces, setWorkspaces] = useState<PrimetimeRecord[]>([]);
  const [templates, setTemplates] = useState<PrimetimeRecord[]>([]);
  const [versions, setVersions] = useState<PrimetimeRecord[]>([]);
  const [preferences, setPreferences] = useState<PrimetimeRecord[]>([]);
  const [communications, setCommunications] = useState<PrimetimeRecord[]>([]);
  const [events, setEvents] = useState<PrimetimeRecord[]>([]);
  const [policyChecks, setPolicyChecks] = useState<PrimetimeRecord[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedTemplateId = useMemo(() => getId(templates[0]), [templates]);
  const selectedCommunicationId = useMemo(() => getId(communications[0]), [communications]);

  async function loadWorkspaceList() {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || uuidFallback);
    const rows = await primetimeRelease1Api.listWorkspaces();
    setWorkspaces(rows);
    if (!workspaceId && rows[0]?.id) setWorkspaceId(String(rows[0].id));
  }

  async function loadCommunications(id = workspaceId) {
    if (!id) return;
    const [templateRows, versionRows, preferenceRows, communicationRows, eventRows, checkRows] = await Promise.all([
      primetimeRelease1Api.listMessageTemplates(id),
      primetimeRelease1Api.listMessageTemplateVersions(id),
      primetimeRelease1Api.listCommunicationPreferences(id),
      primetimeRelease1Api.listCommunications(id),
      primetimeRelease1Api.listCommunicationEvents(id),
      primetimeRelease1Api.listCommunicationPolicyChecks(id),
    ]);
    setTemplates(templateRows);
    setVersions(versionRows);
    setPreferences(preferenceRows);
    setCommunications(communicationRows);
    setEvents(eventRows);
    setPolicyChecks(checkRows);
  }

  async function runAction(action: () => Promise<unknown>, success: string) {
    setError('');
    setMessage('');
    try {
      await action();
      await loadCommunications();
      setMessage(success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown PRIMETIME communications error');
    }
  }

  useEffect(() => {
    loadWorkspaceList().catch((err) => setError(err instanceof Error ? err.message : 'Unable to load workspaces'));
  }, []);

  useEffect(() => {
    loadCommunications().catch((err) => setError(err instanceof Error ? err.message : 'Unable to load communications'));
  }, [workspaceId]);

  function formValue(form: HTMLFormElement, name: string, fallback = ''): string {
    return String(new FormData(form).get(name) || fallback);
  }

  async function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await runAction(
      () => primetimeRelease1Api.createMessageTemplate({
        workspace_id: workspaceId,
        name: formValue(form, 'name', 'Family readiness follow-up'),
        channel: formValue(form, 'channel', 'email'),
        purpose: formValue(form, 'purpose', 'education'),
        status: 'draft',
      }),
      'Template draft created',
    );
    form.reset();
  }

  async function approveTemplate(templateId: string) {
    await runAction(
      () => primetimeRelease1Api.updateMessageTemplate(templateId, {
        status: 'approved',
        approved_at: new Date().toISOString(),
        effective_at: new Date().toISOString(),
      }),
      'Template approval recorded',
    );
  }

  async function createVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await runAction(
      () => primetimeRelease1Api.createMessageTemplateVersion({
        workspace_id: workspaceId,
        template_id: formValue(form, 'template_id', selectedTemplateId),
        version: Number(formValue(form, 'version', '1')),
        subject: formValue(form, 'subject', 'Family Financial Readiness Review'),
        body: formValue(form, 'body', 'Thanks for completing the readiness challenge. Here is your educational review summary.'),
      }),
      'Template version created',
    );
    form.reset();
  }

  async function createPreference(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await runAction(
      () => primetimeRelease1Api.createCommunicationPreference({
        workspace_id: workspaceId,
        person_id: formValue(form, 'person_id', uuidFallback),
        channel: formValue(form, 'channel', 'email'),
        preference_state: formValue(form, 'preference_state', 'allowed'),
        quiet_hours_start: formValue(form, 'quiet_hours_start', '20:00'),
        quiet_hours_end: formValue(form, 'quiet_hours_end', '08:00'),
        max_frequency_per_day: Number(formValue(form, 'max_frequency_per_day', '1')),
      }),
      'Communication preference recorded',
    );
    form.reset();
  }

  async function createDraftCommunication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await runAction(
      () => primetimeRelease1Api.createCommunication({
        workspace_id: workspaceId,
        person_id: formValue(form, 'person_id', uuidFallback),
        template_id: formValue(form, 'template_id', selectedTemplateId),
        channel: formValue(form, 'channel', 'email'),
        direction: 'outbound',
        status: 'draft',
        subject: formValue(form, 'subject', 'Educational follow-up'),
        body: formValue(form, 'body', 'Draft only. Requires policy check and approved workflow before delivery.'),
      }),
      'Draft communication created',
    );
    form.reset();
  }

  async function recordPolicyCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await runAction(
      () => primetimeRelease1Api.createCommunicationPolicyCheck({
        workspace_id: workspaceId,
        communication_id: formValue(form, 'communication_id', selectedCommunicationId),
        decision: formValue(form, 'decision', 'pass'),
        checks: { type: formValue(form, 'check_type', 'consent'), source: 'primetime-communications-ui' },
        reasons: [formValue(form, 'reason', 'Consent and template review passed for draft workflow.')],
      }),
      'Communication policy check recorded',
    );
    form.reset();
  }

  async function recordCommunicationEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await runAction(
      () => primetimeRelease1Api.createCommunicationEvent({
        workspace_id: workspaceId,
        communication_id: formValue(form, 'communication_id', selectedCommunicationId),
        event_type: formValue(form, 'event_type', 'review_requested'),
        metadata: { source: 'primetime-communications-ui', note: 'Manual event record only. No autonomous sending.' },
      }),
      'Communication timeline event recorded',
    );
    form.reset();
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-blue-400/20 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
          <p className="text-sm uppercase tracking-[0.3em] text-blue-300">PRIMETIME Release 3</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Governed Communications</h1>
          <p className="mt-3 max-w-3xl text-slate-300">
            Template approval, communication preferences, draft-only outreach, policy checks, and immutable timeline records. This workspace intentionally has no send button, no bulk sender, and no delete actions.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Field label="Workspace">
              <select className={inputClass} value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>
                <option value="">Select workspace</option>
                {workspaces.map((workspace) => (
                  <option key={text(workspace.id)} value={text(workspace.id)}>{text(workspace.name || workspace.slug)}</option>
                ))}
              </select>
            </Field>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-950/40 p-4 text-sm text-emerald-100">
              No autonomous sending. Draft, review, and audit only.
            </div>
            <div className="rounded-2xl border border-amber-400/20 bg-amber-950/40 p-4 text-sm text-amber-100">
              SMS/email/voice must pass consent, suppression, quiet-hour, and template checks.
            </div>
          </div>
          {message && <p className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-100">{message}</p>}
          {error && <p className="mt-4 rounded-lg border border-red-400/20 bg-red-950/40 px-4 py-2 text-sm text-red-100">{error}</p>}
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Template library">
            <form className="mb-5 grid gap-3" onSubmit={createTemplate}>
              <Field label="Template name"><input className={inputClass} name="name" placeholder="Family readiness follow-up" /></Field>
              <Field label="Channel"><select className={inputClass} name="channel"><option>email</option><option>sms</option><option>voice</option><option>mail</option></select></Field>
              <Field label="Purpose"><input className={inputClass} name="purpose" placeholder="education" /></Field>
              <button className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400" type="submit">Create template draft</button>
            </form>
            <div className="space-y-3">
              {templates.map((template) => (
                <article key={text(template.id)} className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{text(template.name)}</p>
                      <p className="text-sm text-slate-400">{text(template.channel)} · {text(template.purpose)} · {text(template.status)}</p>
                    </div>
                    {text(template.status) !== 'approved' && (
                      <button className="rounded-lg border border-emerald-400/30 px-3 py-1 text-xs font-semibold text-emerald-200" onClick={() => approveTemplate(text(template.id))} type="button">Approve</button>
                    )}
                  </div>
                </article>
              ))}
              {!templates.length && <p className="text-sm text-slate-400">No templates yet.</p>}
            </div>
          </Card>

          <Card title="Template version editor">
            <form className="grid gap-3" onSubmit={createVersion}>
              <Field label="Template ID"><input className={inputClass} name="template_id" defaultValue={selectedTemplateId} /></Field>
              <Field label="Version"><input className={inputClass} name="version" defaultValue="1" type="number" /></Field>
              <Field label="Subject"><input className={inputClass} name="subject" placeholder="Family Financial Readiness Review" /></Field>
              <Field label="Body"><textarea className={inputClass} name="body" rows={5} placeholder="Approved educational message body" /></Field>
              <button className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400" type="submit">Create template version</button>
            </form>
            <p className="mt-4 text-sm text-slate-400">Versions: {versions.length}</p>
          </Card>

          <Card title="Communication preferences">
            <form className="grid gap-3" onSubmit={createPreference}>
              <Field label="Person ID"><input className={inputClass} name="person_id" placeholder={uuidFallback} /></Field>
              <Field label="Channel"><select className={inputClass} name="channel"><option>email</option><option>sms</option><option>voice</option></select></Field>
              <Field label="Preference state"><select className={inputClass} name="preference_state"><option>allowed</option><option>do_not_contact</option><option>transactional_only</option><option>unknown</option></select></Field>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Quiet start"><input className={inputClass} name="quiet_hours_start" defaultValue="20:00" /></Field>
                <Field label="Quiet end"><input className={inputClass} name="quiet_hours_end" defaultValue="08:00" /></Field>
                <Field label="Daily cap"><input className={inputClass} name="max_frequency_per_day" defaultValue="1" type="number" /></Field>
              </div>
              <button className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400" type="submit">Record preference</button>
            </form>
            <p className="mt-4 text-sm text-slate-400">Preferences: {preferences.length}</p>
          </Card>

          <Card title="Draft communication workspace">
            <form className="grid gap-3" onSubmit={createDraftCommunication}>
              <Field label="Person ID"><input className={inputClass} name="person_id" placeholder={uuidFallback} /></Field>
              <Field label="Template ID"><input className={inputClass} name="template_id" defaultValue={selectedTemplateId} /></Field>
              <Field label="Channel"><select className={inputClass} name="channel"><option>email</option><option>sms</option><option>voice</option></select></Field>
              <Field label="Subject"><input className={inputClass} name="subject" placeholder="Educational follow-up" /></Field>
              <Field label="Body"><textarea className={inputClass} name="body" rows={5} placeholder="Draft-only communication body" /></Field>
              <button className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400" type="submit">Create draft communication</button>
            </form>
            <p className="mt-4 text-sm text-slate-400">Drafts/records: {communications.length}</p>
          </Card>

          <Card title="Policy-check panel">
            <form className="grid gap-3" onSubmit={recordPolicyCheck}>
              <Field label="Communication ID"><input className={inputClass} name="communication_id" defaultValue={selectedCommunicationId} /></Field>
              <Field label="Check type"><select className={inputClass} name="check_type"><option>consent</option><option>template</option><option>suppression</option><option>quiet_hours</option><option>frequency_cap</option><option>licensed_review</option></select></Field>
              <Field label="Decision"><select className={inputClass} name="decision"><option value="pass">pass</option><option value="warn">warn</option><option value="block">block</option><option value="review_required">review_required</option></select></Field>
              <Field label="Result"><textarea className={inputClass} name="reason" rows={3} placeholder="Document the review outcome" /></Field>
              <button className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400" type="submit">Record policy check</button>
            </form>
            <p className="mt-4 text-sm text-slate-400">Policy checks: {policyChecks.length}</p>
          </Card>

          <Card title="Communication timeline">
            <form className="mb-5 grid gap-3" onSubmit={recordCommunicationEvent}>
              <Field label="Communication ID"><input className={inputClass} name="communication_id" defaultValue={selectedCommunicationId} /></Field>
              <Field label="Event type"><select className={inputClass} name="event_type"><option>review_requested</option><option>approved</option><option>blocked</option><option>scheduled</option><option>provider_callback</option></select></Field>
              <button className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400" type="submit">Record timeline event</button>
            </form>
            <div className="space-y-3">
              {events.map((entry) => (
                <article key={text(entry.id)} className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
                  <p className="font-semibold text-white">{text(entry.event_type)}</p>
                  <p className="text-sm text-slate-400">Communication: {text(entry.communication_id)}</p>
                </article>
              ))}
              {!events.length && <p className="text-sm text-slate-400">No timeline events yet.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
