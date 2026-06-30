
import { DevonnSettings, getSettings, saveSettings, defaultSettings } from './storage';
import { isValidUrl, isValidEmail, isValidApiKey, isEmptyString } from './settingsValidation';
import { showConnectionStatus, showErrorMessage, showSuccessMessage } from './settingsUI';

/**
 * Load settings from Chrome storage
 */
export async function loadSettings(
  apiUrlInput: HTMLInputElement,
  userIdInput: HTMLInputElement,
  notifyTaskComplete: HTMLInputElement,
  notifyErrors: HTMLInputElement
): Promise<void> {
  try {
    const settings = await getSettings();
    
    // Populate form with saved settings or defaults
    apiUrlInput.value = settings.apiUrl || defaultSettings.apiUrl;
    userIdInput.value = settings.userId || defaultSettings.userId;
    
    const notifications = settings.notifications || defaultSettings.notifications;
    notifyTaskComplete.checked = notifications.taskComplete !== false;
    notifyErrors.checked = notifications.errors !== false;
  } catch (error) {
    console.error('Error loading settings:', error);
    showErrorMessage('Failed to load settings. Please try again.', document.querySelector('.settings-form') as Element);
  }
}

/**
 * Save settings to Chrome storage
 */
export async function saveSettingsHandler(
  apiUrlInput: HTMLInputElement,
  userIdInput: HTMLInputElement,
  notifyTaskComplete: HTMLInputElement,
  notifyErrors: HTMLInputElement,
  connectionStatus: HTMLDivElement
): Promise<void> {
  const apiUrl = apiUrlInput.value.trim();
  const userId = userIdInput.value.trim();
  
  // Validate inputs
  if (isEmptyString(apiUrl)) {
    showErrorMessage('API URL cannot be empty.', document.querySelector('.settings-form') as Element);
    return;
  }
  
  // Validate URL format
  if (!isValidUrl(apiUrl)) {
    showErrorMessage('Please enter a valid URL for the API endpoint.', document.querySelector('.settings-form') as Element);
    return;
  }
  
  // Check if userId looks like an email - if so, validate it
  if (userId.includes('@') && !isValidEmail(userId)) {
    showErrorMessage('Please enter a valid email address for User ID.', document.querySelector('.settings-form') as Element);
    return;
  }
  
  const settings: Partial<DevonnSettings> = {
    apiUrl,
    userId,
    notifications: {
      taskComplete: notifyTaskComplete.checked,
      errors: notifyErrors.checked
    }
  };
  
  try {
    await saveSettings(settings);
    
    // Show saved message
    showSuccessMessage('Settings saved successfully!', document.querySelector('.settings-form') as Element);
    
    // Reset connection status after URL change
    if (settings.apiUrl !== apiUrlInput.dataset.lastTestedUrl) {
      connectionStatus.textContent = '';
      connectionStatus.className = '';
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    showErrorMessage(`Failed to save settings: ${error}`, document.querySelector('.settings-form') as Element);
  }
}

/**
 * Test API connection
 */
export async function testConnection(
  apiUrlInput: HTMLInputElement,
  connectionStatus: HTMLDivElement,
  testConnectionButton: HTMLButtonElement
): Promise<void> {
  const apiUrl = apiUrlInput.value.trim();
  if (!apiUrl) {
    showConnectionStatus('Please enter API URL', false, connectionStatus);
    return;
  }
  
  // Validate URL format
  if (!isValidUrl(apiUrl)) {
    showConnectionStatus('Invalid URL format', false, connectionStatus);
    return;
  }
  
  connectionStatus.textContent = 'Testing connection...';
  connectionStatus.className = '';
  testConnectionButton.disabled = true;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`${apiUrl}/health-check`, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      showConnectionStatus('Connection successful!', true, connectionStatus);
      // Store the last successfully tested URL
      apiUrlInput.dataset.lastTestedUrl = apiUrl;
    } else {
      showConnectionStatus(`Connection failed: Server returned ${response.status}`, false, connectionStatus);
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      showConnectionStatus('Connection timed out after 5 seconds', false, connectionStatus);
    } else {
      showConnectionStatus(`Connection failed: ${error.message}`, false, connectionStatus);
    }
  } finally {
    testConnectionButton.disabled = false;
  }
}

/**
 * Reset settings to defaults
 */
export function resetSettings(
  apiUrlInput: HTMLInputElement,
  userIdInput: HTMLInputElement,
  notifyTaskComplete: HTMLInputElement,
  notifyErrors: HTMLInputElement,
  connectionStatus: HTMLDivElement
): void {
  if (confirm('Are you sure you want to reset all settings to default?')) {
    apiUrlInput.value = defaultSettings.apiUrl;
    userIdInput.value = defaultSettings.userId;
    notifyTaskComplete.checked = defaultSettings.notifications.taskComplete;
    notifyErrors.checked = defaultSettings.notifications.errors;
    
    // Clear connection status
    connectionStatus.textContent = '';
    connectionStatus.className = '';
    
    // Save default settings
    saveSettings({
      apiUrl: defaultSettings.apiUrl,
      userId: defaultSettings.userId,
      notifications: {
        taskComplete: defaultSettings.notifications.taskComplete,
        errors: defaultSettings.notifications.errors
      }
    }).then(() => {
      showSuccessMessage('Settings reset to default values', document.querySelector('.settings-form') as Element);
    }).catch(error => {
      console.error('Error saving default settings:', error);
      showErrorMessage(`Failed to reset settings: ${error}`, document.querySelector('.settings-form') as Element);
    });
  }
}
