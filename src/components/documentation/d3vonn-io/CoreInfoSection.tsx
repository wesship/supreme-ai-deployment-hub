
import React from 'react';
import { Layers, Cpu } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import CapabilitiesSection from './CapabilitiesSection';
import ProjectComponentsSection from './ProjectComponentsSection';

const CoreInfoSection: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <Card className="border-2 border-border overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="p-2 rounded-full bg-primary/10">
            <Layers className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>Core Capabilities</CardTitle>
            <CardDescription>Everything you need to build and deploy AI agents</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <CapabilitiesSection />
        </CardContent>
      </Card>
      
      <Card className="border-2 border-border overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="p-2 rounded-full bg-primary/10">
            <Cpu className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>Project Components</CardTitle>
            <CardDescription>Modular architecture for scalability</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ProjectComponentsSection />
        </CardContent>
      </Card>
    </div>
  );
};

export default CoreInfoSection;
