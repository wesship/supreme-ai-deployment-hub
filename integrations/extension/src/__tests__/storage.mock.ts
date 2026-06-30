import { vi } from 'vitest';

import { DevonnSettings } from '../storage';

// Mock settings data
const mockSettings: DevonnSettings = {
  apiUrl: 'https://api.d3vonn.io',
  userId: 'test-user',
  notifications: {
    taskComplete: true,
    errors: true
  },
  lastCheck: Date.now() // Adding the missing lastCheck property
};

// Mock chrome APIs for testing
export const mockChrome = {
  storage: {
    local: {
      get: vi.fn((keys, callback) => {
        callback({ settings: mockSettings });
      }),
      set: vi.fn((items, callback) => {
        if (callback) callback();
      })
    },
    onChanged: {
      addListener: vi.fn()
    }
  },
  permissions: {
    contains: vi.fn()
  },
  tabs: {
    onActivated: {
      addListener: vi.fn()
    }
  },
  runtime: {
    lastError: undefined
  }
};

// Mock storage implementation
export const mockChromeStorage = {
  get: vi.fn((keys, callback) => {
    callback({ settings: mockSettings });
  }),
  set: vi.fn((items, callback) => {
    if (callback) callback();
  })
};

// Setup chrome storage mock
export function setupChromeStorageMock() {
  return mockChrome;
}

// Reset mock between tests
export function resetChromeStorageMock() {
  mockChromeStorage.get.mockClear();
  mockChromeStorage.set.mockClear();
  mockChrome.storage.local.get.mockClear();
  mockChrome.storage.local.set.mockClear();
}
