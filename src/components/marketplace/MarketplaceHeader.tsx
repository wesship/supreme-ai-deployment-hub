import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Sparkles, TrendingUp } from 'lucide-react';

interface MarketplaceHeaderProps {
  totalAgents: number;
  featuredCount: number;
  onPublishClick?: () => void;
}

const MarketplaceHeader: React.FC<MarketplaceHeaderProps> = ({
  totalAgents,
  featuredCount,
  onPublishClick
}) => {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-background to-secondary/20 border border-border/50 p-8 mb-8">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-white/5 [mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)]" />
      
      <div className="relative z-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                Agent Marketplace
              </h2>
              <Badge variant="secondary" className="animate-pulse">
                <Sparkles className="w-3 h-3 mr-1" />
                Beta
              </Badge>
            </div>
            
            <p className="text-muted-foreground max-w-xl">
              Discover, deploy, and share autonomous AI agents for infrastructure management, 
              security monitoring, and enterprise automation.
            </p>
            
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span><strong>{totalAgents}</strong> agents available</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span><strong>{featuredCount}</strong> featured</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="gap-2">
              Browse Categories
            </Button>
            <Button className="gap-2" onClick={onPublishClick}>
              <Plus className="w-4 h-4" />
              Publish Agent
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketplaceHeader;
