
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import DevonnAIOverviewTab from './DevonnAIOverviewTab';
import GettingStartedTab from './GettingStartedTab';
import GuidesTab from './GuidesTab';
import ProjectStructureTab from './ProjectStructureTab';
import APIReferenceTab from './APIReferenceTab';
import ExamplesTab from './ExamplesTab';
import DomainConfigTab from './DomainConfigTab';
import DeploymentGuideTab from './DeploymentGuideTab';
import VoiceBestPracticesTab from './VoiceBestPracticesTab';

const DocumentationTabs: React.FC = () => {
  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-9 gap-2">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="getting-started">Getting Started</TabsTrigger>
        <TabsTrigger value="guides">Guides</TabsTrigger>
        <TabsTrigger value="voice">Voice Best Practices</TabsTrigger>
        <TabsTrigger value="structure">Project Structure</TabsTrigger>
        <TabsTrigger value="api-reference">API Reference</TabsTrigger>
        <TabsTrigger value="deployment">Deployment</TabsTrigger>
        <TabsTrigger value="examples">Examples</TabsTrigger>
        <TabsTrigger value="domain">Domain Config</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <DevonnAIOverviewTab />
      </TabsContent>

      <TabsContent value="getting-started">
        <GettingStartedTab />
      </TabsContent>

      <TabsContent value="guides">
        <GuidesTab />
      </TabsContent>

      <TabsContent value="voice">
        <VoiceBestPracticesTab />
      </TabsContent>

      <TabsContent value="structure">
        <ProjectStructureTab />
      </TabsContent>

      <TabsContent value="api-reference">
        <APIReferenceTab />
      </TabsContent>

      <TabsContent value="deployment">
        <DeploymentGuideTab />
      </TabsContent>

      <TabsContent value="examples">
        <ExamplesTab />
      </TabsContent>

      <TabsContent value="domain">
        <DomainConfigTab />
      </TabsContent>
    </Tabs>
  );
};

export default DocumentationTabs;
