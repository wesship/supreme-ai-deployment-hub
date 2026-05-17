// RBAC Middleware implementation for Phase 2
export enum Role {
  ADMIN = 'admin',
  DEVELOPER = 'developer',
  VIEWER = 'viewer'
}

export const ROLE_PERMISSIONS = {
  [Role.ADMIN]: ['*'],
  [Role.DEVELOPER]: ['deploy:create', 'deploy:read', 'agent:invoke'],
  [Role.VIEWER]: ['deploy:read', 'agent:read']
};

export function hasPermission(userRole: Role, requiredPermission: string): boolean {
  if (!userRole || !ROLE_PERMISSIONS[userRole]) return false;
  
  const permissions = ROLE_PERMISSIONS[userRole];
  if (permissions.includes('*')) return true;
  
  return permissions.includes(requiredPermission);
}
