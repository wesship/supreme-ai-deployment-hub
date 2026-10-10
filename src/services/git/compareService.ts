
import { toast } from 'sonner';
import { GitRepository, GitDiff } from './types';

/**
 * Service for handling Git comparison operations
 */
export const compareService = {
  /**
   * Compare two branches
   * @param repository Repository to compare branches in
   * @param sourceBranch Source branch name
   * @param targetBranch Target branch name
   */
  compareBranches: async (repository: GitRepository, sourceBranch: string, targetBranch: string): Promise<GitDiff[]> => {
    try {
      // Simulate API call to compare branches
      console.log(`Comparing branches in repository: ${repository.name}, source: ${sourceBranch}, target: ${targetBranch}`);
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate comparison data
      const diffs: GitDiff[] = [
        {
          filePath: 'src/components/App.tsx',
          additions: 12,
          deletions: 5,
          hunks: [
            {
              oldStart: 5,
              oldLines: 3,
              newStart: 5,
              newLines: 5,
              content: `@@ -5,3 +5,5 @@\n import React from 'react';\n-import { Component } from './Component';\n+import { Component } from './Component';\n+import { NewComponent } from './NewComponent';\n+import { AnotherComponent } from './AnotherComponent';\n`
            },
            {
              oldStart: 15,
              oldLines: 4,
              newStart: 17,
              newLines: 9,
              content: `@@ -15,4 +17,9 @@\n function App() {\n   return (\n     <div>\n-      <Component />\n+      <Component>\n+        <NewComponent title="New Feature" />\n+        {true && (\n+          <AnotherComponent description="Added in feature branch" />\n+        )}\n+      </Component>\n+      <footer>Version 1.1</footer>\n     </div>\n   );\n`
            }
          ]
        },
        {
          filePath: 'src/components/NewComponent.tsx',
          additions: 15,
          deletions: 0,
          hunks: [
            {
              oldStart: 0,
              oldLines: 0,
              newStart: 1,
              newLines: 15,
              content: `@@ -0,0 +1,15 @@\n+import React from 'react';\n+\n+interface NewComponentProps {\n+  title: string;\n+}\n+\n+export const NewComponent: React.FC<NewComponentProps> = ({ title }) => {\n+  return (\n+    <div className="new-component">\n+      <h2>{title}</h2>\n+      <p>This component was added in the feature branch.</p>\n+    </div>\n+  );\n+};\n+`
            }
          ]
        }
      ];
      
      return diffs;
    } catch (error) {
      console.error('Error comparing branches:', error);
      toast.error(`Failed to compare branches: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  },
  
  /**
   * Detect merge conflicts between branches
   * @param repository Repository to check for conflicts
   * @param sourceBranch Source branch name
   * @param targetBranch Target branch name
   */
  detectMergeConflicts: async (repository: GitRepository, sourceBranch: string, targetBranch: string): Promise<{ hasConflicts: boolean; conflictingFiles?: string[] }> => {
    try {
      // Simulate API call to detect merge conflicts
      console.log(`Detecting merge conflicts in repository: ${repository.name}, source: ${sourceBranch}, target: ${targetBranch}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Randomly determine if there are conflicts (for demo purposes)
      const hasConflicts = Math.random() > 0.7;
      
      if (hasConflicts) {
        return {
          hasConflicts: true,
          conflictingFiles: [
            'src/components/App.tsx',
            'src/components/SharedComponent.tsx'
          ]
        };
      } else {
        return {
          hasConflicts: false
        };
      }
    } catch (error) {
      console.error('Error detecting merge conflicts:', error);
      toast.error(`Failed to detect merge conflicts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
};
