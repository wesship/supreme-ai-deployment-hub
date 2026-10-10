
import { loadSettings, saveSettingsHandler, testConnection, resetSettings } from './settingsHandlers';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Get form elements
  const apiUrlInput = document.getElementById('api-url') as HTMLInputElement;
  const userIdInput = document.getElementById('user-id') as HTMLInputElement;
  const testConnectionButton = document.getElementById('test-connection') as HTMLButtonElement;
  const connectionStatus = document.getElementById('connection-status') as HTMLDivElement;
  const notifyTaskComplete = document.getElementById('notify-task-complete') as HTMLInputElement;
  const notifyErrors = document.getElementById('notify-errors') as HTMLInputElement;
  const saveButton = document.getElementById('save-settings') as HTMLButtonElement;
  const resetButton = document.getElementById('reset-settings') as HTMLButtonElement;

  // Load settings
  loadSettings(apiUrlInput, userIdInput, notifyTaskComplete, notifyErrors);
  
  // Setup event listeners
  setupEventListeners();

  /**
   * Setup event listeners
   */
  function setupEventListeners(): void {
    testConnectionButton.addEventListener('click', () => {
      testConnection(apiUrlInput, connectionStatus, testConnectionButton);
    });
    
    saveButton.addEventListener('click', () => {
      saveSettingsHandler(apiUrlInput, userIdInput, notifyTaskComplete, notifyErrors, connectionStatus);
    });
    
    resetButton.addEventListener('click', () => {
      resetSettings(apiUrlInput, userIdInput, notifyTaskComplete, notifyErrors, connectionStatus);
    });
    
    // Add enter key support for API URL field
    apiUrlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        testConnection(apiUrlInput, connectionStatus, testConnectionButton);
      }
    });
  }
});
