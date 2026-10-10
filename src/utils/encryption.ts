
/**
 * Enhanced encryption/decryption utility for client-side storage
 * Note: This is not meant for highly sensitive data, but provides
 * better obfuscation for API keys stored in localStorage
 */

// Use a combination of application-specific string and browser fingerprint
const getEncryptionKey = (): string => {
  const appPrefix = 'D3VONN_IO_SECURE_STORAGE';
  
  // Add some browser-specific information to make the key harder to guess
  const browserInfo = [
    navigator.userAgent,
    navigator.language,
    window.screen.colorDepth
  ].join('|');
  
  // Create a simple hash of the browser info
  let browserHash = 0;
  for (let i = 0; i < browserInfo.length; i++) {
    browserHash = ((browserHash << 5) - browserHash) + browserInfo.charCodeAt(i);
    browserHash |= 0; // Convert to 32bit integer
  }
  
  return `${appPrefix}_${browserHash}`;
};

export const encrypt = (text: string): string => {
  if (!text) return '';
  
  const ENCRYPTION_KEY = getEncryptionKey();
  
  // More complex XOR encryption with salt
  let result = '';
  const salt = Date.now().toString().slice(-6);
  const saltedText = salt + text;
  
  for (let i = 0; i < saltedText.length; i++) {
    const charCode = saltedText.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
    result += String.fromCharCode(charCode);
  }
  
  // Convert to base64 for storage
  return btoa(result);
};

export const decrypt = (encryptedText: string): string => {
  if (!encryptedText) return '';
  
  try {
    const ENCRYPTION_KEY = getEncryptionKey();
    
    // Decode from base64
    const decodedText = atob(encryptedText);
    
    // Reverse the XOR operation
    let result = '';
    for (let i = 0; i < decodedText.length; i++) {
      const charCode = decodedText.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
      result += String.fromCharCode(charCode);
    }
    
    // Remove the salt (first 6 characters)
    return result.substring(6);
  } catch (error) {
    console.error('Decryption error:', error);
    return '';
  }
};

// Add a function to check if a key needs rotation (re-encryption)
export const shouldRotateKey = (encryptionTimestamp: number): boolean => {
  if (!encryptionTimestamp) return true;
  
  // Rotate keys every 30 days
  const ROTATION_PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  const now = Date.now();
  
  return (now - encryptionTimestamp) > ROTATION_PERIOD_MS;
};
