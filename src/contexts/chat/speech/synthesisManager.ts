
import { toast } from 'sonner';
import { SpeechSynthesisOptions } from './types';

export class SynthesisManager {
  private synthesis: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    this.loadVoices();
  }

  private loadVoices() {
    if ('speechSynthesis' in window) {
      this.voices = window.speechSynthesis.getVoices();
      
      if (this.voices.length === 0) {
        window.speechSynthesis.addEventListener('voiceschanged', () => {
          this.voices = window.speechSynthesis.getVoices();
        });
      }
    }
  }

  public speak(text: string, options: SpeechSynthesisOptions = {}) {
    if (!('speechSynthesis' in window)) {
      toast.error('Speech synthesis not supported in this browser');
      return;
    }

    window.speechSynthesis.cancel();
    
    this.synthesis = new SpeechSynthesisUtterance(text);
    this.synthesis.rate = options.rate || 1;
    this.synthesis.pitch = options.pitch || 1;
    
    if (options.voice) {
      const selectedVoice = this.voices.find(v => 
        v.name === options.voice || v.voiceURI === options.voice
      );
      if (selectedVoice) {
        this.synthesis.voice = selectedVoice;
      }
    }

    window.speechSynthesis.speak(this.synthesis);
  }

  public stop() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }
}
