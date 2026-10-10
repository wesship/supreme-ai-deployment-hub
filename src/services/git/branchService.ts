
import { toast } from 'sonner';
import { GitBranch, GitRepository, generateRandomHash } from './types';

/**
 * Service for handling Git branch operations
 */
export const branchService = {
  /**
   * Get branches for a repository
   * @param repository Repository to get branches for
   */
  getBranches: async (repository: GitRepository): Promise<GitBranch[]> => {
    try {
      // Simulate API call to get branches
      console.log(`Getting branches for repository: ${repository.name}`);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Simulate branches data
      const branches: GitBranch[] = [
        {
          name: repository.branch,
          isActive: true,
          lastCommitHash: generateRandomHash(7),
          lastCommitDate: new Date(),
          isRemote: false,
          upstream: `origin/${repository.branch}`,
          ahead: 0,
          behind: 0
        },
        {
          name: 'develop',
          isActive: false,
          lastCommitHash: generateRandomHash(7),
          lastCommitDate: new Date(Date.now() - 1000 * 60 * 60 * 24),
          isRemote: false,
          upstream: 'origin/develop',
          ahead: 2,
          behind: 1
        },
        {
          name: 'feature/new-feature',
          isActive: false,
          lastCommitHash: generateRandomHash(7),
          lastCommitDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
          isRemote: false,
          upstream: 'origin/feature/new-feature',
          ahead: 5,
          behind: 0
        },
        {
          name: 'origin/main',
          isActive: false,
          lastCommitHash: generateRandomHash(7),
          lastCommitDate: new Date(),
          isRemote: true
        },
        {
          name: 'origin/develop',
          isActive: false,
          lastCommitHash: generateRandomHash(7),
          lastCommitDate: new Date(Date.now() - 1000 * 60 * 60 * 24),
          isRemote: true
        }
      ];
      
      return branches;
    } catch (error) {
      console.error('Error getting branches:', error);
      toast.error(`Failed to get branches: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  },

  /**
   * Create a new branch in a repository
   * @param repository Repository to create branch in
   * @param branchName Name of new branch
   * @param startPoint Starting point for branch (default: HEAD)
   */
  createBranch: async (repository: GitRepository, branchName: string, startPoint = 'HEAD'): Promise<GitBranch> => {
    try {
      // Simulate API call to create branch
      console.log(`Creating branch ${branchName} in repository: ${repository.name}, from: ${startPoint}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate created branch
      const newBranch: GitBranch = {
        name: branchName,
        isActive: true,
        lastCommitHash: generateRandomHash(7),
        lastCommitDate: new Date(),
        isRemote: false
      };
      
      toast.success(`Branch ${branchName} created successfully`);
      return newBranch;
    } catch (error) {
      console.error('Error creating branch:', error);
      toast.error(`Failed to create branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  },

  /**
   * Switch to a branch in a repository
   * @param repository Repository to switch branch in
   * @param branchName Name of branch to switch to
   */
  switchBranch: async (repository: GitRepository, branchName: string): Promise<GitRepository> => {
    try {
      // Simulate API call to switch branch
      console.log(`Switching to branch ${branchName} in repository: ${repository.name}`);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Update repository object
      const updatedRepo: GitRepository = {
        ...repository,
        branch: branchName,
        lastSynced: new Date(),
        status: 'synced'
      };
      
      toast.success(`Switched to branch ${branchName}`);
      return updatedRepo;
    } catch (error) {
      console.error('Error switching branch:', error);
      toast.error(`Failed to switch branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  },

  /**
   * Merge a branch into another branch
   * @param repository Repository to perform merge in
   * @param sourceBranch Name of the branch to merge from
   * @param targetBranch Name of the branch to merge into
   */
  mergeBranch: async (repository: GitRepository, sourceBranch: string, targetBranch: string): Promise<GitRepository> => {
    try {
      // Simulate API call to merge branches
      console.log(`Merging branch ${sourceBranch} into ${targetBranch} in repository: ${repository.name}`);
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Check for simulated merge conflicts (random 10% chance)
      if (Math.random() < 0.1) {
        throw new Error(`Merge conflict detected between ${sourceBranch} and ${targetBranch}`);
      }

      // Update repository object
      const updatedRepo: GitRepository = {
        ...repository,
        lastSynced: new Date(),
        status: 'synced'
      };

      return updatedRepo;
    } catch (error) {
      console.error('Error merging branches:', error);
      toast.error(`Failed to merge branches: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
};

