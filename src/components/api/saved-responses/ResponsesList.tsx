
import React from 'react';
import { CardContent } from '@/components/ui/card';
import { SavedAPIResponse } from '@/types/api';
import ResponseItem from './ResponseItem';

interface ResponsesListProps {
  responses: SavedAPIResponse[];
  onCopy: (text: string) => void;
  onDelete: (id: string) => void;
}

const ResponsesList: React.FC<ResponsesListProps> = ({ 
  responses, 
  onCopy, 
  onDelete 
}) => {
  return (
    <CardContent>
      <div className="space-y-6">
        {responses.map((response) => (
          <ResponseItem
            key={response.id}
            response={response}
            onCopy={onCopy}
            onDelete={onDelete}
          />
        ))}
      </div>
    </CardContent>
  );
};

export default ResponsesList;
