
import { useState, useEffect, useCallback } from 'react';
import SpeechSynthesisService from '@/services/speech/speechSynthesisService';
import { SpeechSynthesisOptions } from '@/contexts/chat/speech/types';

interface UseSpeechSynthesisReturn {
  speak: (text: string, options?: SpeechSynthesisOptions) => void;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
  voices: SpeechSynthesisVoice[];
  setVoice: (voice: string) => void;
  setRate: (rate: number) => void;
  setPitch: (pitch: number) => void;
}

export const useSpeechSynthesis = (
  options?: SpeechSynthesisOptions
): UseSpeechSynthesisReturn => {
  const [service, setService] = useState<SpeechSynthesisService | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSupported, setIsSupported] = useState(false);
  const [currentOptions, setCurrentOptions] = useState<SpeechSynthesisOptions>(options || {});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const speechService = new SpeechSynthesisService(options);
      setService(speechService);
      setIsSupported(speechService.isSupported());
      
      // Get available voices (may be async in some browsers)
      const loadVoices = () => {
        const availableVoices = speechService.getVoices();
        setVoices(availableVoices);
      };

      if (window.speechSynthesis) {
        // Chrome loads voices asynchronously
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
          window.speechSynthesis.onvoiceschanged = loadVoices;
        }
        
        // Initial load for Firefox and others
        loadVoices();
      }
    }
  }, []);

  // Update service options when they change
  useEffect(() => {
    if (service) {
      service.updateOptions(currentOptions);
    }
  }, [currentOptions, service]);

  const speak = useCallback((text: string, speakOptions?: SpeechSynthesisOptions) => {
    if (!service) return;
    
    setIsSpeaking(true);
    const options = speakOptions ? { ...currentOptions, ...speakOptions } : currentOptions;
    
    service.speak(text, options);
    
    // Set up a listener to update isSpeaking state
    const checkSpeaking = () => {
      if (window.speechSynthesis && !window.speechSynthesis.speaking) {
        setIsSpeaking(false);
        return;
      }
      setTimeout(checkSpeaking, 100);
    };
    
    checkSpeaking();
  }, [service, currentOptions]);

  const cancel = useCallback(() => {
    if (!service) return;
    service.cancel();
    setIsSpeaking(false);
  }, [service]);

  const pause = useCallback(() => {
    if (!service) return;
    service.pause();
  }, [service]);

  const resume = useCallback(() => {
    if (!service) return;
    service.resume();
  }, [service]);

  const setVoice = useCallback((voice: string) => {
    setCurrentOptions(prev => ({ ...prev, voice }));
  }, []);

  const setRate = useCallback((rate: number) => {
    setCurrentOptions(prev => ({ ...prev, rate }));
  }, []);

  const setPitch = useCallback((pitch: number) => {
    setCurrentOptions(prev => ({ ...prev, pitch }));
  }, []);

  return {
    speak,
    cancel,
    pause,
    resume,
    isSpeaking,
    isSupported,
    voices,
    setVoice,
    setRate,
    setPitch
  };
};

export default useSpeechSynthesis;
