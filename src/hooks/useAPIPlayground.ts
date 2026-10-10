
import { UseAPIPlaygroundProps } from './api-playground/types';
import { useAPIPlaygroundState } from './api-playground/useAPIPlaygroundState';
import { useRequestHandler } from './api-playground/useRequestHandler';
import { useResponseHandler } from './api-playground/useResponseHandler';

export type { APIPlaygroundState } from './api-playground/types';

export const useAPIPlayground = (props: UseAPIPlaygroundProps = {}) => {
  const { state, updateState, setMethod, setEndpoint, setRequestBody, setHeaders, handleSelectAPI } = useAPIPlaygroundState();
  
  const { sendRequest } = useRequestHandler({ state, updateState });
  
  const { handleSaveResponse } = useResponseHandler({ 
    state, 
    onSaveResponse: props.onSaveResponse 
  });

  return {
    state,
    handleSelectAPI,
    setMethod,
    setEndpoint,
    setRequestBody,
    setHeaders,
    sendRequest,
    handleSaveResponse
  };
};
