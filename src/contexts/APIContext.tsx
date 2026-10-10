
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';
import { APIConfig, NewAPIConfig } from '@/types/api';
import { encrypt, decrypt } from '@/utils/encryption';

interface APIContextType {
  apiConfigs: APIConfig[];
  addAPIConfig: (config: NewAPIConfig) => void;
  removeAPIConfig: (name: string) => void;
  testConnection: (name: string) => Promise<boolean>;
  getAPIConfig: (name: string) => APIConfig | undefined;
  isAnyAPIConnected: boolean;
  getSecureAPIKey: (name: string) => string | undefined;
  updateAPIKey: (name: string, newKey: string) => void;
}

const APIContext = createContext<APIContextType | undefined>(undefined);

// Storage key for localStorage
const STORAGE_KEY = 'devonn_api_configs';

export const APIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [apiConfigs, setAPIConfigs] = useState<APIConfig[]>([]);
  
  // Load saved configs from localStorage on initial load
  useEffect(() => {
    const savedConfigs = localStorage.getItem(STORAGE_KEY);
    if (savedConfigs) {
      try {
        const parsedConfigs = JSON.parse(savedConfigs) as APIConfig[];
        
        // Decrypt any stored API keys
        const decryptedConfigs = parsedConfigs.map(config => ({
          ...config,
          apiKey: config.apiKey ? decrypt(config.apiKey) : undefined
        }));
        
        setAPIConfigs(decryptedConfigs);
      } catch (error) {
        console.error('Error loading API configurations:', error);
        toast.error('Failed to load saved API configurations');
      }
    }
  }, []);
  
  // Save configs to localStorage whenever they change
  useEffect(() => {
    if (apiConfigs.length > 0) {
      try {
        // Encrypt API keys before storing
        const encryptedConfigs = apiConfigs.map(config => ({
          ...config,
          apiKey: config.apiKey ? encrypt(config.apiKey) : undefined
        }));
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(encryptedConfigs));
      } catch (error) {
        console.error('Error saving API configurations:', error);
      }
    }
  }, [apiConfigs]);
  
  const addAPIConfig = (config: NewAPIConfig) => {
    setAPIConfigs(prev => {
      // Check if config with this name already exists
      const exists = prev.some(c => c.name === config.name);
      if (exists) {
        toast.error(`API configuration '${config.name}' already exists.`);
        return prev;
      }
      
      const newConfig: APIConfig = {
        ...config,
        isConnected: false
      };
      
      toast.success(`Added API configuration for ${config.name}`);
      return [...prev, newConfig];
    });
  };
  
  const removeAPIConfig = (name: string) => {
    setAPIConfigs(prev => {
      const newConfigs = prev.filter(c => c.name !== name);
      if (newConfigs.length < prev.length) {
        toast.info(`Removed API configuration for ${name}`);
      }
      return newConfigs;
    });
  };
  
  const testConnection = async (name: string): Promise<boolean> => {
    const config = apiConfigs.find(c => c.name === name);
    if (!config) {
      toast.error(`API configuration '${name}' not found.`);
      return false;
    }
    
    try {
      // Simple check to see if endpoint is reachable
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(config.endpoint, {
        method: 'HEAD',
        headers: config.apiKey ? {
          'Authorization': `Bearer ${config.apiKey}`
        } : {},
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const isConnected = response.ok;
      
      // Update the config with connection status
      setAPIConfigs(prev => prev.map(c => 
        c.name === name ? { 
          ...c, 
          isConnected,
          lastConnected: isConnected ? new Date() : c.lastConnected
        } : c
      ));
      
      if (isConnected) {
        toast.success(`Successfully connected to ${name} API`);
      } else {
        toast.error(`Failed to connect to ${name} API. Status: ${response.status}`);
      }
      
      return isConnected;
    } catch (error) {
      console.error(`Error connecting to ${name} API:`, error);
      
      // Update the config with failed connection status
      setAPIConfigs(prev => prev.map(c => 
        c.name === name ? { ...c, isConnected: false } : c
      ));
      
      toast.error(`Failed to connect to ${name} API. ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };
  
  const getAPIConfig = (name: string): APIConfig | undefined => {
    return apiConfigs.find(c => c.name === name);
  };

  // Get decrypted API key by name
  const getSecureAPIKey = (name: string): string | undefined => {
    const config = apiConfigs.find(c => c.name === name);
    return config?.apiKey;
  };
  
  // Update API key with encryption
  const updateAPIKey = (name: string, newKey: string) => {
    setAPIConfigs(prev => prev.map(c => 
      c.name === name ? { ...c, apiKey: newKey } : c
    ));
    toast.success(`API key for ${name} has been updated`);
  };
  
  const isAnyAPIConnected = apiConfigs.some(c => c.isConnected);
  
  return (
    <APIContext.Provider
      value={{
        apiConfigs,
        addAPIConfig,
        removeAPIConfig,
        testConnection,
        getAPIConfig,
        isAnyAPIConnected,
        getSecureAPIKey,
        updateAPIKey
      }}
    >
      {children}
    </APIContext.Provider>
  );
};

export const useAPI = () => {
  const context = useContext(APIContext);
  if (context === undefined) {
    throw new Error('useAPI must be used within an APIProvider');
  }
  return context;
};
