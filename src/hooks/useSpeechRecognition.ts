
import { useState, useEffect, useCallback } from 'react';
import SpeechRecognitionService from '@/services/speech/speechRecognitionService';
import { SpeechOptions } from '@/contexts/chat/speech/types';

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  isSupported: boolean;
  error: string | null;
}

export const useSpeechRecognition = (options?: SpeechOptions): UseSpeechRecognitionReturn => {
  const [service, setService] = useState<SpeechRecognitionService | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const speechService = new SpeechRecognitionService({
        onStart: () => {
          setIsListening(true);
          setError(null);
          if (options?.onStart) options.onStart();
        },
        onEnd: () => {
          setIsListening(false);
          setInterimTranscript('');
          if (options?.onEnd) options.onEnd();
        },
        onResult: (text) => {
          setTranscript(prev => `${prev} ${text}`.trim());
          setInterimTranscript('');
          if (options?.onResult) options.onResult(text);
        },
        onInterim: (text) => {
          setInterimTranscript(text);
          if (options?.onInterim) options.onInterim(text);
        },
        onError: (errorMsg) => {
          setError(errorMsg);
          setIsListening(false);
          if (options?.onError) options.onError(errorMsg);
        }
      });

      setService(speechService);
      setIsSupported(speechService.isSupported());
    }
    
    return () => {
      if (service) {
        service.stop();
      }
    };
  }, []);

  // Update options when they change
  useEffect(() => {
    if (service && options) {
      service.updateOptions(options);
    }
  }, [options, service]);

  const startListening = useCallback(() => {
    if (!service) return;
    setTranscript('');
    setInterimTranscript('');
    setError(null);
    service.start();
  }, [service]);

  const stopListening = useCallback(() => {
    if (!service) return;
    service.stop();
  }, [service]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
    error
  };
};

export default useSpeechRecognition;
