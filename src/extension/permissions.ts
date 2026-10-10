
/**
 * Utilities for handling Chrome extension permissions
 */

/**
 * Required permissions for the extension
 */
export const REQUIRED_PERMISSIONS = {
  permissions: ['storage', 'notifications', 'tabs'],
  origins: ['https://api.d3vonn.io/*', 'https://staging-api.d3vonn.io/*']
};

/**
 * Check if the extension has all required permissions
 */
export async function checkRequiredPermissions(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.contains(REQUIRED_PERMISSIONS, (hasPermissions) => {
      resolve(hasPermissions);
    });
  });
}

/**
 * Request missing permissions
 */
export async function requestMissingPermissions(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.request(REQUIRED_PERMISSIONS, (granted) => {
      resolve(granted);
    });
  });
}

/**
 * Check and request missing permissions
 * Returns true if all permissions are granted (either already had them or newly granted)
 */
export async function ensurePermissions(): Promise<boolean> {
  const hasPermissions = await checkRequiredPermissions();
  if (hasPermissions) {
    return true;
  }
  
  // If missing permissions, request them
  return await requestMissingPermissions();
}

/**
 * Check specific permission
 */
export async function hasPermission(permission: string): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.contains({
      permissions: [permission]
    }, (result) => {
      resolve(result);
    });
  });
}

/**
 * Return a list of missing permissions from the required set
 */
export async function getMissingPermissions(): Promise<{
  permissions: string[];
  origins: string[];
}> {
  const missingPermissions = {
    permissions: [] as string[],
    origins: [] as string[]
  };
  
  // Check each permission individually
  for (const permission of REQUIRED_PERMISSIONS.permissions) {
    const hasPermission = await new Promise<boolean>((resolve) => {
      chrome.permissions.contains({
        permissions: [permission]
      }, (result) => {
        resolve(result);
      });
    });
    
    if (!hasPermission) {
      missingPermissions.permissions.push(permission);
    }
  }
  
  // Check each origin individually
  for (const origin of REQUIRED_PERMISSIONS.origins) {
    const hasOrigin = await new Promise<boolean>((resolve) => {
      chrome.permissions.contains({
        origins: [origin]
      }, (result) => {
        resolve(result);
      });
    });
    
    if (!hasOrigin) {
      missingPermissions.origins.push(origin);
    }
  }
  
  return missingPermissions;
}
