
/**
 * Utilities for working with AG-UI
 */

// Process AG-UI tokens to get the complete response text
export const getFullTextFromTokens = (tokens: Array<any>): string => {
  return tokens
    .filter(token => token.type === 'token' && token.content)
    .map(token => token.content)
    .join('');
};

// Extract tool calls from tokens
export const extractToolCalls = (tokens: Array<any>): Array<any> => {
  return tokens.filter(token => token.type === 'tool');
};

// Check if stream has finished
export const isStreamComplete = (tokens: Array<any>): boolean => {
  return tokens.some(token => token.type === 'done');
};

// Format tool input for display
export const formatToolInput = (input: any): string => {
  if (typeof input === 'string') {
    return input;
  }
  
  try {
    return JSON.stringify(input, null, 2);
  } catch (e) {
    return String(input);
  }
};

// Parse potential JSON in string
export const parseToolResult = (resultStr: string): any => {
  if (!resultStr.trim()) {
    return null;
  }
  
  try {
    return JSON.parse(resultStr);
  } catch (e) {
    return resultStr;
  }
};
