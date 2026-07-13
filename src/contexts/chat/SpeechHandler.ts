
interface SpeechOptions {
  onStart?: () => void;
  onEnd?: () => void;
  onResult?: (text: string) => void;
  onError?: (error: string) => void;
  onInterim?: (text: string) => void;
}

export class SpeechHandler {
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesisUtterance | null = null;
  private isListening: boolean = false;
  public options: SpeechOptions = {};
  private voices: SpeechSynthesisVoice[] = [];
  private autoRestart: boolean = false;
  private recognitionTimeout: NodeJS.Timeout | null = null;
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private retryTimeout: number = 2000; // 2 seconds

  constructor(options: SpeechOptions = {}) {
    this.options = options;
    this.initSpeechRecognition();
    this.loadVoices();
  }

  private loadVoices() {
    if ('speechSynthesis' in window) {
      // Load available voices
      this.voices = window.speechSynthesis.getVoices();
      
      // If voices array is empty, wait for the voiceschanged event
      if (this.voices.length === 0) {
        window.speechSynthesis.addEventListener('voiceschanged', () => {
          this.voices = window.speechSynthesis.getVoices();
        });
      }
    }
  }

  private initSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      // Unsupported feature detection is expected on browsers such as Firefox.
      return;
    }

    try {
      // Initialize speech recognition with compatibility for different browsers
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognitionAPI();
      
      if (this.recognition) {
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
          this.isListening = true;
          this.retryCount = 0; // Reset retry count on successful start
          if (this.options.onStart) this.options.onStart();
          
          // Set a timeout to restart recognition if it stops unexpectedly
          if (this.recognitionTimeout) {
            clearTimeout(this.recognitionTimeout);
          }
          
          this.recognitionTimeout = setTimeout(() => {
            if (this.isListening && this.autoRestart) {
              console.log("Recognition restarted due to timeout");
              this.restartListening();
            }
          }, 10000); // 10 seconds timeout
        };

        this.recognition.onend = () => {
          if (this.recognitionTimeout) {
            clearTimeout(this.recognitionTimeout);
            this.recognitionTimeout = null;
          }
          
          this.isListening = false;
          if (this.options.onEnd) this.options.onEnd();
          
          // Auto restart if enabled
          if (this.autoRestart) {
            setTimeout(() => {
              this.startListening();
            }, 500);
          }
        };

        this.recognition.onresult = (event) => {
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
        };

        this.recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          
          // Handle specific error types
          if (event.error === 'network' && this.retryCount < this.maxRetries) {
            this.retryCount++;
            console.log(`Network error, retrying (${this.retryCount}/${this.maxRetries})...`);
            
            setTimeout(() => {
              this.restartListening();
            }, this.retryTimeout);
          } else if (event.error === 'no-speech' && this.isListening) {
            // Continue listening if no speech detected
            console.log("No speech detected, continuing to listen...");
          } else if (event.error === 'aborted') {
            console.log("Recognition aborted");
          } else if (event.error === 'audio-capture') {
            console.error("Audio capture error - microphone may not be working");
          } else if (event.error === 'not-allowed') {
            console.error("Microphone access denied");
          }
          
          // Auto recover from errors
          if (this.isListening && this.autoRestart && this.retryCount < this.maxRetries) {
            setTimeout(() => this.restartListening(), 2000);
          }
          
          if (this.options.onError) this.options.onError(event.error);
        };
      }
    } catch (error) {
      console.error("Error initializing speech recognition:", error);
      if (this.options.onError) this.options.onError("Failed to initialize speech recognition");
    }
  }

  public startListening(autoRestart = false) {
    if (!this.recognition) {
      this.initSpeechRecognition();
    }

    this.autoRestart = autoRestart;

    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        // Try to re-initialize and start again
        setTimeout(() => {
          this.initSpeechRecognition();
          try {
            this.recognition?.start();
          } catch (innerError) {
            console.error('Failed to restart speech recognition:', innerError);
            if (this.options.onError) this.options.onError('Failed to start speech recognition');
          }
        }, 100);
      }
    }
  }

  public stopListening() {
    this.autoRestart = false;
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }
  }

  private restartListening() {
    if (this.recognition) {
      try {
        this.recognition.stop();
        setTimeout(() => {
          try {
            this.recognition?.start();
          } catch (error) {
            console.error('Error starting speech recognition after restart:', error);
          }
        }, 200);
      } catch (error) {
        console.error('Error stopping speech recognition for restart:', error);
      }
    }
  }

  public speak(text: string, voiceOptions: { rate?: number; pitch?: number; voice?: string } = {}) {
    if (!('speechSynthesis' in window)) {
      console.error('Speech synthesis not supported in this browser');
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    this.synthesis = new SpeechSynthesisUtterance(text);
    
    // Set voice options
    this.synthesis.rate = voiceOptions.rate || 1;
    this.synthesis.pitch = voiceOptions.pitch || 1;
    
    // Set voice if specified and available
    if (voiceOptions.voice) {
      const voices = window.speechSynthesis.getVoices();
      const selectedVoice = voices.find(v => v.name === voiceOptions.voice || v.voiceURI === voiceOptions.voice);
      if (selectedVoice) {
        this.synthesis.voice = selectedVoice;
      }
    }

    this.synthesis.onstart = () => {
      if (this.options.onStart) this.options.onStart();
    };

    this.synthesis.onend = () => {
      if (this.options.onEnd) this.options.onEnd();
    };

    this.synthesis.onerror = (event) => {
      if (this.options.onError) this.options.onError(event.error);
    };

    window.speechSynthesis.speak(this.synthesis);
  }

  public stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public isVoiceSupported(): boolean {
    return ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);
  }

  public isSpeechSupported(): boolean {
    return 'speechSynthesis' in window;
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if ('speechSynthesis' in window) {
      return window.speechSynthesis.getVoices();
    }
    return [];
  }

  public getListeningState(): boolean {
    return this.isListening;
  }
}

// Type definitions for Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Define the SpeechRecognition interface
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (this: SpeechRecognition, ev: Event) => any;
  onend: (this: SpeechRecognition, ev: Event) => any;
  onerror: (this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any;
  onresult: (this: SpeechRecognition, ev: SpeechRecognitionEvent) => any;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
