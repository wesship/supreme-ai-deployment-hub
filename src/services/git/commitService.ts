
import { toast } from 'sonner';
import { GitCommit, GitRepository, generateRandomHash } from './types';

/**
 * Service for handling Git commit operations
 */
export const commitService = {
  /**
   * Get commit history for a repository
   * @param repository Repository to get commit history for
   * @param limit Maximum number of commits to return (default: 30)
   * @param skip Number of commits to skip for pagination (default: 0)
   */
  getCommitHistory: async (repository: GitRepository, limit = 30, skip = 0): Promise<GitCommit[]> => {
    try {
      // Simulate API call to get commit history
      console.log(`Getting commit history for repository: ${repository.name}, branch: ${repository.branch}`);
      console.log(`Limit: ${limit}, Skip: ${skip}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate commit history data
      const commits: GitCommit[] = Array.from({ length: Math.min(limit, 30) }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i - skip);
        
        const hash = generateRandomHash(40);
        
        return {
          id: `commit_${i + skip + 1}`,
          hash,
          shortHash: hash.substring(0, 7),
          message: i === 0 && skip === 0 
            ? 'Initial commit' 
            : `Update ${['component', 'service', 'feature', 'documentation'][Math.floor(Math.random() * 4)]} ${Math.floor(Math.random() * 20) + 1}`,
          author: ['John Doe', 'Jane Smith', 'Bob Johnson', 'Alice Williams'][Math.floor(Math.random() * 4)],
          email: ['john@example.com', 'jane@example.com', 'bob@example.com', 'alice@example.com'][Math.floor(Math.random() * 4)],
          date,
          branch: repository.branch,
          tags: i === 0 ? ['latest'] : undefined
        };
      });
      
      return commits;
    } catch (error) {
      console.error('Error getting commit history:', error);
      toast.error(`Failed to get commit history: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
};
