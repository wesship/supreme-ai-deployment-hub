
import { toast } from 'sonner';
import { GitRepository, GitTag, generateRandomHash } from './types';

/**
 * Service for handling Git tag operations
 */
export const tagService = {
  /**
   * Create tag in a repository
   * @param repository Repository to create tag in
   * @param name Tag name
   * @param commitHash Commit hash to tag (default: HEAD)
   * @param message Tag message
   */
  createTag: async (repository: GitRepository, name: string, commitHash = 'HEAD', message?: string): Promise<GitTag> => {
    try {
      // Simulate API call to create tag
      console.log(`Creating tag ${name} in repository: ${repository.name}, commit: ${commitHash}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate created tag
      const tag: GitTag = {
        name,
        commitHash: commitHash === 'HEAD' ? generateRandomHash(40) : commitHash,
        date: new Date(),
        message,
        taggerName: ['John Doe', 'Jane Smith', 'Bob Johnson', 'Alice Williams'][Math.floor(Math.random() * 4)],
        taggerEmail: ['john@example.com', 'jane@example.com', 'bob@example.com', 'alice@example.com'][Math.floor(Math.random() * 4)],
      };
      
      toast.success(`Tag ${name} created successfully`);
      return tag;
    } catch (error) {
      console.error('Error creating tag:', error);
      toast.error(`Failed to create tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  },
  
  /**
   * Get tags for a repository
   * @param repository Repository to get tags for
   */
  getTags: async (repository: GitRepository): Promise<GitTag[]> => {
    try {
      // Simulate API call to get tags
      console.log(`Getting tags for repository: ${repository.name}`);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Simulate tags data
      const tags: GitTag[] = [
        {
          name: 'v1.0.0',
          commitHash: generateRandomHash(40),
          date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // 30 days ago
          message: 'Initial release',
          taggerName: 'John Doe',
          taggerEmail: 'john@example.com',
        },
        {
          name: 'v1.1.0',
          commitHash: generateRandomHash(40),
          date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15), // 15 days ago
          message: 'Feature release',
          taggerName: 'Jane Smith',
          taggerEmail: 'jane@example.com',
        },
        {
          name: 'v1.1.1',
          commitHash: generateRandomHash(40),
          date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 7 days ago
          message: 'Bugfix release',
          taggerName: 'Bob Johnson',
          taggerEmail: 'bob@example.com',
        }
      ];
      
      return tags;
    } catch (error) {
      console.error('Error getting tags:', error);
      toast.error(`Failed to get tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  },
  
  /**
   * Delete tag in a repository
   * @param repository Repository to delete tag in
   * @param tagName Name of tag to delete
   */
  deleteTag: async (repository: GitRepository, tagName: string): Promise<void> => {
    try {
      // Simulate API call to delete tag
      console.log(`Deleting tag ${tagName} in repository: ${repository.name}`);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      toast.success(`Tag ${tagName} deleted successfully`);
    } catch (error) {
      console.error('Error deleting tag:', error);
      toast.error(`Failed to delete tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
};
