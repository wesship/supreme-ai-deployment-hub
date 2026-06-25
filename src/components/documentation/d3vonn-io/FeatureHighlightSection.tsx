
import React from 'react';
import { 
  Brain, 
  Cpu, 
  Server, 
  Shield
} from 'lucide-react';

const FeatureHighlightSection: React.FC = () => {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border p-1 my-8">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 animate-pulse [animation-duration:5s]" />
      <div className="relative grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
        <div className="p-6 flex flex-col gap-2 items-center justify-center text-center">
          <div className="bg-primary/10 p-3 rounded-full">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold">AI-Powered</h3>
          <p className="text-muted-foreground text-sm">LangChain agents with multi-agent orchestration</p>
        </div>
        <div className="p-6 flex flex-col gap-2 items-center justify-center text-center">
          <div className="bg-primary/10 p-3 rounded-full">
            <Server className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold">Full-Stack</h3>
          <p className="text-muted-foreground text-sm">FastAPI, PostgreSQL, React, Zustand</p>
        </div>
        <div className="p-6 flex flex-col gap-2 items-center justify-center text-center">
          <div className="bg-primary/10 p-3 rounded-full">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold">Production-Ready</h3>
          <p className="text-muted-foreground text-sm">Docker, CI/CD, HTTPS, JWT Auth</p>
        </div>
      </div>
    </div>
  );
};

export default FeatureHighlightSection;
