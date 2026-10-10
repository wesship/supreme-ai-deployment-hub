import { vi } from 'vitest';

// Setup for extension tests

// Mock the chrome.storage API
Object.defineProperty(global, 'chrome', {
  value: {
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn()
      }
    },
    runtime: {
      lastError: undefined
    }
  },
  writable: true
});

// Mock HTML elements that might not be available in the test environment
if (!global.document.querySelector('.settings-form')) {
  const form = document.createElement('div');
  form.className = 'settings-form';
  document.body.appendChild(form);
}
