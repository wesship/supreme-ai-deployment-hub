// background.js — D3VONN Chrome Extension Service Worker (Hardened)
//
// Fixes from audit:
//   1. CRITICAL: checkForAgentUpdates() references `controller` and `timeoutId`
//      that are out of scope — causes silent runtime crash on every 15-min alarm.
//   2. HIGH: No authentication on API calls — any page could trigger agent runs.
//   3. HIGH: `apiUrl` defaults to http://localhost:8000 with no HTTPS enforcement.
//   4. MEDIUM: AbortController in checkApiConnection() is never aborted (memory leak).
//   5. MEDIUM: No input validation on agentId or task before sending to API.

'use strict';

const DEFAULT_API_URL = 'https://api.d3vonn.io';
const HEALTH_CHECK_INTERVAL_MINUTES = 5;
const AGENT_UPDATE_INTERVAL_MINUTES = 15;
const REQUEST_TIMEOUT_MS = 30_000;

// ── Initialization ────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  console.log('[D3VONN] Extension installed');
  chrome.storage.local.get(['apiUrl', 'userId'], (result) => {
    if (!result.apiUrl) {
      chrome.storage.local.set({
        apiUrl: DEFAULT_API_URL,
        userId: 'extension-user',
        notifications: { taskComplete: true, errors: true },
        lastCheck: Date.now(),
      });
    }
  });
  chrome.alarms.create('healthCheck', { periodInMinutes: HEALTH_CHECK_INTERVAL_MINUTES });
  chrome.alarms.create('agentUpdates', { periodInMinutes: AGENT_UPDATE_INTERVAL_MINUTES });
});

// ── Message handler ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Only accept messages from the extension's own popup/options pages
  if (sender.id !== chrome.runtime.id) {
    sendResponse({ success: false, error: 'Unauthorized sender' });
    return false;
  }

  if (request.action === 'runTask') {
    // Validate inputs before sending to API
    if (!request.agentId || typeof request.agentId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(request.agentId)) {
      sendResponse({ success: false, error: 'Invalid agentId' });
      return false;
    }
    if (!request.task || typeof request.task !== 'object') {
      sendResponse({ success: false, error: 'Invalid task payload' });
      return false;
    }
    runAgentTask(request.agentId, request.task)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message || 'Unknown error' }));
    return true;
  }

  if (request.action === 'checkConnection') {
    checkApiConnection()
      .then(isConnected => sendResponse({ connected: isConnected }))
      .catch(() => sendResponse({ connected: false }));
    return true;
  }

  return false;
});

// ── Alarm handler ─────────────────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'healthCheck') {
    checkApiConnection()
      .then(isConnected => {
        chrome.storage.local.set({ connectionStatus: isConnected });
        chrome.storage.local.get(['wasDisconnected'], (result) => {
          if (result.wasDisconnected && isConnected) {
            showNotification('Connection Restored', 'Connection to D3VONN API has been restored');
            chrome.storage.local.set({ wasDisconnected: false });
          } else if (!isConnected && !result.wasDisconnected) {
            chrome.storage.local.set({ wasDisconnected: true });
            showNotification('Connection Lost', 'Connection to D3VONN API has been lost');
          }
        });
      })
      .catch(console.error);
  }
  if (alarm.name === 'agentUpdates') {
    checkForAgentUpdates().catch(console.error);
  }
});

// ── API helpers ───────────────────────────────────────────────────────────────

/**
 * Returns a fetch with a timeout and the stored auth token.
 */
async function fetchWithAuth(url, options = {}) {
  const settings = await chrome.storage.local.get(['apiUrl', 'authToken']);
  const apiUrl = enforceHttps(settings.apiUrl || DEFAULT_API_URL);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const headers = {
    'Content-Type': 'application/json',
    ...(settings.authToken ? { Authorization: `Bearer ${settings.authToken}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${apiUrl}${url}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Enforce HTTPS for all API URLs (prevents downgrade to HTTP in production).
 */
function enforceHttps(url) {
  if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
    return url; // Allow localhost for local dev
  }
  return url.replace(/^http:\/\//, 'https://');
}

async function runAgentTask(agentId, task) {
  const settings = await chrome.storage.local.get(['userId']);
  if (!task.user_id) task.user_id = settings.userId || 'extension-user';

  const response = await fetchWithAuth(`/agents/run/${encodeURIComponent(agentId)}`, {
    method: 'POST',
    body: JSON.stringify(task),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();

  chrome.storage.local.get(['notifications'], (s) => {
    if ((s.notifications || {}).taskComplete) {
      showNotification('Task Completed', `Agent ${agentId} completed the task`);
    }
  });

  return result;
}

async function checkForAgentUpdates() {
  // FIX: controller and timeoutId are now scoped inside fetchWithAuth
  const settings = await chrome.storage.local.get(['lastCheck']);
  const lastCheck = settings.lastCheck || 0;
  const now = Date.now();

  const response = await fetchWithAuth(`/agents/updates?since=${lastCheck}`);
  if (!response.ok) return;

  const data = await response.json();
  if (data.updates && data.updates.length > 0) {
    chrome.storage.local.get(['notifications'], (s) => {
      if ((s.notifications || {}).taskComplete) {
        showNotification('D3VONN Updates', `${data.updates.length} agent updates available`);
      }
    });
  }
  chrome.storage.local.set({ lastCheck: now });
}

async function checkApiConnection() {
  try {
    const response = await fetchWithAuth('/status/health');
    return response.ok;
  } catch {
    return false;
  }
}

function showNotification(title, message) {
  chrome.storage.local.get(['notifications'], (result) => {
    const prefs = result.notifications || { taskComplete: true, errors: true };
    const isError = title.toLowerCase().includes('error') || title.toLowerCase().includes('lost');
    if ((isError && prefs.errors) || (!isError && prefs.taskComplete)) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title,
        message,
      });
    }
  });
}
