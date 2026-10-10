
// Main git service index file
import { commitService } from './commitService';
import { branchService } from './branchService';
import { tagService } from './tagService';
import { stashService } from './stashService';
import { diffService } from './diffService';
import { repoService } from './repoService';
import { compareService } from './compareService';

// Re-export all service types
export * from './types';

/**
 * Consolidated git service that combines all git-related functionality
 */
export const gitService = {
  ...repoService,    // Repository operations (clone, pull, push)
  ...commitService,  // Commit-related operations
  ...branchService,  // Branch management
  ...stashService,   // Stash operations
  ...tagService,     // Tag management
  ...diffService,    // Diff and file changes operations
  ...compareService  // Branch comparison operations
};

// For backward compatibility, also export the original object
export * from './types';
