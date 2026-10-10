
import { toast } from 'sonner';
import { SpeechOptions, SpeechRecognitionInstance, SpeechRecognitionEventInstance, SpeechRecognitionErrorEventInstance } from './types';

export class RecognitionManager {
  private recognition: SpeechRecognitionInstance | null = null;
  private options: SpeechOptions;
  private autoRestart: boolean = false;
  private recognitionTimeout: NodeJS.Timeout | null = null;
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private retryTimeout: number = 2000;

  constructor(options: SpeechOptions) {
    this.options = options;
    this.initRecognition();
  }

  private initRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('Speech recognition not supported');
      return;
    }

    try {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognitionAPI() as SpeechRecognitionInstance;
      this.setupRecognition();
    } catch (error) {
      console.error("Error initializing speech recognition:", error);
      if (this.options.onError) this.options.onError("Failed to initialize speech recognition");
    }
  }

  private setupRecognition() {
    if (!this.recognition) return;

    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.retryCount = 0;
      if (this.options.onStart) this.options.onStart();
      this.setupTimeout();
    };

    this.recognition.onend = () => {
      this.clearTimeout();
      if (this.options.onEnd) this.options.onEnd();
      
      if (this.autoRestart) {
        setTimeout(() => this.start(), 500);
      }
    };

    this.recognition.onresult = (event: SpeechRecognitionEventInstance) => this.handleRecognitionResult(event);
    this.recognition.onerror = (event: SpeechRecognitionErrorEventInstance) => this.handleRecognitionError(event);
  }

  private handleRecognitionResult(event: SpeechRecognitionEventInstance) {
    let interim = '';
    let final = '';
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        final += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }
    
    if (interim && this.options.onInterim) {
      this.options.onInterim(interim);
    }
    
    if (final && this.options.onResult) {
      this.options.onResult(final);
    }
  }

  private handleRecognitionError(event: SpeechRecognitionErrorEventInstance) {
    console.error('Speech recognition error:', event.error);
    
    if (event.error === 'network' && this.retryCount < this.maxRetries) {
      this.retryCount++;
      setTimeout(() => this.restart(), this.retryTimeout);
    }
    
    if (this.options.onError) this.options.onError(event.error);
  }

  private setupTimeout() {
    if (this.recognitionTimeout) {
      clearTimeout(this.recognitionTimeout);
    }
    
    this.recognitionTimeout = setTimeout(() => {
      if (this.autoRestart) {
        this.restart();
      }
    }, 10000);
  }

  private clearTimeout() {
    if (this.recognitionTimeout) {
      clearTimeout(this.recognitionTimeout);
      this.recognitionTimeout = null;
    }
  }

  public start(autoRestart = false) {
    if (!this.recognition) {
      this.initRecognition();
    }

    this.autoRestart = autoRestart;

    if (this.recognition) {
      try {
        this.recognition.start();
      } catch (error) {
        console.error('Error starting recognition:', error);
        setTimeout(() => this.restart(), 100);
      }
    }
  }

  public stop() {
    this.autoRestart = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    }
  }

  private restart() {
    if (this.recognition) {
      try {
        this.recognition.stop();
        setTimeout(() => {
          try {
            this.recognition?.start();
          } catch (error) {
            console.error('Error starting recognition after restart:', error);
          }
        }, 200);
      } catch (error) {
        console.error('Error stopping recognition for restart:', error);
      }
    }
  }
}
