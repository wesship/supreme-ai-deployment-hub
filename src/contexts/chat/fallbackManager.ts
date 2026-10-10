
import { FallbackStrategy } from './types';

// Default fallback strategy
export const DEFAULT_FALLBACK_STRATEGY: FallbackStrategy = {
  threshold: 2, // After 2 consecutive low-confidence intents, use fallback
  responses: [
    "I'm not sure I understand. Could you rephrase that?",
    "I'm having trouble understanding your request. Could you try explaining it differently?",
    "I don't quite follow. Would you mind clarifying what you're looking for?",
    "Let me try to help better. What specific information or assistance do you need?",
    "I apologize, but I'm not understanding correctly. Could you be more specific?"
  ]
};

export const getFallbackResponse = (failedCount: number, strategy: FallbackStrategy = DEFAULT_FALLBACK_STRATEGY): string => {
  // Check if we need to use fallback
  if (failedCount < strategy.threshold) {
    return ''; // Not enough failures to trigger fallback
  }
  
  // Cycle through fallback responses
  const index = (failedCount - strategy.threshold) % strategy.responses.length;
  return strategy.responses[index];
};

// Analyze if an intent has low confidence
export const isLowConfidenceIntent = (intentType: string, confidence: number): boolean => {
  // Higher threshold for default intent since it's a catch-all
  const threshold = intentType === 'technical' ? 0.7 : 0.4;
  return confidence < threshold;
};
