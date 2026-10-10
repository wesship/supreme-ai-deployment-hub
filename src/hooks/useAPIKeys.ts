
import { useAPI } from '@/contexts/APIContext';
import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, ClipboardCopy } from 'lucide-react';
import { encrypt, decrypt, shouldRotateKey } from '@/utils/encryption';

// Constants for sessionStorage keys (cleared on tab close for security)
const LAST_USED_KEY = 'devonn_api_last_used';
const ENCRYPTION_TIMESTAMP_KEY = 'devonn_api_encryption_timestamp';

/**
 * Custom hook for easily accessing and managing API keys with enhanced security
 */
export const useAPIKeys = () => {
  const { getSecureAPIKey, apiConfigs, updateAPIKey } = useAPI();
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [lastUsed, setLastUsed] = useState<Record<string, Date>>({});
  const [encryptionTimestamp, setEncryptionTimestamp] = useState<number>(0);

  // Load last used timestamps and encryption timestamp from sessionStorage
  useEffect(() => {
    try {
      // Load last used timestamps
      const savedLastUsed = sessionStorage.getItem(LAST_USED_KEY);
      if (savedLastUsed) {
        const parsed = JSON.parse(savedLastUsed);
        // Convert string dates back to Date objects
        const dates: Record<string, Date> = {};
        Object.keys(parsed).forEach(key => {
          dates[key] = new Date(parsed[key]);
        });
        setLastUsed(dates);
      }
      
      // Load encryption timestamp
      const savedEncryptionTimestamp = sessionStorage.getItem(ENCRYPTION_TIMESTAMP_KEY);
      if (savedEncryptionTimestamp) {
        setEncryptionTimestamp(parseInt(savedEncryptionTimestamp, 10));
      }
    } catch (error) {
      console.error('Failed to load API usage history:', error);
    }
  }, []);

  // Check if keys need rotation
  useEffect(() => {
    if (shouldRotateKey(encryptionTimestamp)) {
      rotateKeys();
    }
  }, [encryptionTimestamp]);

  // Rotate keys (re-encrypt them with a new salt)
  const rotateKeys = useCallback(() => {
    try {
      // Re-encrypt all API keys in the context
      apiConfigs.forEach(config => {
        if (config.apiKey) {
          const key = config.apiKey;
          updateAPIKey(config.name, key); // This will trigger re-encryption
        }
      });
      
      // Update timestamp
      const now = Date.now();
      sessionStorage.setItem(ENCRYPTION_TIMESTAMP_KEY, now.toString());
      setEncryptionTimestamp(now);
      
      console.log('API keys rotated successfully');
    } catch (error) {
      console.error('Failed to rotate API keys:', error);
    }
  }, [apiConfigs, updateAPIKey]);

  // Update last used timestamp when an API is used
  const updateLastUsed = useCallback((apiName: string) => {
    const now = new Date();
    setLastUsed(prev => {
      const updated = { ...prev, [apiName]: now };
      try {
        sessionStorage.setItem(LAST_USED_KEY, JSON.stringify(
          Object.entries(updated).reduce((acc, [key, value]) => {
            acc[key] = value.toISOString();
            return acc;
          }, {} as Record<string, string>)
        ));
      } catch (error) {
        console.error('Failed to save API usage history:', error);
      }
      return updated;
    });
  }, []);

  // Get a specific API key by name
  const getAPIKey = useCallback((name: string): string | undefined => {
    return getSecureAPIKey(name);
  }, [getSecureAPIKey]);

  // Get a specific API key and endpoint for easy API requests
  const getAPICredentials = useCallback((name: string): { apiKey?: string; endpoint?: string } => {
    const config = apiConfigs.find(c => c.name === name);
    return {
      apiKey: config?.apiKey,
      endpoint: config?.endpoint
    };
  }, [apiConfigs]);

  // Check if API key is available
  const hasAPIKey = useCallback((name: string): boolean => {
    const key = getSecureAPIKey(name);
    return !!key && key.length > 0;
  }, [getSecureAPIKey]);

  // Update an API key
  const setAPIKey = useCallback((name: string, key: string) => {
    updateAPIKey(name, key);
    
    // Update encryption timestamp
    const now = Date.now();
    sessionStorage.setItem(ENCRYPTION_TIMESTAMP_KEY, now.toString());
    setEncryptionTimestamp(now);
    
    // Hide the key after setting it
    setVisibleKeys(prev => ({ ...prev, [name]: false }));
  }, [updateAPIKey]);

  // Toggle visibility of an API key
  const toggleKeyVisibility = useCallback((name: string) => {
    setVisibleKeys(prev => ({ ...prev, [name]: !prev[name] }));
    
    // Auto-hide the key after 30 seconds for security
    if (!visibleKeys[name]) {
      setTimeout(() => {
        setVisibleKeys(prev => ({ ...prev, [name]: false }));
      }, 30000); // 30 seconds
    }
  }, [visibleKeys]);

  // Copy API key to clipboard
  const copyAPIKeyToClipboard = useCallback((name: string) => {
    const key = getSecureAPIKey(name);
    if (key) {
      navigator.clipboard.writeText(key)
        .then(() => toast.success(`API key for ${name} copied to clipboard`))
        .catch(() => toast.error('Failed to copy API key'));
    } else {
      toast.error(`No API key found for ${name}`);
    }
  }, [getSecureAPIKey]);

  // Get masked API key for display
  const getMaskedAPIKey = useCallback((name: string): string => {
    if (visibleKeys[name]) {
      return getSecureAPIKey(name) || '';
    }
    
    const key = getSecureAPIKey(name);
    if (!key) return '';
    
    // Show first 4 and last 4 characters, mask the rest
    if (key.length <= 8) {
      return '••••••••';
    }
    
    return `${key.substring(0, 4)}${'•'.repeat(Math.min(key.length - 8, 20))}${key.substring(key.length - 4)}`;
  }, [getSecureAPIKey, visibleKeys]);

  // Use an API key to make a request with proper headers
  const makeAPIRequest = useCallback(async (
    apiName: string, 
    endpoint: string,
    options: RequestInit = {}
  ) => {
    const apiKey = getSecureAPIKey(apiName);
    
    if (!apiKey) {
      toast.error(`No API key found for ${apiName}`);
      return null;
    }
    
    setLoading(prev => ({ ...prev, [apiName]: true }));
    
    try {
      // Add authorization header
      const headers = new Headers(options.headers || {});
      headers.set('Authorization', `Bearer ${apiKey}`);
      
      const response = await fetch(endpoint, {
        ...options,
        headers
      });
      
      // Update last used timestamp
      updateLastUsed(apiName);
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error making API request to ${apiName}:`, error);
      toast.error(`API request to ${apiName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    } finally {
      setLoading(prev => ({ ...prev, [apiName]: false }));
    }
  }, [getSecureAPIKey, updateLastUsed]);

  // Get loading state for specific API
  const isLoading = useCallback((apiName: string): boolean => {
    return !!loading[apiName];
  }, [loading]);

  // Get last used timestamp for an API
  const getLastUsed = useCallback((apiName: string): Date | undefined => {
    return lastUsed[apiName];
  }, [lastUsed]);

  // Check if key is currently visible
  const isKeyVisible = useCallback((apiName: string): boolean => {
    return !!visibleKeys[apiName];
  }, [visibleKeys]);

  return {
    getAPIKey,
    hasAPIKey,
    setAPIKey,
    makeAPIRequest,
    isLoading,
    getAPICredentials,
    availableAPIs: apiConfigs.map(c => c.name),
    toggleKeyVisibility,
    isKeyVisible,
    getMaskedAPIKey,
    copyAPIKeyToClipboard,
    getLastUsed,
    rotateKeys
  };
};
