import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, RefreshCw, UsersRound } from 'lucide-react';
import { primetimeRelease1Api, type PrimetimeRecord } from '@/lib/primetimeRelease1Api';

function value(record: PrimetimeRecord, key: string, fallback = '—') {
  const current = record[key];
  return typeof current === 'string' || typeof current === 'number' ? String(current) : fallback;
}

function shortDate(input: unknown) {
  if (typeof input !== 'string' || !input) return '—';
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? input : parsed.toLocaleString();
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-xl shadow-black/20">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const inputClass = 'w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-400';
const buttonClass = 'rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50';

export default function PrimetimeScheduling() {
  const [workspaces, setWorkspaces] = useState<PrimetimeRecord[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [userId, setUserId] = useState('');
  const [appointments, setAppointments] = useState<PrimetimeRecord[]>([]);
  const [availabilityRules, setAvailabilityRules] = useState<PrimetimeRecord[]>([]);
  const [reminders, setReminders] = useState<PrimetimeRecord[]>([]);
  const [noShows, setNoShows] = useState<PrimetimeRecord[]>([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const [appointment, setAppointment] = useState({ title: '', start_at: '', end_at: '', appointment_type: 'review', location_value: '', compliance_state: 'pending' });
  const [availability, setAvailability] = useState({ rule_name: 'Standard availability', day_of_week: '1', start_time: '09:00', end_time: '17:00', timezone: 'America/Denver' });
  const [reminder, setReminder] = useState({ appointment_id: '', channel: 'email', scheduled_for: '' });
  const [attendee, setAttendee] = useState({ appointment_id: '', person_id: '', attendee_role: 'prospect' });
  const [calendarEvent, setCalendarEvent] = useState({ appointment_id: '', provider: 'google_calendar', external_event_id: '' });

  async function loadWorkspaceData(nextWorkspaceId = workspaceId) {
    if (!nextWorkspaceId) return;
    setLoading(true);
    setError('');
    try {
      const [daily, appointmentRows, availabilityRows, reminderRows, noShowRows] = await Promise.all([
        primetimeRelease1Api.getDailyDashboard(nextWorkspaceId),
        primetimeRelease1Api.listAppointments(nextWorkspaceId),
        primetimeRelease1Api.listAvailabilityRules(nextWorkspaceId),
        primetimeRelease1Api.listReminders(nextWorkspaceId),
        primetimeRelease1Api.listNoShowEvents(nextWorkspaceId),
      ]);
      setUserId(daily.userId);
      setAppointments(appointmentRows);
      setAvailabilityRules(availabilityRows);
      setReminders(reminderRows);
      setNoShows(noShowRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load scheduling workspace');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    primetimeRelease1Api.listWorkspaces()
      .then((rows) => {
        setWorkspaces(rows);
        const first = rows[0]?.id;
        if (typeof first === 'string') {
          setWorkspaceId(first);
          void loadWorkspaceData(first);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load workspaces'));
  }, []);

  const appointmentsByStatus = useMemo(() => {
    const groups = new Map<string, PrimetimeRecord[]>();
    for (const row of appointments) {
      const statusKey = value(row, 'status', 'scheduled');
      groups.set(statusKey, [...(groups.get(statusKey) || []), row]);
    }
    return Array.from(groups.entries());
  }, [appointments]);

  async function submit(action: () => Promise<unknown>, message: string) {
    if (!workspaceId) return;
    setStatus('');
    setError('');
    try {
      await action();
      setStatus(message);
      await loadWorkspaceData(workspaceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete scheduling action');
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-300">PRIMETIME Release 2</p>
              <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Scheduling and Daily Operations</h1>
              <p className="mt-3 max-w-3xl text-slate-300">
                Appointment creation, availability rules, reminders, no-show recovery, and calendar-sync visibility through governed PRIMETIME APIs.
              </p>
            </div>
            <label className="min-w-72 text-sm text-slate-300">
              Workspace
              <select
                value={workspaceId}
                onChange={(event) => {
                  setWorkspaceId(event.target.value);
                  void loadWorkspaceData(event.target.value);
                }}
                className={inputClass}
              >
                <option value="">Select workspace</option>
                {workspaces.map((workspace) => (
                  <option key={value(workspace, 'id')} value={value(workspace, 'id')}>
                    {value(workspace, 'name', value(workspace, 'slug', 'Workspace'))}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        {error && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>}
        {status && <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">{status}</div>}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5"><UsersRound className="h-5 w-5 text-blue-300" /><p className="mt-2 text-sm text-slate-400">Appointments</p><p className="text-3xl font-bold">{appointments.length}</p></div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5"><Clock3 className="h-5 w-5 text-blue-300" /><p className="mt-2 text-sm text-slate-400">Availability rules</p><p className="text-3xl font-bold">{availabilityRules.length}</p></div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5"><CalendarClock className="h-5 w-5 text-blue-300" /><p className="mt-2 text-sm text-slate-400">Pending reminders</p><p className="text-3xl font-bold">{reminders.length}</p></div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5"><AlertTriangle className="h-5 w-5 text-amber-300" /><p className="mt-2 text-sm text-slate-400">No-show events</p><p className="text-3xl font-bold">{noShows.length}</p></div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card title="Create appointment">
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void submit(() => primetimeRelease1Api.createAppointment({ workspace_id: workspaceId, owner_id: userId, title: appointment.title, start_at: appointment.start_at, end_at: appointment.end_at, appointment_type: appointment.appointment_type, location_value: appointment.location_value_value, compliance_state: appointment.compliance_state }), 'Appointment created and audit logged.'); }}>
              <input className={inputClass} placeholder="Title" value={appointment.title} onChange={(event) => setAppointment({ ...appointment, title: event.target.value })} required />
              <input className={inputClass} placeholder="Meeting type" value={appointment.appointment_type} onChange={(event) => setAppointment({ ...appointment, appointment_type: event.target.value })} />
              <input className={inputClass} aria-label="Start" type="datetime-local" value={appointment.start_at} onChange={(event) => setAppointment({ ...appointment, start_at: event.target.value })} required />
              <input className={inputClass} aria-label="End" type="datetime-local" value={appointment.end_at} onChange={(event) => setAppointment({ ...appointment, end_at: event.target.value })} required />
              <input className={inputClass} placeholder="Location" value={appointment.location_value} onChange={(event) => setAppointment({ ...appointment, location_value: event.target.value })} />
              <select className={inputClass} value={appointment.compliance_state} onChange={(event) => setAppointment({ ...appointment, compliance_state: event.target.value })}>
                <option value="pending">pending</option>
                <option value="review_required">review_required</option>
                <option value="passed">passed</option>
                <option value="blocked">blocked</option>
              </select>
              <button className={buttonClass} disabled={!workspaceId || !userId || !appointment.title || !appointment.start_at || !appointment.end_at}>Create appointment</button>
            </form>
          </Card>

          <Card title="Availability rule">
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void submit(() => primetimeRelease1Api.createAvailabilityRule({ workspace_id: workspaceId, user_id: userId, rule_name: availability.rule_name, day_of_week: Number(availability.day_of_week), start_time: availability.start_time, end_time: availability.end_time, timezone: availability.timezone, is_active: true }), 'Availability rule created.'); }}>
              <select className={inputClass} value={availability.day_of_week} onChange={(event) => setAvailability({ ...availability, day_of_week: event.target.value })}>
                <option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option>
              </select>
              <input className={inputClass} aria-label="Availability start" type="time" value={availability.start_time} onChange={(event) => setAvailability({ ...availability, start_at: event.target.value })} />
              <input className={inputClass} aria-label="Availability end" type="time" value={availability.end_time} onChange={(event) => setAvailability({ ...availability, end_at: event.target.value })} />
              <input className={inputClass} placeholder="Timezone" value={availability.timezone} onChange={(event) => setAvailability({ ...availability, timezone: event.target.value })} />
              <button className={buttonClass} disabled={!workspaceId || !userId}>Create availability</button>
            </form>
          </Card>
        </section>

        <Card title="Appointment board">
          {loading && <p className="text-sm text-blue-300">Loading scheduling data…</p>}
          {appointmentsByStatus.length === 0 && <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">No appointments returned yet.</p>}
          <div className="grid gap-4 lg:grid-cols-3">
            {appointmentsByStatus.map(([statusKey, rows]) => (
              <div key={statusKey} className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between"><h3 className="font-semibold text-white">{statusKey}</h3><span className="rounded-full bg-white/10 px-2 py-1 text-xs">{rows.length}</span></div>
                <div className="mt-3 space-y-3">
                  {rows.map((row) => (
                    <article key={value(row, 'id')} className="rounded-lg bg-white/5 p-3 text-sm">
                      <p className="font-medium text-white">{value(row, 'title')}</p>
                      <p className="text-slate-400">{shortDate(row.start_at)} → {shortDate(row.end_at)}</p>
                      <div className="mt-3 flex gap-2">
                        <button className="rounded-lg bg-emerald-500/20 px-3 py-1 text-xs text-emerald-100" onClick={() => void submit(() => primetimeRelease1Api.updateAppointment(value(row, 'id'), { status: 'completed' }), 'Appointment marked completed.')}>Complete</button>
                        <button className="rounded-lg bg-amber-500/20 px-3 py-1 text-xs text-amber-100" onClick={() => void submit(() => primetimeRelease1Api.updateAppointment(value(row, 'id'), { status: 'no_show' }), 'No-show recovery triggered.')}>No-show</button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card title="Reminder queue">
            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void submit(() => primetimeRelease1Api.createReminder({ workspace_id: workspaceId, appointment_id: reminder.appointment_id, recipient_user_id: userId, channel: reminder.channel, scheduled_for: reminder.scheduled_for, status: 'pending' }), 'Reminder queued.'); }}>
              <select className={inputClass} value={reminder.appointment_id} onChange={(event) => setReminder({ ...reminder, appointment_id: event.target.value })}><option value="">Select appointment</option>{appointments.map((row) => <option key={value(row, 'id')} value={value(row, 'id')}>{value(row, 'title')}</option>)}</select>
              <select className={inputClass} value={reminder.channel} onChange={(event) => setReminder({ ...reminder, channel: event.target.value })}><option>email</option><option>sms</option><option>voice</option></select>
              <input className={inputClass} aria-label="Reminder time" type="datetime-local" value={reminder.scheduled_for} onChange={(event) => setReminder({ ...reminder, scheduled_for: event.target.value })} />
              <button className={buttonClass} disabled={!workspaceId || !reminder.appointment_id || !reminder.scheduled_for}>Create reminder</button>
            </form>
            <div className="mt-4 space-y-2">{reminders.map((row) => <p key={value(row, 'id')} className="rounded-lg bg-white/5 p-2 text-sm">{value(row, 'channel')} · {shortDate(row.scheduled_for)}</p>)}</div>
          </Card>

          <Card title="Attendees and calendar sync">
            <div className="space-y-3">
              <select className={inputClass} value={attendee.appointment_id} onChange={(event) => { setAttendee({ ...attendee, appointment_id: event.target.value }); setCalendarEvent({ ...calendarEvent, appointment_id: event.target.value }); }}><option value="">Select appointment</option>{appointments.map((row) => <option key={value(row, 'id')} value={value(row, 'id')}>{value(row, 'title')}</option>)}</select>
              <input className={inputClass} placeholder="Person ID for attendee" value={attendee.person_id} onChange={(event) => setAttendee({ ...attendee, person_id: event.target.value })} />
              <button className={buttonClass} disabled={!workspaceId || !attendee.appointment_id || !attendee.person_id} onClick={() => void submit(() => primetimeRelease1Api.createAppointmentAttendee({ workspace_id: workspaceId, ...attendee }), 'Appointment attendee added.')}>Add attendee</button>
              <input className={inputClass} placeholder="External calendar event ID" value={calendarEvent.external_event_id} onChange={(event) => setCalendarEvent({ ...calendarEvent, external_event_id: event.target.value })} />
              <button className={`${buttonClass} bg-indigo-500 hover:bg-indigo-400`} disabled={!workspaceId || !calendarEvent.appointment_id || !calendarEvent.external_event_id} onClick={() => void submit(() => primetimeRelease1Api.createCalendarSyncEvent({ workspace_id: workspaceId, ...calendarEvent, direction: 'outbound', status: 'pending' }), 'Calendar sync event recorded as non-authoritative.')}>Record calendar sync</button>
            </div>
          </Card>

          <Card title="No-show recovery">
            {noShows.length === 0 && <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">No no-show events returned.</p>}
            <div className="space-y-3">
              {noShows.map((row) => (
                <article key={value(row, 'id')} className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm">
                  <p className="font-semibold text-amber-100">{value(row, 'recovery_status', 'pending')}</p>
                  <p className="text-amber-100/70">Appointment: {value(row, 'appointment_id')}</p>
                </article>
              ))}
            </div>
          </Card>
        </section>

        <footer className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 text-sm text-slate-400">
          <RefreshCw className="mb-2 h-5 w-5 text-blue-300" /> Calendar sync records are integration events only. The appointment table remains the authoritative scheduling state.
        </footer>
      </div>
    </div>
  );
}
