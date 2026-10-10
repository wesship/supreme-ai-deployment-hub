
import { toast } from 'sonner';
import { GitRepository, GitStashEntry, generateRandomHash } from './types';

/**
 * Service for handling Git stash operations
 */
export const stashService = {
  /**
   * Create a stash in a repository
   * @param repository Repository to create stash in
   * @param message Stash message
   */
  createStash: async (repository: GitRepository, message: string): Promise<GitStashEntry> => {
    try {
      // Simulate API call to create stash
      console.log(`Creating stash in repository: ${repository.name}, message: ${message}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate created stash
      const stash: GitStashEntry = {
        id: `stash_${Date.now()}`,
        message: message || `WIP on ${repository.branch}`,
        date: new Date(),
        hash: generateRandomHash(7),
        branch: repository.branch,
      };
      
      toast.success(`Stash created successfully`);
      return stash;
    } catch (error) {
      console.error('Error creating stash:', error);
      toast.error(`Failed to create stash: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  },
  
  /**
   * Get stashes for a repository
   * @param repository Repository to get stashes for
   */
  getStashes: async (repository: GitRepository): Promise<GitStashEntry[]> => {
    try {
      // Simulate API call to get stashes
      console.log(`Getting stashes for repository: ${repository.name}`);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Simulate stashes data
      const stashes: GitStashEntry[] = [
        {
          id: 'stash_1',
          message: `WIP on ${repository.branch}: Latest feature`,
          date: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
          hash: generateRandomHash(7),
          branch: repository.branch,
        },
        {
          id: 'stash_2',
          message: 'Bugfix in progress',
          date: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
          hash: generateRandomHash(7),
          branch: 'develop',
        }
      ];
      
      return stashes;
    } catch (error) {
      console.error('Error getting stashes:', error);
      toast.error(`Failed to get stashes: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  },
  
  /**
   * Apply stash in a repository
   * @param repository Repository to apply stash in
   * @param stashId ID of stash to apply
   * @param drop Whether to drop the stash after applying (default: true)
   */
  applyStash: async (repository: GitRepository, stashId: string, drop = true): Promise<void> => {
    try {
      // Simulate API call to apply stash
      console.log(`Applying stash ${stashId} in repository: ${repository.name}, drop: ${drop}`);
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      toast.success(`Stash applied ${drop ? 'and dropped ' : ''}successfully`);
    } catch (error) {
      console.error('Error applying stash:', error);
      toast.error(`Failed to apply stash: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  },
  
  /**
   * Drop stash in a repository
   * @param repository Repository to drop stash in
   * @param stashId ID of stash to drop
   */
  dropStash: async (repository: GitRepository, stashId: string): Promise<void> => {
    try {
      // Simulate API call to drop stash
      console.log(`Dropping stash ${stashId} in repository: ${repository.name}`);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      toast.success(`Stash dropped successfully`);
    } catch (error) {
      console.error('Error dropping stash:', error);
      toast.error(`Failed to drop stash: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
};
