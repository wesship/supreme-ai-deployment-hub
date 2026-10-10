
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAPI } from '@/contexts/APIContext';

interface APISelectorProps {
  selectedAPI: string;
  onSelectAPI: (apiName: string, endpoint: string, apiKey?: string) => void;
}

const APISelector: React.FC<APISelectorProps> = ({ selectedAPI, onSelectAPI }) => {
  const { apiConfigs } = useAPI();

  const handleSelectAPI = (apiName: string) => {
    const config = apiConfigs.find(c => c.name === apiName);
    if (config) {
      onSelectAPI(config.name, config.endpoint, config.apiKey);
    }
  };

  return (
    <div>
      <label className="text-sm font-medium mb-2 block">API Connection</label>
      <Select value={selectedAPI} onValueChange={handleSelectAPI}>
        <SelectTrigger>
          <SelectValue placeholder="Select API connection" />
        </SelectTrigger>
        <SelectContent>
          {apiConfigs.length === 0 ? (
            <SelectItem value="none" disabled>No API connections configured</SelectItem>
          ) : (
            apiConfigs.map(config => (
              <SelectItem key={config.name} value={config.name}>
                {config.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
};

export default APISelector;
