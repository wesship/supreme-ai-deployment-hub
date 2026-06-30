
/**
 * Typed wrapper around Chrome storage API
 */

// Define the shape of our settings
export interface DevonnSettings {
  apiUrl: string;
  userId: string;
  notifications: {
    taskComplete: boolean;
    errors: boolean;
  };
  lastCheck: number;
  connectionStatus?: boolean;
  wasDisconnected?: boolean;
}

// Default settings
export const defaultSettings: DevonnSettings = {
  apiUrl: 'http://localhost:8000',
  userId: 'extension-user',
  notifications: {
    taskComplete: true,
    errors: true
  },
  lastCheck: Date.now()
};

/**
 * Get all settings or specific keys
 */
export const getSettings = async <K extends keyof DevonnSettings>(
  keys?: K[]
): Promise<Pick<DevonnSettings, K extends keyof DevonnSettings ? K : never>> => {
  return new Promise((resolve) => {
    if (keys && keys.length > 0) {
      chrome.storage.local.get(keys as string[], (result) => {
        resolve(result as Pick<DevonnSettings, K extends keyof DevonnSettings ? K : never>);
      });
    } else {
      chrome.storage.local.get(null, (result) => {
        resolve(result as Pick<DevonnSettings, K extends keyof DevonnSettings ? K : never>);
      });
    }
  });
};

/**
 * Save settings
 */
export const saveSettings = async <K extends keyof DevonnSettings>(
  settings: Partial<Pick<DevonnSettings, K>>
): Promise<void> => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(settings, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
};

/**
 * Initialize settings with defaults for missing values
 */
export const initializeSettings = async (): Promise<DevonnSettings> => {
  const settings = await getSettings();
  const updatedSettings = { ...defaultSettings, ...settings };
  
  // Set any missing properties
  await saveSettings(updatedSettings);
  
  return updatedSettings;
};
