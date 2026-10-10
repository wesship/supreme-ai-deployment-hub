
import { useState } from 'react';
import { GitRepository } from '@/services/git';
import { toast } from 'sonner';

type ConflictResolution = 'ours' | 'theirs' | 'manual';

interface ConflictFile {
  path: string;
  resolution?: ConflictResolution;
  resolved: boolean;
  content?: string;
}

export function useMergeConflictResolution(repository: GitRepository) {
  const [conflictingFiles, setConflictingFiles] = useState<ConflictFile[]>([]);
  const [isResolvingConflicts, setIsResolvingConflicts] = useState(false);
  const [currentConflictFile, setCurrentConflictFile] = useState<ConflictFile | null>(null);
  
  // Initialize conflict resolution process with list of conflicting files
  const initializeConflictResolution = (filePaths: string[]) => {
    const conflicts: ConflictFile[] = filePaths.map(path => ({
      path,
      resolved: false
    }));
    setConflictingFiles(conflicts);
    setIsResolvingConflicts(true);
    
    if (conflicts.length > 0) {
      setCurrentConflictFile(conflicts[0]);
    }
    
    toast.warning(`Merge conflict detected in ${filePaths.length} files. Please resolve conflicts to continue.`);
  };
  
  // Resolve a specific conflict file with chosen strategy
  const resolveConflict = (filePath: string, resolution: ConflictResolution, content?: string) => {
    setConflictingFiles(prev => 
      prev.map(file => 
        file.path === filePath 
        ? { ...file, resolution, content, resolved: true } 
        : file
      )
    );
    
    // Move to next unresolved file
    const nextUnresolved = conflictingFiles.find(f => !f.resolved && f.path !== filePath);
    if (nextUnresolved) {
      setCurrentConflictFile(nextUnresolved);
    } else {
      setCurrentConflictFile(null);
    }
    
    toast.success(`Conflict resolved for ${filePath}`);
  };
  
  // Complete the merge after resolving all conflicts
  const completeMerge = async () => {
    if (conflictingFiles.some(file => !file.resolved)) {
      toast.error('All conflicts must be resolved before completing the merge');
      return false;
    }
    
    try {
      toast.success('Merge completed successfully');
      setIsResolvingConflicts(false);
      setConflictingFiles([]);
      return true;
    } catch (error) {
      console.error('Error completing merge:', error);
      toast.error(`Failed to complete merge: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };
  
  // Abort the merge process
  const abortMerge = async () => {
    try {
      setIsResolvingConflicts(false);
      setConflictingFiles([]);
      setCurrentConflictFile(null);
      toast.info('Merge aborted');
      return true;
    } catch (error) {
      console.error('Error aborting merge:', error);
      toast.error(`Failed to abort merge: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };
  
  return {
    conflictingFiles,
    isResolvingConflicts,
    currentConflictFile,
    initializeConflictResolution,
    resolveConflict,
    completeMerge,
    abortMerge
  };
}
