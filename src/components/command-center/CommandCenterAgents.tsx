import AgentManager from "@/components/agent/AgentManager";

interface Props {
  onNavigate: (view: string) => void;
}

export default function CommandCenterAgents({ onNavigate }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Agent Management</h2>
        <p className="text-muted-foreground mt-1">Deploy, monitor, and orchestrate your AI agents</p>
      </div>
      <AgentManager />
    </div>
  );
}
