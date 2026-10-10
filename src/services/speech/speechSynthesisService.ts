
import { SpeechSynthesisOptions } from '@/contexts/chat/speech/types';

export class SpeechSynthesisService {
  private utterance: SpeechSynthesisUtterance | null = null;
  private options: SpeechSynthesisOptions = {
    rate: 1.0,
    pitch: 1.0
  };
  private isSpeaking = false;

  constructor(options?: SpeechSynthesisOptions) {
    if (options) {
      this.options = { ...this.options, ...options };
    }
  }

  public speak(text: string, options?: SpeechSynthesisOptions): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.error('Speech synthesis not supported in this browser');
      return;
    }

    // Cancel any ongoing speech
    this.cancel();

    const mergedOptions = { ...this.options, ...(options || {}) };
    this.utterance = new SpeechSynthesisUtterance(text);
    
    // Set properties
    this.utterance.rate = mergedOptions.rate || 1.0;
    this.utterance.pitch = mergedOptions.pitch || 1.0;

    // Set voice if specified
    if (mergedOptions.voice) {
      const voices = this.getVoices();
      const selectedVoice = voices.find(voice => voice.name === mergedOptions.voice);
      
      if (selectedVoice) {
        this.utterance.voice = selectedVoice;
      }
    }

    // Set event handlers
    this.utterance.onstart = this.handleStart.bind(this);
    this.utterance.onend = this.handleEnd.bind(this);
    this.utterance.onerror = this.handleError.bind(this);

    // Start speaking
    window.speechSynthesis.speak(this.utterance);
  }

  public pause(): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.pause();
  }

  public resume(): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.resume();
  }

  public cancel(): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    this.isSpeaking = false;
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return [];
    }
    return window.speechSynthesis.getVoices();
  }

  public updateOptions(options: SpeechSynthesisOptions): void {
    this.options = { ...this.options, ...options };
  }

  private handleStart(): void {
    this.isSpeaking = true;
  }

  private handleEnd(): void {
    this.isSpeaking = false;
  }

  private handleError(event: Event | Error): void {
    console.error('Speech synthesis error:', event);
    this.isSpeaking = false;
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }
}

export const speechSynthesisService = new SpeechSynthesisService();

export const speak = (
  text: string,
  options?: SpeechSynthesisOptions
): void => {
  speechSynthesisService.speak(text, options);
};

export default SpeechSynthesisService;
