import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, CircleAlert, Cpu, Gauge, LockKeyhole, Radio, ShieldCheck, Thermometer } from 'lucide-react';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const gates = [
  ['Device identity', 'Enrollment and revocation boundary defined'],
  ['Command safety', 'Deny-by-default domain gates implemented'],
  ['OTA integrity', 'Signed artifact + staged rollout contract required'],
  ['Auditability', 'Command, result, actor and request IDs required'],
];

const JetsonControl = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <D3vonnPageBanner title="D3VONN.IO • Jetson Control" />
      <main className="container mx-auto max-w-6xl px-6 py-10">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="mb-8">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Return to Dashboard
        </Button>

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Radio className="h-3 w-3" />
              Control-plane foundation
            </div>
            <h1 className="text-4xl font-bold text-foreground md:text-5xl">Jetson Control</h1>
            <p className="mt-3 max-w-3xl text-lg text-muted-foreground">
              Safety-first edge AI orchestration for Jetson smart-glasses clusters and on-device robotics.
              The browser never talks directly to a device.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <CircleAlert className="h-4 w-4 text-primary" />
              Awaiting device enrollment
            </div>
            <p className="mt-1 text-muted-foreground">No live device commands are enabled by this surface.</p>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Cpu className="h-4 w-4" />Devices</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">0</div><p className="text-xs text-muted-foreground">enrolled / online</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Gauge className="h-4 w-4" />Telemetry</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">Ready</div><p className="text-xs text-muted-foreground">contract defined</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Thermometer className="h-4 w-4" />Safety</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">Guarded</div><p className="text-xs text-muted-foreground">deny-by-default gates</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><LockKeyhole className="h-4 w-4" />Commands</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">Locked</div><p className="text-xs text-muted-foreground">until backend authorization</p></CardContent></Card>
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
                  'Backend validates identity, authorization, expiry and device state.',
                  'Safety policy evaluates command impact and required approvals.',
                  'Authenticated device adapter executes the bounded command.',
                  'Telemetry and command result are persisted with an immutable audit event.',
                ].map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold">{index + 1}</span>
                    <span className="text-muted-foreground">{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-6">
          <div className="flex gap-4">
            <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-primary" />
            <div>
              <h2 className="font-semibold text-foreground">Safety boundary</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                High-impact operations such as model deployment, reboot and safe-state transitions are never
                granted by the UI. They require backend policy evaluation, device identity, command expiry,
                replay protection and an auditable execution result before they can reach a device adapter.
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
