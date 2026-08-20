import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Battery, CheckCircle2, CircleAlert, Cpu, Eye, Gauge, Glasses, LockKeyhole, Radio, ShieldCheck, Thermometer } from 'lucide-react';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const gates = [
  ['Device identity', 'Enrollment and revocation boundary defined'],
  ['Capability discovery', 'Glasses, Jetson, companion and robotics classes supported'],
  ['Privacy controls', 'Sensor-sensitive operations require explicit policy approval'],
  ['OTA integrity', 'Signed artifact + staged rollout contract required'],
  ['Auditability', 'Command, result, actor and request IDs required'],
];

const JetsonControl = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <D3vonnPageBanner title="D3VONN.IO • Jetson & Smart Glasses Control" />
      <main className="container mx-auto max-w-6xl px-6 py-10">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="mb-8">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Return to Dashboard
        </Button>

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Radio className="h-3 w-3" />
              Edge device control plane
            </div>
            <h1 className="text-4xl font-bold text-foreground md:text-5xl">Jetson Control</h1>
            <p className="mt-3 max-w-3xl text-lg text-muted-foreground">
              Safety-first orchestration for NVIDIA Jetson edge nodes, Ray-Ban Meta smart glasses and companion devices,
              with a capability-aware path to robotics.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <CircleAlert className="h-4 w-4 text-primary" />
              Smart Glasses integration locked
            </div>
            <p className="mt-1 text-muted-foreground">Live vendor/device controls activate only after approved integration verification.</p>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Cpu className="h-4 w-4" />Jetson Nodes</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">0</div><p className="text-xs text-muted-foreground">enrolled / online</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Glasses className="h-4 w-4" />Smart Glasses</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">0</div><p className="text-xs text-muted-foreground">enrolled / paired</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Gauge className="h-4 w-4" />Telemetry</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">Ready</div><p className="text-xs text-muted-foreground">capability-aware contract</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><LockKeyhole className="h-4 w-4" />Commands</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">Locked</div><p className="text-xs text-muted-foreground">until backend authorization</p></CardContent></Card>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Glasses className="h-5 w-5" />Smart Glasses Fleet</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div><p className="font-medium">Ray-Ban Meta / Meta smart glasses</p><p className="text-sm text-muted-foreground">Capability discovery • companion-aware integration</p></div>
                  <span className="rounded-full border border-border px-2 py-1 text-xs">Not enrolled</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                {['Camera', 'Microphone', 'Audio', 'Display', 'Voice', 'Location'].map((capability) => (
                  <div key={capability} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2"><Eye className="h-3.5 w-3.5" />{capability}<span className="ml-auto text-xs text-muted-foreground">—</span></div>
                ))}
              </div>
              <p className="text-xs leading-5 text-muted-foreground">Capabilities are discovered per device generation. The control plane does not assume that every Meta glasses model exposes the same sensors, display or developer interface.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Device telemetry</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border p-4"><Battery className="h-4 w-4 mb-2" /><p className="text-xs text-muted-foreground">Battery</p><p className="font-semibold">—</p></div>
              <div className="rounded-xl border border-border p-4"><Radio className="h-4 w-4 mb-2" /><p className="text-xs text-muted-foreground">Network</p><p className="font-semibold">Offline</p></div>
              <div className="rounded-xl border border-border p-4"><Thermometer className="h-4 w-4 mb-2" /><p className="text-xs text-muted-foreground">Thermal</p><p className="font-semibold">—</p></div>
              <div className="rounded-xl border border-border p-4"><Cpu className="h-4 w-4 mb-2" /><p className="text-xs text-muted-foreground">Inference</p><p className="font-semibold">—</p></div>
              <div className="rounded-xl border border-border p-4"><Gauge className="h-4 w-4 mb-2" /><p className="text-xs text-muted-foreground">Memory</p><p className="font-semibold">—</p></div>
              <div className="rounded-xl border border-border p-4"><LockKeyhole className="h-4 w-4 mb-2" /><p className="text-xs text-muted-foreground">Privacy</p><p className="font-semibold">Locked</p></div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Production readiness gates</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {gates.map(([title, detail]) => (
                <div key={title} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div><p className="font-medium text-foreground">{title}</p><p className="text-sm text-muted-foreground">{detail}</p></div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Control flow</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
                {[
                  'Authenticated operator or approved automation requests a command.',
                  'Backend validates device identity, capability, authorization, expiry and privacy state.',
                  'Sensitive/high-impact actions require explicit policy approval.',
                  'Approved vendor/companion/Jetson adapter executes the bounded command.',
                  'Telemetry and result are persisted with an auditable command event.',
                ].map((step, index) => (
                  <li key={step} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold">{index + 1}</span><span className="text-muted-foreground">{step}</span></li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-6">
          <div className="flex gap-4">
            <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-primary" />
            <div>
              <h2 className="font-semibold text-foreground">Smart-glasses privacy boundary</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Camera, microphone, capture and location operations are treated as privacy-sensitive. A device in
                <strong> privacy_locked</strong>, revoked or quarantined state cannot receive those commands. The browser never directly activates a glasses sensor.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => navigate('/contact')}>Request Early Access</Button>
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>Return to Dashboard</Button>
        </div>
      </main>
    </div>
  );
};

export default JetsonControl;
