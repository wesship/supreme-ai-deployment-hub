
import { isValidUrl, isValidEmail, isValidApiKey, isEmptyString } from '../settingsValidation';

describe('settingsValidation', () => {
  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(isValidUrl('https://api.d3vonn.io')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('https://sub.domain.com/path?query=value')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('http://')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('name.last@sub.domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('user@.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('user@example')).toBe(false);
    });
  });

  describe('isValidApiKey', () => {
    it('should validate correct API keys', () => {
      expect(isValidApiKey('abcd1234')).toBe(true);
      expect(isValidApiKey('api-key-12345')).toBe(true);
      expect(isValidApiKey('API_KEY_12345')).toBe(true);
      expect(isValidApiKey('abcdefghijklmnopqrstuvwxyz')).toBe(true);
    });

    it('should reject invalid API keys', () => {
      expect(isValidApiKey('short')).toBe(false); // too short
      expect(isValidApiKey('api key')).toBe(false); // contains space
      expect(isValidApiKey('api!key')).toBe(false); // contains special char
      expect(isValidApiKey('')).toBe(false);
    });
  });

  describe('isEmptyString', () => {
    it('should identify empty strings', () => {
      expect(isEmptyString('')).toBe(true);
      expect(isEmptyString(' ')).toBe(true);
      expect(isEmptyString('\t\n')).toBe(true);
    });

    it('should identify non-empty strings', () => {
      expect(isEmptyString('text')).toBe(false);
      expect(isEmptyString(' text ')).toBe(false);
    });
  });
});
