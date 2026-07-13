
import { SpeechOptions, SpeechRecognitionInstance } from '@/contexts/chat/speech/types';

export class SpeechRecognitionService {
  private recognition: SpeechRecognitionInstance | null = null;
  private isListening = false;
  private options: SpeechOptions = {};

  constructor(options?: SpeechOptions) {
    if (options) {
      this.options = options;
    }
    this.initRecognition();
  }

  private initRecognition(): void {
    if (typeof window === 'undefined') return;

    try {
      // Check if browser supports SpeechRecognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        // Unsupported feature detection is expected on browsers such as Firefox.
        return;
      }

      const rec = new SpeechRecognition();
      this.recognition = rec;
      
      // Configure recognition
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      // Set up event handlers
      rec.onstart = this.handleStart.bind(this);
      rec.onend = this.handleEnd.bind(this);
      rec.onerror = this.handleError.bind(this);
      rec.onresult = this.handleResult.bind(this);
      
    } catch (error) {
      console.error('Failed to initialize speech recognition:', error);
    }
  }

  public start(): void {
    if (!this.recognition || this.isListening) return;

    try {
      this.recognition.start();
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      if (this.options.onError) {
        this.options.onError('Failed to start speech recognition');
      }
    }
  }

  public stop(): void {
    if (!this.recognition || !this.isListening) return;

    try {
      this.recognition.stop();
    } catch (error) {
      console.error('Failed to stop speech recognition:', error);
    }
  }

  public updateOptions(options: Partial<SpeechOptions>): void {
    this.options = { ...this.options, ...options };
  }

  private handleStart(event: Event): void {
    this.isListening = true;
    if (this.options.onStart) {
      this.options.onStart();
    }
  }

  private handleEnd(event: Event): void {
    this.isListening = false;
    if (this.options.onEnd) {
      this.options.onEnd();
    }
  }

  private handleError(event: Event): void {
    const errorEvent = event as unknown as { error: string };
    console.error('Speech recognition error:', errorEvent.error);
    
    if (this.options.onError) {
      this.options.onError(errorEvent.error || 'Unknown speech recognition error');
    }
    
    this.isListening = false;
  }

  private handleResult(event: Event): void {
    const resultEvent = event as unknown as { results: any, resultIndex: number };
    
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = resultEvent.resultIndex; i < resultEvent.results.length; i++) {
      const transcript = resultEvent.results[i][0].transcript;
      
      if (resultEvent.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    if (finalTranscript && this.options.onResult) {
      this.options.onResult(finalTranscript);
    }

    if (interimTranscript && this.options.onInterim) {
      this.options.onInterim(interimTranscript);
    }
  }

  public isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
}

export default SpeechRecognitionService;
