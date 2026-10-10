
import { useState } from 'react';
import { APIPlaygroundState } from './types';

export const useAPIPlaygroundState = () => {
  const [state, setState] = useState<APIPlaygroundState>({
    selectedAPI: '',
    method: 'GET',
    endpoint: '',
    requestBody: '',
    headers: '{\n  "Content-Type": "application/json"\n}',
    response: '',
    status: '',
    loading: false,
  });

  const updateState = (newState: Partial<APIPlaygroundState>) => {
    setState(prev => ({ ...prev, ...newState }));
  };

  const setMethod = (value: string) => updateState({ method: value });
  
  const setEndpoint = (value: string) => updateState({ endpoint: value });
  
  const setRequestBody = (value: string) => updateState({ requestBody: value });
  
  const setHeaders = (value: string | ((prev: string) => string)) => {
    if (typeof value === 'function') {
      setState(prev => ({
        ...prev,
        headers: value(prev.headers)
      }));
    } else {
      updateState({ headers: value });
    }
  };

  const handleSelectAPI = (apiName: string, apiEndpoint: string, apiKey?: string) => {
    updateState({ 
      selectedAPI: apiName,
      endpoint: apiEndpoint
    });
    
    // If the API has an API key, add it to the headers
    if (apiKey) {
      setHeaders(prev => {
        try {
          const headersObj = JSON.parse(prev);
          return JSON.stringify({
            ...headersObj,
            "Authorization": `Bearer ${apiKey}`
          }, null, 2);
        } catch (e) {
          // If the headers aren't valid JSON, start fresh
          return `{\n  "Content-Type": "application/json",\n  "Authorization": "Bearer ${apiKey}"\n}`;
        }
      });
    }
  };

  return {
    state,
    updateState,
    setMethod,
    setEndpoint,
    setRequestBody,
    setHeaders,
    handleSelectAPI
  };
};
