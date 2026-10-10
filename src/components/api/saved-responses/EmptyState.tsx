
import React from 'react';
import { CardContent } from '@/components/ui/card';

const EmptyState: React.FC = () => {
  return (
    <CardContent>
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-muted-foreground mb-2">No saved responses yet</p>
        <p className="text-sm text-muted-foreground">
          Use the API Playground to test endpoints and save responses for future reference
        </p>
      </div>
    </CardContent>
  );
};

export default EmptyState;
