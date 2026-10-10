
import React from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SavedAPIResponse } from '@/types/api';
import EmptyState from './saved-responses/EmptyState';
import ResponsesList from './saved-responses/ResponsesList';

interface SavedResponsesTabProps {
  savedResponses: SavedAPIResponse[];
  onDeleteResponse: (id: string) => void;
  onCopyToClipboard: (text: string) => void;
}

const SavedResponsesTab: React.FC<SavedResponsesTabProps> = ({ 
  savedResponses, 
  onDeleteResponse,
  onCopyToClipboard
}) => {
  const isEmpty = savedResponses.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved Responses</CardTitle>
        <CardDescription>View and manage your saved API responses</CardDescription>
      </CardHeader>
      
      {isEmpty ? (
        <EmptyState />
      ) : (
        <ResponsesList 
          responses={savedResponses} 
          onDelete={onDeleteResponse}
          onCopy={onCopyToClipboard}
        />
      )}
    </Card>
  );
};

export default SavedResponsesTab;
