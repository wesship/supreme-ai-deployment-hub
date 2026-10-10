import { v4 as uuidv4 } from 'uuid';
import { GitRepository } from '../services/git';

// Define the storage key
const GIT_REPOS_STORAGE_KEY = 'devonn_git_repositories';

/**
 * Get all stored repositories
 */
export const getRepositories = async (): Promise<GitRepository[]> => {
  return new Promise((resolve) => {
    chrome.storage.local.get([GIT_REPOS_STORAGE_KEY], (result) => {
      resolve(result[GIT_REPOS_STORAGE_KEY] || []);
    });
  });
};

/**
 * Save a repository
 */
export const saveRepository = async (repository: GitRepository): Promise<void> => {
  // First get existing repositories
  const repositories = await getRepositories();
  
  // Check if repository already exists
  const existingIndex = repositories.findIndex(repo => repo.id === repository.id);
  
  if (existingIndex >= 0) {
    // Update existing repository
    repositories[existingIndex] = repository;
  } else {
    // Add new repository
    if (!repository.id) {
      repository.id = uuidv4();
    }
    repositories.push(repository);
  }
  
  // Save back to storage
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [GIT_REPOS_STORAGE_KEY]: repositories }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
};

/**
 * Delete a repository
 */
export const deleteRepository = async (repositoryId: string): Promise<void> => {
  // First get existing repositories
  const repositories = await getRepositories();
  
  // Filter out the repository to delete
  const updatedRepositories = repositories.filter(repo => repo.id !== repositoryId);
  
  // Save back to storage
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [GIT_REPOS_STORAGE_KEY]: updatedRepositories }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
};
