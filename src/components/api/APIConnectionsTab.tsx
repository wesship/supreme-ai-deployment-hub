
import React, { useState } from 'react';
import { useAPI } from '@/contexts/APIContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import APICardList from '@/components/api/APICardList';
import AddAPIDialog from '@/components/api/AddAPIDialog';
import { NewAPIConfig } from '@/types/api';

const APIConnectionsTab: React.FC = () => {
  const { apiConfigs, addAPIConfig, removeAPIConfig, testConnection } = useAPI();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [newConfig, setNewConfig] = useState<NewAPIConfig>({
    name: '',
    endpoint: '',
    apiKey: '',
    description: ''
  });

  const handleAddAPI = () => {
    addAPIConfig(newConfig);
    setNewConfig({
      name: '',
      endpoint: '',
      apiKey: '',
      description: ''
    });
    setIsAddDialogOpen(false);
  };

  const handleTestConnection = async (name: string) => {
    setTestingConnection(name);
    await testConnection(name);
    setTestingConnection(null);
  };

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-xl">API Connections</CardTitle>
          <CardDescription>Manage your external API connections</CardDescription>
        </div>
        <AddAPIDialog
          isOpen={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          newConfig={newConfig}
          onConfigChange={setNewConfig}
          onAddAPI={handleAddAPI}
        />
      </CardHeader>
      <CardContent>
        <APICardList
          apiConfigs={apiConfigs}
          testingConnection={testingConnection}
          onRemove={removeAPIConfig}
          onTest={handleTestConnection}
        />
      </CardContent>
    </Card>
  );
};

export default APIConnectionsTab;
