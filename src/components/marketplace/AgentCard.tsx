import React from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, Download, CheckCircle } from 'lucide-react';
import { AgentTemplate } from '@/types/marketplace';
import { getPricingLabel } from '@/data/mockAgentTemplates';

interface AgentCardProps {
  agent: AgentTemplate;
  onView: (agent: AgentTemplate) => void;
  onDeploy: (agent: AgentTemplate) => void;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, onView, onDeploy }) => {
  return (
    <Card className="group relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300">
      {agent.featured && (
        <div className="absolute top-0 right-0 bg-gradient-to-l from-primary to-primary/80 text-primary-foreground text-xs px-3 py-1 rounded-bl-lg font-medium">
          Featured
        </div>
      )}
      
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-start gap-3">
          <div className="text-4xl">{agent.icon}</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {agent.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">by</span>
              <span className="text-xs text-foreground/80 font-medium">{agent.author.name}</span>
              {agent.author.verified && (
                <CheckCircle className="w-3 h-3 text-primary" />
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {agent.description}
        </p>
        
        <div className="flex flex-wrap gap-1.5">
          {agent.tags.slice(0, 3).map((tag) => (
            <Badge 
              key={tag} 
              variant="secondary" 
              className="text-xs bg-secondary/50 hover:bg-secondary/80"
            >
              {tag}
            </Badge>
          ))}
          {agent.tags.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{agent.tags.length - 3}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
            <span className="font-medium text-foreground">{agent.stats.avgRating}</span>
            <span>({agent.stats.reviewCount})</span>
          </div>
          <div className="flex items-center gap-1">
            <Download className="w-3.5 h-3.5" />
            <span>{agent.stats.activeInstalls.toLocaleString()} active</span>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex items-center justify-between pt-3 border-t border-border/50">
        <div className="text-sm font-semibold text-primary">
          {getPricingLabel(agent.pricing)}
        </div>
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onView(agent)}
            className="text-xs"
          >
            Details
          </Button>
          <Button 
            size="sm"
            onClick={() => onDeploy(agent)}
            className="text-xs bg-primary hover:bg-primary/90"
          >
            Deploy
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default AgentCard;
