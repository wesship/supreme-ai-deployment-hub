
import React, { useState } from 'react';
import { useAPI } from '@/contexts/APIContext';
import { Separator } from '@/components/ui/separator';
import AddAPIDialog from './api/AddAPIDialog';
import APICardList from './api/APICardList';
import { NewAPIConfig } from '@/types/api';

const APIConnectionForm: React.FC = () => {
  const { apiConfigs, addAPIConfig, removeAPIConfig, testConnection } = useAPI();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newConfig, setNewConfig] = useState<NewAPIConfig>({
    name: '',
    endpoint: '',
    apiKey: '',
    description: ''
  });
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  const handleAddAPI = () => {
    if (!newConfig.name || !newConfig.endpoint) return;
    
    addAPIConfig({
      name: newConfig.name,
      endpoint: newConfig.endpoint,
      apiKey: newConfig.apiKey || undefined,
      description: newConfig.description || 'No description provided.'
    });
    
    // Reset form
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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">API Connections</h3>
        <AddAPIDialog
          isOpen={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          newConfig={newConfig}
          onConfigChange={setNewConfig}
          onAddAPI={handleAddAPI}
        />
      </div>
      
      <Separator />
      
      <APICardList
        apiConfigs={apiConfigs}
        testingConnection={testingConnection}
        onRemove={removeAPIConfig}
        onTest={handleTestConnection}
      />
    </div>
  );
};

export default APIConnectionForm;
