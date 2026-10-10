
import { DevonnSettings, getSettings, saveSettings } from './storage';

/**
 * API Client for background operations
 */
class ApiClient {
  async checkConnection(apiUrl: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${apiUrl}/health-check`, { 
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error('API connection check failed:', error);
      return false;
    }
  }
  
  async runTask(apiUrl: string, agentId: string, task: any): Promise<any> {
    // Add timeout to fetch to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
      const response = await fetch(`${apiUrl}/agents/run/${agentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(task),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
  
  async checkUpdates(apiUrl: string, lastCheck: number): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(
        `${apiUrl}/agents/updates?since=${lastCheck}`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) return { updates: [] };
      
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Error checking for updates:', error);
      return { updates: [] };
    }
  }
}

/**
 * Notification Manager
 */
class NotificationManager {
  async showNotification(title: string, message: string): Promise<void> {
    const { notifications } = await getSettings(['notifications']);
    const notificationSettings = notifications || { taskComplete: true, errors: true };
    
    if ((title.includes('Error') && notificationSettings.errors) || 
        (!title.includes('Error') && notificationSettings.taskComplete)) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: title,
        message: message
      });
    }
  }
}

// Initialize singletons
const api = new ApiClient();
const notifications = new NotificationManager();

/**
 * Connection monitor
 */
async function monitorConnection(): Promise<void> {
  const settings = await getSettings(['apiUrl', 'wasDisconnected']);
  const apiUrl = settings.apiUrl || 'http://localhost:8000';
  
  try {
    const isConnected = await api.checkConnection(apiUrl);
    
    // Update connection status in storage
    await saveSettings({ connectionStatus: isConnected });
    
    // If connection was restored after being down, show notification
    if (settings.wasDisconnected && isConnected) {
      await notifications.showNotification(
        'Connection Restored', 
        'Connection to Devonn.AI API has been restored'
      );
      await saveSettings({ wasDisconnected: false });
    } else if (!isConnected && !settings.wasDisconnected) {
      await saveSettings({ wasDisconnected: true });
      await notifications.showNotification(
        'Connection Lost', 
        'Connection to Devonn.AI API has been lost'
      );
    }
  } catch (error) {
    console.error('Error monitoring connection:', error);
  }
}

/**
 * Check for agent updates
 */
async function checkForAgentUpdates(): Promise<void> {
  try {
    const settings = await getSettings(['apiUrl', 'lastCheck']);
    const apiUrl = settings.apiUrl || 'http://localhost:8000';
    const lastCheck = settings.lastCheck || 0;
    const now = Date.now();
    
    // Only check if sufficient time has passed (15 mins)
    if (now - lastCheck < 15 * 60 * 1000) {
      return;
    }
    
    const data = await api.checkUpdates(apiUrl, lastCheck);
    
    if (data.updates && data.updates.length > 0) {
      await notifications.showNotification(
        'Devonn.AI Updates Available',
        `${data.updates.length} agent updates available. Open the extension to refresh.`
      );
    }
    
    // Update the last check timestamp regardless of updates
    await saveSettings({ lastCheck: now });
  } catch (error) {
    console.error('Error in update check:', error);
  }
}

// Message handlers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'runTask') {
    handleRunTask(request, sendResponse);
    return true; // Keep the message channel open
  }
  
  if (request.action === 'checkConnection') {
    handleCheckConnection(sendResponse);
    return true; // Keep the message channel open
  }
});

async function handleRunTask(request: any, sendResponse: (response: any) => void): Promise<void> {
  try {
    const settings = await getSettings(['apiUrl', 'userId', 'notifications']);
    const apiUrl = settings.apiUrl || 'http://localhost:8000';
    
    // Add userId to task if not provided
    if (!request.task.user_id) {
      request.task.user_id = settings.userId || 'extension-user';
    }
    
    const result = await api.runTask(apiUrl, request.agentId, request.task);
    
    // Show notification based on user preferences
    if (settings.notifications?.taskComplete) {
      await notifications.showNotification(
        'Task Completed',
        `Agent ${request.agentId} completed the task`
      );
    }
    
    sendResponse({ success: true, result });
  } catch (error: any) {
    // Show error notification based on user preferences
    if ((await getSettings(['notifications'])).notifications?.errors) {
      await notifications.showNotification(
        'Task Error',
        error.message || 'An unknown error occurred'
      );
    }
    
    sendResponse({ 
      success: false, 
      error: error.message || 'An unknown error occurred' 
    });
  }
}

async function handleCheckConnection(sendResponse: (response: any) => void): Promise<void> {
  try {
    const settings = await getSettings(['apiUrl']);
    const apiUrl = settings.apiUrl || 'http://localhost:8000';
    
    const isConnected = await api.checkConnection(apiUrl);
    sendResponse({ connected: isConnected });
  } catch (error: any) {
    sendResponse({ connected: false, error: error.message });
  }
}

// Initialize extension when installed
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Devonn.AI Assistant has been installed');
  
  // Initialize settings
  await saveSettings({
    apiUrl: 'http://localhost:8000',
    userId: 'extension-user',
    notifications: {
      taskComplete: true,
      errors: true
    },
    lastCheck: Date.now()
  });
  
  // Create alarm for periodic health checks
  chrome.alarms.create('healthCheck', { periodInMinutes: 5 });
  
  // Create alarm for agent updates check
  chrome.alarms.create('agentUpdates', { periodInMinutes: 15 });
});

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'healthCheck') {
    monitorConnection();
  }
  
  if (alarm.name === 'agentUpdates') {
    checkForAgentUpdates();
  }
});
