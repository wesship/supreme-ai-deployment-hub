
import { toast } from 'sonner';

interface SpeechHandlerOptions {
  onStart?: () => void;
  onEnd?: () => void;
  onResult?: (text: string) => void;
  onInterim?: (text: string) => void;
  onError?: (error: string) => void;
}

export class SpeechHandler {
  private recognition: SpeechRecognition | null = null;
  private speechSynthesis: SpeechSynthesis;
  private speaking = false;
  private options: SpeechHandlerOptions;

  constructor(options: SpeechHandlerOptions = {}) {
    this.options = options;
    this.speechSynthesis = window.speechSynthesis;
    
    // Initialize speech recognition if available
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      // @ts-ignore - TypeScript doesn't know about webkitSpeechRecognition
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognitionAPI();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      
      this.setupListeners();
    }
  }

  private setupListeners() {
    if (!this.recognition) return;
    
    this.recognition.onstart = () => {
      if (this.options.onStart) this.options.onStart();
    };

    this.recognition.onend = () => {
      if (this.options.onEnd) this.options.onEnd();
    };

    let finalTranscript = '';
    
    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      if (interimTranscript && this.options.onInterim) {
        this.options.onInterim(interimTranscript);
      }
      
      if (finalTranscript && this.options.onResult) {
        this.options.onResult(finalTranscript);
      }
    };

    this.recognition.onerror = (event) => {
      if (this.options.onError) this.options.onError(event.error);
    };
  }

  public startListening() {
    if (!this.recognition) {
      toast.error('Speech recognition is not supported in this browser');
      return;
    }
    
    try {
      this.recognition.start();
    } catch (error) {
      console.error('Speech recognition error:', error);
      
      // Try to restart if already started
      try {
        this.recognition.stop();
        setTimeout(() => {
          this.recognition?.start();
        }, 100);
      } catch (e) {
        console.error('Could not restart speech recognition:', e);
        if (this.options.onError) this.options.onError('Failed to start speech recognition');
      }
    }
  }

  public stopListening() {
    if (!this.recognition) return;
    
    try {
      this.recognition.stop();
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
    }
  }

  public speak(text: string, options: { rate?: number; pitch?: number } = {}) {
    if (!this.speechSynthesis) {
      toast.error('Speech synthesis is not supported in this browser');
      return;
    }
    
    // Cancel any ongoing speech
    this.stopSpeaking();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate || 1;
    utterance.pitch = options.pitch || 1;
    
    this.speaking = true;
    this.speechSynthesis.speak(utterance);
    
    utterance.onend = () => {
      this.speaking = false;
    };
  }

  public stopSpeaking() {
    if (!this.speechSynthesis) return;
    
    this.speechSynthesis.cancel();
    this.speaking = false;
  }

  public isSpeaking() {
    return this.speaking;
  }
}
