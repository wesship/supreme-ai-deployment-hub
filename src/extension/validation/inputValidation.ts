
/**
 * Utilities for validating and processing user input
 */

/**
 * Validates the length of an input string
 */
export function validateInputLength(
  input: string, 
  maxLength: number,
  minLength: number = 0
): boolean {
  const trimmedInput = input.trim();
  return trimmedInput.length >= minLength && trimmedInput.length <= maxLength;
}

/**
 * Process input string to make it safe for use
 */
export function processInput(input: string): string {
  // Remove null bytes
  let processed = input.replace(/\0/g, '');
  
  // Trim whitespace
  processed = processed.trim();
  
  // Normalize unicode
  processed = processed.normalize();
  
  return processed;
}

/**
 * Validate numeric input
 */
export function validateNumeric(input: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(input);
}

/**
 * Validate integer input
 */
export function validateInteger(input: string): boolean {
  return /^-?\d+$/.test(input);
}

/**
 * Validate positive number
 */
export function validatePositiveNumber(input: string): boolean {
  const num = Number(input);
  return !isNaN(num) && num > 0;
}

/**
 * Validate form input object with specified rules
 */
export function validateForm<T extends Record<string, any>>(
  formData: T,
  rules: {
    [K in keyof T]?: {
      required?: boolean;
      minLength?: number;
      maxLength?: number;
      pattern?: RegExp;
      validate?: (value: T[K]) => boolean;
    };
  }
): { valid: boolean; errors: Partial<Record<keyof T, string>> } {
  const errors: Partial<Record<keyof T, string>> = {};
  
  for (const field in rules) {
    const value = formData[field];
    const rule = rules[field];
    
    if (!rule) continue;
    
    // Check required fields
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors[field] = `${String(field)} is required`;
      continue;
    }
    
    // Skip further validation if field is empty and not required
    if (value === undefined || value === null || value === '') {
      continue;
    }
    
    // Check string length for string values
    if (typeof value === 'string') {
      if (rule.minLength !== undefined && value.length < rule.minLength) {
        errors[field] = `${String(field)} must be at least ${rule.minLength} characters`;
      } else if (rule.maxLength !== undefined && value.length > rule.maxLength) {
        errors[field] = `${String(field)} cannot exceed ${rule.maxLength} characters`;
      }
      
      // Check regex pattern
      if (rule.pattern && !rule.pattern.test(value)) {
        errors[field] = `${String(field)} has an invalid format`;
      }
    }
    
    // Run custom validation function
    if (rule.validate && !rule.validate(value)) {
      errors[field] = `${String(field)} is invalid`;
    }
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}
