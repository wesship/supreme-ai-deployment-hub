import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, LockKeyhole, Play, ShieldCheck } from 'lucide-react';
import { assuranceFetch } from '@/lib/assurance/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type Gateway = { id: string; label: string; origin: string; expires_at?: string | null };

export function SecureMcpRunner() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [gatewayId, setGatewayId] = useState('');
  const [goal, setGoal] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'running' | 'complete' | 'error'>('loading');
  const [message, setMessage] = useState('Loading your approved gateways…');
  const [result, setResult] = useState<unknown>(null);

  useEffect(() => {
    void assuranceFetch<{ gateways: Gateway[] }>('/api/assurance/mcp/gateways')
      .then(({ gateways }) => {
        setGateways(gateways);
        setGatewayId(gateways[0]?.id || '');
        setStatus('idle');
        setMessage(gateways.length ? 'Select an approved gateway and define the supervised task.' : 'No approved MCP gateways are available for this workspace.');
      })
      .catch((error: Error) => {
        setStatus('error');
        setMessage(error.message);
      });
  }, []);

  const run = async () => {
    if (!gatewayId || !goal.trim()) return;
    setStatus('running');
    setMessage('Validating the approved gateway and creating a governed execution record…');
    setResult(null);
    try {
      const response = await assuranceFetch<{ run_id: string; gateway: string; result: unknown }>('/api/assurance/mcp/runs', {
        method: 'POST',
        body: JSON.stringify({ gateway_id: gatewayId, goal, max_steps: 10 }),
      });
      setResult(response);
      setStatus('complete');
      setMessage(`Governed request ${response.run_id} completed against ${response.gateway}.`);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Gateway execution was blocked.');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-emerald-400/20 bg-emerald-500/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-400" /> Governed MCP execution</CardTitle>
          <CardDescription>Only authenticated operators can use pre-registered HTTPS gateways. Destination validation, rate limits, DNS-rebinding checks, and audit logging happen on the server before a request is sent.</CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5" /> Approved gateway request</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="approved-gateway">Approved gateway</Label>
            <Select value={gatewayId} onValueChange={setGatewayId} disabled={status === 'loading' || status === 'running'}>
              <SelectTrigger id="approved-gateway"><SelectValue placeholder="Select a registered gateway" /></SelectTrigger>
              <SelectContent>
                {gateways.map((gateway) => <SelectItem key={gateway.id} value={gateway.id}>{gateway.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="governed-goal">Goal / task</Label>
            <Textarea id="governed-goal" value={goal} onChange={(event) => setGoal(event.target.value)} disabled={status === 'running'} placeholder="Describe the approved task for this gateway." rows={4} />
          </div>
          <Button onClick={run} disabled={status === 'loading' || status === 'running' || !gatewayId || !goal.trim()}>
            <Play className="mr-2 h-4 w-4" /> {status === 'running' ? 'Validating and running…' : 'Run governed request'}
          </Button>
          <div role="status" aria-live="polite" className={`rounded-lg border p-3 text-sm ${status === 'error' ? 'border-red-500/40 bg-red-500/10 text-red-200' : status === 'complete' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100' : 'border-white/10 bg-white/[0.03] text-white/70'}`}>
            {status === 'error' ? <AlertCircle className="mr-2 inline h-4 w-4" /> : status === 'complete' ? <CheckCircle2 className="mr-2 inline h-4 w-4" /> : null}{message}
          </div>
          {result && <pre className="max-h-72 overflow-auto rounded-lg bg-black/30 p-4 text-xs text-white/80">{JSON.stringify(result, null, 2)}</pre>}
        </CardContent>
      </Card>
    </div>
  );
}
