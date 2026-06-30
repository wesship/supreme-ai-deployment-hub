
/**
 * Validation functions for settings
 */

/**
 * Validate URL format
 */
export function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate API key format (basic check)
 * Common formats: alphanumeric strings, possibly with hyphens or underscores
 */
export function isValidApiKey(apiKey: string): boolean {
  // Basic validation - API keys are typically at least 8 chars
  // and contain only letters, numbers, hyphens, and underscores
  const apiKeyRegex = /^[A-Za-z0-9_-]{8,}$/;
  return apiKeyRegex.test(apiKey);
}

/**
 * Check if a string is empty or only whitespace
 */
export function isEmptyString(str: string): boolean {
  return str.trim().length === 0;
}
