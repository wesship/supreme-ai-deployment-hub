import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { CheckCircle2, Circle, PauseCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import Container from '@/components/Container';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ACME_DEMO_GOAL,
  ACME_DEMO_METRICS,
  ACME_DEMO_SOURCES,
  resetAcmeDemo,
} from '@/demo/acmeDemo';

const AcmeDemoMode = () => {
  const [state, setState] = useState(resetAcmeDemo);

  const metrics = useMemo(() => {
    if (!state.approved) return ACME_DEMO_METRICS;
    return ACME_DEMO_METRICS.map((metric) => {
      if (metric.label === 'Tasks completed') return { ...metric, value: '7 / 7' };
      if (metric.label === 'Approvals recorded') return { ...metric, value: '1 / 1' };
      return metric;
    });
  }, [state.approved]);

  const approve = () => {
    setState((current) => ({
      ...current,
      approved: true,
      stages: current.stages.map((stage) => {
        if (stage.id === 'approval') return { ...stage, status: 'complete', detail: 'Human approval recorded in the simulation audit trail.' };
        if (stage.id === 'delivery') return { ...stage, status: 'complete', detail: 'Executive package released inside the isolated simulation.' };
        return stage;
      }),
    }));
  };

  return (
    <>
      <Helmet>
        <title>Acme Manufacturing Demo Mode | D3VONN.IO</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <D3vonnPageBanner title="Acme Manufacturing Demo Mode" />
      <Container>
        <div className="py-10 space-y-8">
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4" role="note">
            <p className="font-semibold text-amber-100">Simulation environment</p>
            <p className="mt-1 text-sm text-amber-100/75">
              All organizations, people, metrics, sources, and outcomes on this page are fictional. No email, CRM, billing, or production data writes occur.
            </p>
          </div>

          <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
            <Card>
              <CardHeader><CardTitle>Canonical business goal</CardTitle></CardHeader>
              <CardContent>
                <p className="text-lg leading-relaxed text-muted-foreground">{ACME_DEMO_GOAL}</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button onClick={approve} disabled={state.approved}>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    {state.approved ? 'Approved' : 'Approve and continue'}
                  </Button>
                  <Button variant="outline" onClick={() => setState(resetAcmeDemo)}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Reset demo
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Command metrics</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {metrics.map((metric) => (
                  <div key={metric.label} className="rounded-xl border bg-background/40 p-4">
                    <p className="text-2xl font-semibold">{metric.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{metric.label}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">Hermes execution plan</h2>
            <div className="mt-4 grid gap-3">
              {state.stages.map((stage, index) => {
                const Icon = stage.status === 'complete' ? CheckCircle2 : stage.status === 'approval' ? PauseCircle : Circle;
                return (
                  <Card key={stage.id}>
                    <CardContent className="flex gap-4 p-5">
                      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-semibold">{index + 1}. {stage.title}</h3>
                          <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">{stage.owner}</span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{stage.detail}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Approval package</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p><strong className="text-foreground">Executive brief:</strong> Plant modernization and supplier-risk opportunity summary.</p>
                <p><strong className="text-foreground">Outreach draft:</strong> Personalized executive message with no unverified performance claims.</p>
                <p><strong className="text-foreground">Compliance result:</strong> External delivery blocked until a human approves.</p>
                <p><strong className="text-foreground">Delivery boundary:</strong> Simulation-only; no message is transmitted.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Grounding sources</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {ACME_DEMO_SOURCES.map((source) => <li key={source}>• {source}</li>)}
                </ul>
              </CardContent>
            </Card>
          </section>
        </div>
      </Container>
    </>
  );
};

export default AcmeDemoMode;
