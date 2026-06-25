
import React from 'react';
import { Separator } from '@/components/ui/separator';
import APICard from './APICard';
import { APIConfig } from '@/types/api';

interface APICardListProps {
  apiConfigs: APIConfig[];
  testingConnection: string | null;
  onRemove: (name: string) => void;
  onTest: (name: string) => void;
}

const APICardList: React.FC<APICardListProps> = ({ 
  apiConfigs, 
  testingConnection, 
  onRemove, 
  onTest 
}) => {
  if (apiConfigs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No API connections configured yet.</p>
        <p className="text-sm">Add an API connection to integrate external services with D3VONN.IO</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
      {apiConfigs.map((config) => (
        <APICard
          key={config.name}
          config={config}
          testingConnection={testingConnection}
          onRemove={onRemove}
          onTest={onTest}
        />
      ))}
    </div>
  );
};

export default APICardList;
