import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { CheckCircle2, Rocket, Server, Zap } from 'lucide-react';
import type { AgentDeploymentConfig, AgentTemplate } from '@/types/marketplace';
import { getPricingLabel } from '@/data/mockAgentTemplates';
import { useDeployAgent } from '@/hooks/useDeployedAgents';

interface DeployAgentModalProps { agent: AgentTemplate | null; open: boolean; onClose: () => void; onDeployComplete: (agent: AgentTemplate, config: AgentDeploymentConfig) => void; }

const DeployAgentModal: React.FC<DeployAgentModalProps> = ({ agent, open, onClose, onDeployComplete }) => {
  const navigate = useNavigate(); const deployMutation = useDeployAgent();
  const [step, setStep] = useState<'config' | 'review' | 'deploying' | 'complete'>('config');
  const [enableNotifications, setEnableNotifications] = useState(false); const [deployedId, setDeployedId] = useState<string | null>(null);
  const [config, setConfig] = useState<AgentDeploymentConfig>({ name: '', environment: 'development', notifications: {} });

  useEffect(() => { if (agent) setConfig({ name: `${agent.slug}-1`, environment: 'development', notifications: {} }); setEnableNotifications(false); setDeployedId(null); setStep('config'); }, [agent]);
  if (!agent) return null;

  const handleDeploy = async () => {
    setStep('deploying');
    try {
      const deployed = await deployMutation.mutateAsync({
        catalog_key: agent.id,
        name: config.name,
        config: { slug: agent.slug, environment: config.environment, notifications: enableNotifications ? config.notifications : {}, integrations: agent.integrations ?? [], requirements: agent.requirements ?? [], openmontage: agent.slug === 'openmontage-video-intelligence-studio' },
        mcp_config: { enabled_tools: agent.slug === 'openmontage-video-intelligence-studio' ? ['hermes', 'ffmpeg', 'media-provider', 'publish'] : [] },
      });
      setDeployedId(deployed?.id ?? null); setStep('complete'); onDeployComplete(agent, config);
    } catch { setStep('review'); }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg bg-background/95 backdrop-blur-xl border-border/50">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Rocket className="w-5 h-5 text-primary" />Deploy {agent.name}</DialogTitle><DialogDescription>Creates a governed installation record and enables the agent for your workspace.</DialogDescription></DialogHeader>
        {step === 'config' && <div className="space-y-6 py-4">
          <div className="space-y-2"><Label htmlFor="instance-name">Instance Name</Label><Input id="instance-name" value={config.name} onChange={(event) => setConfig({ ...config, name: event.target.value })} /></div>
          <div className="space-y-3"><Label>Environment</Label><RadioGroup value={config.environment} onValueChange={(environment: AgentDeploymentConfig['environment']) => setConfig({ ...config, environment })} className="flex gap-4">{(['development','staging','production'] as const).map((environment) => <div className="flex items-center space-x-2" key={environment}><RadioGroupItem value={environment} id={environment} /><Label htmlFor={environment} className="font-normal capitalize cursor-pointer">{environment}</Label></div>)}</RadioGroup></div>
          <div className="flex items-center justify-between"><Label htmlFor="notifications">Enable Notifications</Label><Switch id="notifications" checked={enableNotifications} onCheckedChange={setEnableNotifications} /></div>
          {enableNotifications && <Input placeholder="Notification email" value={config.notifications?.email?.[0] ?? ''} onChange={(event) => setConfig({ ...config, notifications: { email: event.target.value ? [event.target.value] : undefined } })} />}
          {agent.slug === 'openmontage-video-intelligence-studio' && <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">OpenMontage will request Hermes, FFmpeg, media-provider, and publishing capabilities.</div>}
          <Separator /><div className="flex items-center justify-between rounded-lg bg-secondary/30 p-4"><div><div className="font-medium">{agent.name}</div><div className="text-sm text-muted-foreground">{agent.version}</div></div><div className="text-xl font-bold text-primary">{getPricingLabel(agent.pricing)}</div></div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => setStep('review')} disabled={!config.name.trim()}>Review & Deploy</Button></div>
        </div>}
        {step === 'review' && <div className="space-y-6 py-4"><div className="space-y-3"><div className="flex justify-between rounded-lg bg-secondary/30 p-3"><span className="text-muted-foreground">Instance</span><span className="font-medium">{config.name}</span></div><div className="flex justify-between rounded-lg bg-secondary/30 p-3"><span className="text-muted-foreground">Environment</span><Badge variant="outline" className="capitalize">{config.environment}</Badge></div><div className="flex justify-between rounded-lg border border-primary/20 bg-primary/10 p-3"><span className="font-medium">Total</span><span className="font-bold text-primary">{getPricingLabel(agent.pricing)}</span></div></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setStep('config')}>Back</Button><Button onClick={handleDeploy} disabled={deployMutation.isPending}><Rocket className="mr-2 h-4 w-4" />Deploy Now</Button></div></div>}
        {step === 'deploying' && <div className="space-y-4 py-12 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 animate-pulse"><Zap className="h-8 w-8 text-primary" /></div><div className="text-lg font-medium">Creating governed installation…</div></div>}
        {step === 'complete' && <div className="space-y-4 py-12 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20"><CheckCircle2 className="h-8 w-8 text-green-500" /></div><div><div className="text-lg font-medium">Deployment Complete</div><div className="mt-1 text-sm text-muted-foreground">{agent.name} is registered as {config.name}.</div></div><div className="flex justify-center gap-2 pt-4"><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={() => navigate(agent.slug === 'openmontage-video-intelligence-studio' ? '/film' : `/agents${deployedId ? `?agent=${deployedId}` : ''}`)}><Server className="mr-2 h-4 w-4" />{agent.slug === 'openmontage-video-intelligence-studio' ? 'Open Film Studio' : 'View Agent'}</Button></div></div>}
      </DialogContent>
    </Dialog>
  );
};

export default DeployAgentModal;
