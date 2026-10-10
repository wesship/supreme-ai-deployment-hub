
/**
 * Interface for Git repository information
 */
export interface GitRepository {
  id: string;
  name: string;
  url: string;
  branch: string;
  lastSynced?: Date;
  status?: 'synced' | 'modified' | 'conflict';
  accessToken?: string;
}

/**
 * Interface for Git commit information
 */
export interface GitCommit {
  id: string;
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: Date;
  branch?: string;
  tags?: string[];
}

/**
 * Interface for Git branch information
 */
export interface GitBranch {
  name: string;
  isActive: boolean;
  lastCommitHash: string;
  lastCommitDate: Date;
  isRemote: boolean;
  upstream?: string;
  ahead?: number;
  behind?: number;
}

/**
 * Interface for Git diff information
 */
export interface GitDiff {
  filePath: string;
  additions: number;
  deletions: number;
  hunks: Array<{
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    content: string;
  }>;
}

/**
 * Interface for Git stash entry
 */
export interface GitStashEntry {
  id: string;
  message: string;
  date: Date;
  hash: string;
  branch: string;
}

/**
 * Interface for Git tag
 */
export interface GitTag {
  name: string;
  commitHash: string;
  date: Date;
  message?: string;
  taggerName: string;
  taggerEmail: string;
}

/**
 * Helper function to generate random hash
 */
export function generateRandomHash(length: number): string {
  const characters = 'abcdef0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}
