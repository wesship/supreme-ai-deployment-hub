
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import KubeConfigConnect from './KubeConfigConnect';
import DeploymentCommands from './DeploymentCommands';
import EnvFileSample from './EnvFileSample';
import ProviderSelector from './ProviderSelector';
import { deploymentCommandsData } from './deploymentData';
import { useDeployment } from '@/contexts/DeploymentContext';
import AWSCredentialsForm from '../credentials/AWSCredentialsForm';

const DeploymentControlTabs = () => {
  const { provider } = useDeployment();
  
  // Filter commands by provider
  const filteredCommands = deploymentCommandsData.filter(cmd => 
    !cmd.provider || cmd.provider === provider
  );

  return (
    <Tabs defaultValue="credentials">
      <TabsList className="w-full">
        <TabsTrigger value="credentials" className="w-full">Credentials</TabsTrigger>
        <TabsTrigger value="provider" className="w-full">Provider</TabsTrigger>
        <TabsTrigger value="kubeconfig" className="w-full">Kubeconfig</TabsTrigger>
        <TabsTrigger value="commands" className="w-full">Setup Commands</TabsTrigger>
        <TabsTrigger value="env" className="w-full">Environment</TabsTrigger>
      </TabsList>
      
      <TabsContent value="credentials" className="space-y-4">
        {provider === 'aws' && <AWSCredentialsForm />}
        {provider !== 'aws' && (
          <div className="text-center py-8 text-muted-foreground">
            Credential configuration for {provider.toUpperCase()} coming soon
          </div>
        )}
      </TabsContent>
      
      <TabsContent value="provider" className="space-y-4">
        <ProviderSelector />
      </TabsContent>
      
      <TabsContent value="kubeconfig" className="space-y-4">
        <KubeConfigConnect />
      </TabsContent>
      
      <TabsContent value="commands">
        <DeploymentCommands deploymentCommands={filteredCommands} />
      </TabsContent>
      
      <TabsContent value="env">
        <EnvFileSample />
      </TabsContent>
    </Tabs>
  );
};

export default DeploymentControlTabs;
