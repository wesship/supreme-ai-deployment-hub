
// Type definitions for Chrome extension API
// These declarations make the chrome namespace available to TypeScript

interface Chrome {
  storage: {
    local: {
      get: (keys: string[] | null, callback: (result: any) => void) => void;
      set: (items: object, callback?: () => void) => void;
    };
  };
  runtime: {
    lastError?: {
      message: string;
    };
    onMessage: {
      addListener: (callback: (request: any, sender: any, sendResponse: (response?: any) => void) => boolean | void) => void;
    };
    onInstalled: {
      addListener: (callback: (details: any) => void) => void;
    };
  };
  alarms: {
    create: (name: string, alarmInfo: { periodInMinutes: number }) => void;
    onAlarm: {
      addListener: (callback: (alarm: { name: string }) => void) => void;
    };
  };
  notifications: {
    create: (options: {
      type: string;
      iconUrl: string;
      title: string;
      message: string;
    }) => void;
  };
  permissions: {
    contains: (permissions: PermissionRequest, callback: (result: boolean) => void) => void;
    request: (permissions: PermissionRequest, callback: (granted: boolean) => void) => void;
  };
}

interface PermissionRequest {
  permissions?: string[];
  origins?: string[];
}

declare let chrome: Chrome;
