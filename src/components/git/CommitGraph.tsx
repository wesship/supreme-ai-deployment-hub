import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GitCommit, GitBranch as Branch } from '@/services/git';

interface CommitGraphProps {
  commits: GitCommit[];
  branches: Branch[];
  onCommitSelect: (commit: GitCommit) => void;
  selectedCommitHash?: string;
}

const CommitGraph: React.FC<CommitGraphProps> = ({ 
  commits, 
  branches, 
  onCommitSelect,
  selectedCommitHash 
}) => {
  // Get unique branch names for coloring
  const branchColors: Record<string, string> = {};
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 
    'bg-amber-500', 'bg-pink-500', 'bg-cyan-500'
  ];
  
  branches.forEach((branch, index) => {
    branchColors[branch.name] = colors[index % colors.length];
  });
  
  return (
    <div className="border rounded-md p-2 bg-background mb-4">
      <ScrollArea className="h-[300px] w-full">
        <div className="min-w-[800px] relative p-2">
          {/* Vertical timeline */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border"></div>
          
          {/* Branches visualization */}
          <div className="relative z-10">
            {commits.map((commit, index) => {
              const branchName = commit.branch || 'main';
              const colorClass = branchColors[branchName] || 'bg-gray-500';
              const isSelected = commit.hash === selectedCommitHash;
              
              return (
                <div 
                  key={commit.id} 
                  className="flex items-center mb-6 cursor-pointer"
                  onClick={() => onCommitSelect(commit)}
                >
                  <div className={`relative z-20 ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
                    <div className={`h-4 w-4 rounded-full ${colorClass}`}></div>
                  </div>
                  
                  <div className="ml-6">
                    <div className="flex items-center">
                      <span className="font-mono text-sm font-medium">{commit.shortHash}</span>
                      <span className="mx-2 text-muted-foreground">-</span>
                      <span className="font-medium">{commit.message}</span>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3">
                      <span>{commit.author}</span>
                      <span>{new Date(commit.date).toLocaleDateString()}</span>
                      {commit.branch && (
                        <span className={`px-2 py-0.5 rounded-full text-white ${colorClass}`}>
                          {commit.branch}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Branch lines */}
                  {index < commits.length - 1 && branches.length > 1 && (
                    <div className="absolute left-6 w-10 h-6 border-l-2 border-b-2 border-border rounded-bl-lg" style={{ top: `${index * 24 + 12}px` }}></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default CommitGraph;
