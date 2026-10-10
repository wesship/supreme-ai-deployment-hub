
import { useCallback } from 'react';
import { useAGUI } from '@/contexts/agui/AGUIContext';

export function useAgentSession() {
  const { session, isProcessing, startSession, endSession } = useAGUI();
  
  const startAgent = useCallback(async (prompt: string) => {
    if (isProcessing) {
      return false;
    }
    await startSession(prompt);
    return true;
  }, [isProcessing, startSession]);
  
  const stopAgent = useCallback(() => {
    endSession();
  }, [endSession]);
  
  return {
    session,
    isProcessing,
    startAgent,
    stopAgent
  };
}
