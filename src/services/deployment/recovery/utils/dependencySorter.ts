import { RecoveryResource } from '../types';

export function sortResourcesByDependencies(resources: RecoveryResource[]): RecoveryResource[] {
  const sortedResources: RecoveryResource[] = [];
  const remainingResources = [...resources];
  const resourceMap = new Map<string, RecoveryResource>();
  
  // Create resource map for quick lookup
  resources.forEach(resource => {
    resourceMap.set(resource.resourceId, resource);
  });
  
  // Helper function to check if all dependencies are in the sorted list
  const allDependenciesSorted = (resource: RecoveryResource): boolean => {
    if (!resource.dependencies || resource.dependencies.length === 0) {
      return true;
    }
    
    return resource.dependencies.every(depId => {
      const isInSorted = sortedResources.some(r => r.resourceId === depId);
      const depExists = resourceMap.has(depId);
      return isInSorted || !depExists;
    });
  };
  
  // Keep processing until all resources are sorted
  while (remainingResources.length > 0) {
    const initialLength = remainingResources.length;
    
    // Find resources with satisfied dependencies
    for (let i = 0; i < remainingResources.length; i++) {
      const resource = remainingResources[i];
      if (allDependenciesSorted(resource)) {
        sortedResources.push(resource);
        remainingResources.splice(i, 1);
        i--;
      }
    }
    
    // Check for circular dependencies
    if (remainingResources.length === initialLength && remainingResources.length > 0) {
      console.warn('Detected circular dependencies, breaking the cycle:', remainingResources);
      sortedResources.push(remainingResources[0]);
      remainingResources.splice(0, 1);
    }
  }
  
  return sortedResources;
}
