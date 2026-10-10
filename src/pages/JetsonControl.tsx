import { Activity, Battery, Camera, Cpu, Mic, Radio, ShieldCheck, Volume2 } from 'lucide-react';

const devices = [
  { name: 'Wearable Gateway', model: 'D3VONN Universal Adapter', status: 'Ready', battery: '—' },
  { name: 'Meta Adapter', model: 'DAT / VisionClaw bridge', status: 'Adapter-ready', battery: '—' },
  { name: 'Jetson Edge Node', model: 'Edge AI Control Plane', status: 'Ready', battery: '—' },
];

const capabilities = [
  ['Camera', Camera, 'Vision ingress'],
  ['Microphone', Mic, 'Voice commands'],
  ['Audio', Volume2, 'Agent responses'],
  ['Display', Radio, 'HUD-capable output'],
  ['Telemetry', Activity, 'Health + connectivity'],
  ['Policy', ShieldCheck, 'Human approval gates'],
] as const;

const JetsonControl = () => (
  <main className="min-h-screen bg-background p-6 text-foreground">
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">D3VONN Wearable OS</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Wearable Command Center</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Vendor-neutral control plane for AI glasses, VisionClaw ingress, edge inference, agent execution, and human approval.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Gateway architecture ready
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {devices.map((device) => (
          <article key={device.name} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">{device.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{device.model}</p>
              </div>
              <Cpu className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="mt-6 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span>{device.status}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Battery</span>
              <span className="inline-flex items-center gap-1"><Battery className="h-4 w-4" />{device.battery}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <article className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Live Vision Pipeline</h2>
              <p className="text-sm text-muted-foreground">Normalized multimodal ingress → D3VONN Coordinator</p>
            </div>
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Activity className="h-4 w-4" /> Awaiting device</span>
          </div>
          <div className="mt-5 flex min-h-72 items-center justify-center rounded-xl border border-dashed bg-muted/20 text-center">
            <div>
              <Camera className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-medium">No live wearable stream connected</p>
              <p className="mt-1 text-sm text-muted-foreground">Connect a supported adapter to begin camera/audio ingestion.</p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">Capability Matrix</h2>
          <div className="mt-4 space-y-3">
            {capabilities.map(([label, Icon, detail]) => (
              <div key={label} className="flex items-center gap-3 rounded-xl border p-3">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1"><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{detail}</p></div>
                <span className="text-xs text-muted-foreground">Adapter</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">Agent Control</h2>
          <p className="mt-1 text-sm text-muted-foreground">See → hear → understand → decide → act → verify.</p>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            {['Ask D3VONN', 'Analyze scene', 'Create lead', 'Create task', 'Execute workflow', 'Request approval'].map((action) => (
              <button key={action} type="button" className="rounded-xl border px-4 py-3 text-left transition hover:bg-muted">{action}</button>
            ))}
          </div>
        </article>
        <article className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">Safety & Audit</h2>
          <p className="mt-1 text-sm text-muted-foreground">Consequential actions stay behind policy and human approval by default.</p>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between border-b pb-3"><span>Privacy metadata</span><span>Required</span></div>
            <div className="flex justify-between border-b pb-3"><span>Action correlation</span><span>Required</span></div>
            <div className="flex justify-between border-b pb-3"><span>Approval gate</span><span>Policy-driven</span></div>
            <div className="flex justify-between"><span>Event idempotency</span><span>Enabled by contract</span></div>
          </div>
        </article>
      </section>
    </div>
  </main>
);

export default JetsonControl;
