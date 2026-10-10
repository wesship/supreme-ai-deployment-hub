
import { toast } from 'sonner';
import { GitDiff, GitRepository } from './types';

/**
 * Service for handling Git diff operations
 */
export const diffService = {
  /**
   * Get diff between two commits
   * @param repository Repository to get diff for
   * @param oldHash Old commit hash
   * @param newHash New commit hash (default: HEAD)
   */
  getDiff: async (repository: GitRepository, oldHash: string, newHash = 'HEAD'): Promise<GitDiff[]> => {
    try {
      // Simulate API call to get diff
      console.log(`Getting diff for repository: ${repository.name}, old: ${oldHash}, new: ${newHash}`);
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      // Simulate diff data
      const diffs: GitDiff[] = [
        {
          filePath: 'src/components/Example.tsx',
          additions: 15,
          deletions: 7,
          hunks: [
            {
              oldStart: 10,
              oldLines: 5,
              newStart: 10,
              newLines: 8,
              content: `@@ -10,5 +10,8 @@\n import React from 'react';\n-const Example = () => {\n-  return <div>Example</div>;\n+const Example = ({ title }) => {\n+  return (\n+    <div className="example">\n+      <h2>{title}</h2>\n+      <p>Example component content</p>\n+    </div>\n+  );\n };\n export default Example;`
            }
          ]
        },
        {
          filePath: 'src/styles/global.css',
          additions: 5,
          deletions: 0,
          hunks: [
            {
              oldStart: 25,
              oldLines: 0,
              newStart: 25,
              newLines: 5,
              content: `@@ -25,0 +25,5 @@\n+.example {\n+  padding: 1rem;\n+  border: 1px solid #ddd;\n+  border-radius: 4px;\n+}`
            }
          ]
        }
      ];
      
      return diffs;
    } catch (error) {
      console.error('Error getting diff:', error);
      toast.error(`Failed to get diff: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  },

  /**
   * Discard changes in a repository
   * @param repository Repository to discard changes in
   * @param paths Paths to discard changes for (if empty, discard all changes)
   */
  discardChanges: async (repository: GitRepository, paths?: string[]): Promise<void> => {
    try {
      // Simulate API call to discard changes
      console.log(`Discarding changes in repository: ${repository.name}, paths: ${paths?.join(', ') || 'all'}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success(`Changes discarded successfully`);
    } catch (error) {
      console.error('Error discarding changes:', error);
      toast.error(`Failed to discard changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
};
