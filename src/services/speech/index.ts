
export * from './speechRecognitionService';
export * from './speechSynthesisService';

// Re-export in a more convenient way
import SpeechRecognitionService from './speechRecognitionService';
import SpeechSynthesisService from './speechSynthesisService';

export {
  SpeechRecognitionService,
  SpeechSynthesisService
};

// Function to check if speech features are supported in the current browser
export const isSpeechSupported = (): { recognition: boolean; synthesis: boolean } => {
  const recognitionSupported = 
    typeof window !== 'undefined' && 
    (window.SpeechRecognition || window.webkitSpeechRecognition);
  
  const synthesisSupported = 
    typeof window !== 'undefined' && 
    'speechSynthesis' in window;
  
  return {
    recognition: !!recognitionSupported,
    synthesis: synthesisSupported
  };
};
