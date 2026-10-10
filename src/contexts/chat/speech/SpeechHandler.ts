
import { SpeechOptions, SpeechSynthesisOptions } from './types';
import { RecognitionManager } from './recognitionManager';
import { SynthesisManager } from './synthesisManager';

export class SpeechHandler {
  private recognitionManager: RecognitionManager;
  private synthesisManager: SynthesisManager;
  private isListening: boolean = false;

  constructor(options: SpeechOptions = {}) {
    this.recognitionManager = new RecognitionManager({
      ...options,
      onStart: () => {
        this.isListening = true;
        options.onStart?.();
      },
      onEnd: () => {
        this.isListening = false;
        options.onEnd?.();
      }
    });
    this.synthesisManager = new SynthesisManager();
  }

  public startListening(autoRestart = false) {
    this.recognitionManager.start(autoRestart);
  }

  public stopListening() {
    this.recognitionManager.stop();
  }

  public speak(text: string, options: SpeechSynthesisOptions = {}) {
    this.synthesisManager.speak(text, options);
  }

  public stopSpeaking() {
    this.synthesisManager.stop();
  }

  public isVoiceSupported(): boolean {
    return ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);
  }

  public isSpeechSupported(): boolean {
    return 'speechSynthesis' in window;
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.synthesisManager.getAvailableVoices();
  }

  public getListeningState(): boolean {
    return this.isListening;
  }
}
