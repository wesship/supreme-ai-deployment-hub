import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, ArrowRight, CheckCircle } from 'lucide-react';
import { AgentTemplate } from '@/types/marketplace';
import { getPricingLabel } from '@/data/mockAgentTemplates';

interface FeaturedAgentsProps {
  agents: AgentTemplate[];
  onView: (agent: AgentTemplate) => void;
  onDeploy: (agent: AgentTemplate) => void;
}

const FeaturedAgents: React.FC<FeaturedAgentsProps> = ({ agents, onView, onDeploy }) => {
  if (agents.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
          Featured Agents
        </h2>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          View All <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {agents.slice(0, 4).map((agent) => (
          <Card 
            key={agent.id} 
            className="group relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-background hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 cursor-pointer"
            onClick={() => onView(agent)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="text-3xl">{agent.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                      {agent.name}
                    </h3>
                    {agent.author.verified && (
                      <CheckCircle className="w-3 h-3 text-primary flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {agent.description}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  <span>{agent.stats.avgRating}</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {getPricingLabel(agent.pricing)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default FeaturedAgents;
