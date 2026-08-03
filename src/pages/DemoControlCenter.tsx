import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { ExternalLink, Film, RefreshCw, ShieldCheck } from 'lucide-react';
import Container from '@/components/Container';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const scenarios = [
  { id: 'acme', name: 'Acme Manufacturing', industry: 'Industrial manufacturing', status: 'Ready', route: '/demo/acme/', purpose: 'Flagship governed-workflow recording' },
  { id: 'health', name: 'Northstar Health Network', industry: 'Healthcare operations', status: 'Planned', route: '', purpose: 'Intake, routing, and human escalation' },
  { id: 'finance', name: 'Summit Capital Services', industry: 'Financial services', status: 'Planned', route: '', purpose: 'Research, compliance, and approval' },
  { id: 'retail', name: 'Harbor Retail Group', industry: 'Retail operations', status: 'Planned', route: '', purpose: 'Inventory and customer-support orchestration' },
];

const recordingStages = ['Homepage', 'Goal submission', 'Hermes plan', 'Agent execution', 'Grounding sources', 'Human approval', 'Command metrics', 'Final package', 'Closing logo'];

export default function DemoControlCenter() {
  const [selected, setSelected] = useState('acme');
  const [cue, setCue] = useState(0);
  const scenario = useMemo(() => scenarios.find((item) => item.id === selected) ?? scenarios[0], [selected]);

  const reset = () => setCue(0);
  const nextCue = () => setCue((current) => Math.min(current + 1, recordingStages.length - 1));

  return (
    <>
      <Helmet><title>Demo Control Center | D3VONN.IO</title><meta name="robots" content="noindex,nofollow" /></Helmet>
      <D3vonnPageBanner title="Demo Control Center" />
      <Container>
        <div className="space-y-8 py-10">
          <div className="rounded-2xl border border-blue-400/30 bg-blue-400/10 p-4" role="note">
            <p className="font-semibold text-blue-100">Administrator-only simulation controls</p>
            <p className="mt-1 text-sm text-blue-100/75">All scenarios are fictional. This control center never sends email, writes to CRM, changes billing, or mutates production customer data.</p>
          </div>

          <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
            <Card>
              <CardHeader><CardTitle>Scenario library</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {scenarios.map((item) => (
                  <button key={item.id} onClick={() => { setSelected(item.id); setCue(0); }} className={`w-full rounded-xl border p-4 text-left transition ${selected === item.id ? 'border-blue-400 bg-blue-400/10' : 'border-border hover:border-blue-400/50'}`}>
                    <div className="flex items-center justify-between gap-3"><strong>{item.name}</strong><span className="text-xs text-muted-foreground">{item.status}</span></div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.industry} · {item.purpose}</p>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Selected scenario</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div><p className="text-sm text-muted-foreground">Workspace</p><p className="text-xl font-semibold">{scenario.name}</p></div>
                <div className="rounded-xl border border-border p-4"><p className="text-sm text-muted-foreground">Recording cue</p><p className="mt-1 font-semibold">{cue + 1}. {recordingStages[cue]}</p></div>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={nextCue} disabled={cue === recordingStages.length - 1}><Film className="mr-2 h-4 w-4" />Next cue</Button>
                  <Button variant="outline" onClick={reset}><RefreshCw className="mr-2 h-4 w-4" />Reset</Button>
                  {scenario.route ? <Button variant="secondary" asChild><a href={scenario.route} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open demo</a></Button> : null}
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 md:grid-cols-3">
            <Card><CardHeader><CardTitle>Safety boundary</CardTitle></CardHeader><CardContent><ShieldCheck className="mb-3 h-6 w-6 text-emerald-400" /><p className="text-sm text-muted-foreground">Simulation labels, noindex metadata, fictional data, local reset, and no production writes.</p></CardContent></Card>
            <Card><CardHeader><CardTitle>Recording standard</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">1920×1080, clean browser profile, notifications off, 100% zoom, deliberate cursor movement, and modular clips.</p></CardContent></Card>
            <Card><CardHeader><CardTitle>Required exports</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">90s master, 30s cut, 15s teaser, WebM, MP4, poster, WebVTT captions, transcript, and six product loops.</p></CardContent></Card>
          </section>
        </div>
      </Container>
    </>
  );
}
