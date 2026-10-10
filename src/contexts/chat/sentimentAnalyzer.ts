
import { ENTITY_TYPES } from './constants';

// Sentiment words lists
const POSITIVE_WORDS = [
  'good', 'great', 'excellent', 'amazing', 'awesome', 'fantastic', 'wonderful', 'brilliant',
  'helpful', 'thank', 'thanks', 'appreciate', 'love', 'like', 'happy', 'glad', 'pleased',
  'satisfied', 'yes', 'correct', 'right', 'perfect', 'beautiful', 'nice', 'cool'
];

const NEGATIVE_WORDS = [
  'bad', 'terrible', 'awful', 'horrible', 'poor', 'disappointing', 'frustrating', 'annoying',
  'unhelpful', 'wrong', 'not working', 'broken', 'issue', 'problem', 'error', 'bug', 'fail',
  'hate', 'dislike', 'angry', 'upset', 'mad', 'confused', 'no', 'not', 'cannot', 'can\'t'
];

// Emoji sentiment mapping
const EMOJI_SENTIMENT = {
  positive: ['😊', '😄', '👍', '🙂', '😁', '🎉', '❤️', '👏', '✅', '💯'],
  negative: ['😞', '😟', '👎', '😠', '😡', '😕', '❌', '💔', '😢', '😭']
};

export const analyzeSentiment = (message: string): 'positive' | 'negative' | 'neutral' => {
  const lowerMessage = message.toLowerCase();
  
  // Check for explicit sentiment indicators
  const positiveScore = POSITIVE_WORDS.reduce((score, word) => {
    // Count occurrences of each positive word
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = lowerMessage.match(regex);
    return score + (matches ? matches.length : 0);
  }, 0);
  
  const negativeScore = NEGATIVE_WORDS.reduce((score, word) => {
    // Count occurrences of each negative word
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = lowerMessage.match(regex);
    return score + (matches ? matches.length : 0);
  }, 0);
  
  // Check for emojis
  const positiveEmojiCount = EMOJI_SENTIMENT.positive.reduce((count, emoji) => {
    return count + (message.includes(emoji) ? 1 : 0);
  }, 0);
  
  const negativeEmojiCount = EMOJI_SENTIMENT.negative.reduce((count, emoji) => {
    return count + (message.includes(emoji) ? 1 : 0);
  }, 0);
  
  // Calculate final scores with emoji bonus
  const finalPositiveScore = positiveScore + positiveEmojiCount * 1.5;
  const finalNegativeScore = negativeScore + negativeEmojiCount * 1.5;
  
  // Negative words have a stronger impact in questions
  const isQuestion = message.includes('?');
  const negativeMultiplier = isQuestion ? 0.7 : 1.0;
  
  // Determine sentiment based on scores
  if (finalPositiveScore > finalNegativeScore * negativeMultiplier) {
    return 'positive';
  } else if (finalNegativeScore > finalPositiveScore) {
    return 'negative';
  } else {
    return 'neutral';
  }
};

// Get an appropriate response modifier based on detected sentiment
export const getSentimentResponseModifier = (sentiment: 'positive' | 'negative' | 'neutral'): string => {
  switch (sentiment) {
    case 'positive':
      return "I'm glad to hear that! ";
    case 'negative':
      return "I understand your concern. ";
    default:
      return "";
  }
};
