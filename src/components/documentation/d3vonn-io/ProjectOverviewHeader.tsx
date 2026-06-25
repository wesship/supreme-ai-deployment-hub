
import React from 'react';
import { Badge } from '@/components/ui/badge';

const ProjectOverviewHeader: React.FC = () => {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-2 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Devonn.AI Project Overview
        </h2>
        <p className="text-muted-foreground max-w-3xl">
          An intelligent, modular AI agent factory that builds other AIs, with all the components you need to launch, run, and expand.
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Badge variant="outline" className="px-4 py-2 text-sm font-medium border-2 border-primary/50 self-start md:self-auto">
          Production Ready
        </Badge>
        <Badge variant="default" className="px-4 py-2 text-sm font-medium self-start md:self-auto">
          AI-Powered
        </Badge>
      </div>
    </div>
  );
};

export default ProjectOverviewHeader;
