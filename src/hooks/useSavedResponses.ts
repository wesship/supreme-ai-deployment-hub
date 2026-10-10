
import { useState } from 'react';
import { SavedAPIResponse } from '@/types/api';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

export const useSavedResponses = () => {
  const [savedResponses, setSavedResponses] = useState<SavedAPIResponse[]>([]);

  const saveResponse = (
    apiName: string,
    method: string,
    endpoint: string,
    status: string,
    response: string
  ) => {
    const newSavedResponse: SavedAPIResponse = {
      id: uuidv4(),
      timestamp: new Date(),
      apiName,
      method,
      endpoint,
      status,
      response
    };
    
    setSavedResponses(prev => [newSavedResponse, ...prev]);
    toast.success('Response saved successfully');
  };

  const deleteResponse = (id: string) => {
    setSavedResponses(prev => prev.filter(response => response.id !== id));
    toast.success('Response deleted');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return {
    savedResponses,
    saveResponse,
    deleteResponse,
    copyToClipboard
  };
};
