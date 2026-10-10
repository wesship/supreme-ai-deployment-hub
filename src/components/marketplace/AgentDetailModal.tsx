import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Star, 
  Download, 
  CheckCircle, 
  ExternalLink, 
  Calendar,
  Zap,
  Shield,
  Settings
} from 'lucide-react';
import { AgentTemplate } from '@/types/marketplace';
import { getPricingLabel, getCategoryLabel, getCategoryIcon } from '@/data/mockAgentTemplates';

interface AgentDetailModalProps {
  agent: AgentTemplate | null;
  open: boolean;
  onClose: () => void;
  onDeploy: (agent: AgentTemplate) => void;
}

const AgentDetailModal: React.FC<AgentDetailModalProps> = ({ 
  agent, 
  open, 
  onClose, 
  onDeploy 
}) => {
  if (!agent) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 gap-0 bg-background/95 backdrop-blur-xl border-border/50">
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-start gap-4">
            <div className="text-5xl">{agent.icon}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl">{agent.name}</DialogTitle>
                {agent.featured && (
                  <Badge className="bg-primary text-primary-foreground">Featured</Badge>
                )}
              </div>
              <DialogDescription className="mt-1">
                v{agent.version} • {getCategoryIcon(agent.category)} {getCategoryLabel(agent.category)}
              </DialogDescription>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm text-muted-foreground">by</span>
                <span className="text-sm font-medium">{agent.author.name}</span>
                {agent.author.verified && (
                  <CheckCircle className="w-4 h-4 text-primary" />
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {getPricingLabel(agent.pricing)}
              </div>
              <Button 
                className="mt-2 w-full"
                onClick={() => onDeploy(agent)}
              >
                Deploy Now
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Separator />

        <ScrollArea className="flex-1 max-h-[50vh]">
          <div className="p-6 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center justify-center gap-1 text-lg font-bold">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  {agent.stats.avgRating}
                </div>
                <div className="text-xs text-muted-foreground">{agent.stats.reviewCount} reviews</div>
              </div>
              <div className="text-center p-3 bg-secondary/30 rounded-lg">
                <div className="text-lg font-bold">{agent.stats.downloads.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Downloads</div>
              </div>
              <div className="text-center p-3 bg-secondary/30 rounded-lg">
                <div className="text-lg font-bold">{agent.stats.activeInstalls.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Active Installs</div>
              </div>
              <div className="text-center p-3 bg-secondary/30 rounded-lg">
                <div className="text-lg font-bold flex items-center justify-center gap-1">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="text-xs text-muted-foreground">Updated {agent.stats.lastUpdated}</div>
              </div>
            </div>

            {/* Description */}
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Description
              </h4>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {agent.longDescription || agent.description}
              </p>
            </div>

            {/* Capabilities */}
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Capabilities
              </h4>
              <div className="flex flex-wrap gap-2">
                {agent.capabilities.map((cap) => (
                  <Badge key={cap} variant="secondary" className="capitalize">
                    {cap.replace('-', ' ')}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <h4 className="font-semibold mb-2">Tags</h4>
              <div className="flex flex-wrap gap-1.5">
                {agent.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Requirements */}
            {agent.requirements && agent.requirements.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Requirements
                </h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {agent.requirements.map((req, index) => (
                    <li key={index}>{req}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Integrations */}
            {agent.integrations && agent.integrations.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Integrations
                </h4>
                <div className="flex flex-wrap gap-2">
                  {agent.integrations.map((integration) => (
                    <Badge key={integration} variant="outline">
                      {integration}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator />

        <div className="p-4 flex justify-between items-center bg-secondary/20">
          <div className="text-sm text-muted-foreground">
            Created by {agent.author.name} • {agent.author.agentCount} agents published
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => onDeploy(agent)}>
              Deploy Agent
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AgentDetailModal;
