
import { toast } from 'sonner';
import { APIPlaygroundState, UseAPIPlaygroundProps } from './types';

interface UseResponseHandlerProps extends UseAPIPlaygroundProps {
  state: APIPlaygroundState;
}

export const useResponseHandler = ({ state, onSaveResponse }: UseResponseHandlerProps) => {
  const handleSaveResponse = () => {
    if (!state.response || !state.status || !state.selectedAPI) {
      toast.error('No response to save');
      return;
    }
    
    if (onSaveResponse) {
      onSaveResponse(
        state.selectedAPI, 
        state.method, 
        state.endpoint, 
        state.status, 
        state.response
      );
      toast.success('Response saved successfully');
    }
  };

  return {
    handleSaveResponse
  };
};
