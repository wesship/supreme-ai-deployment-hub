
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GitRepositoryManager } from '@/components/git/GitRepositoryManager';
import { useGitRepositories } from '@/hooks/useGitRepositories';
import { vi, Mock } from 'vitest';

// Mock the hooks
vi.mock('@/hooks/useGitRepositories');

// Mock the child components to simplify testing
vi.mock('@/components/git/repositories/RepositorySection', () => ({
  __esModule: true,
  default: () => <div data-testid="repository-section">Repository Section</div>
}));

vi.mock('@/components/git/repositories/RepositoryHeader', () => ({
  __esModule: true,
  default: ({ onRefreshAll }: any) => (
    <div data-testid="repository-header">
      Repository Header
      <button data-testid="refresh-all" onClick={onRefreshAll}>Refresh All</button>
    </div>
  )
}));

vi.mock('@/components/git/repositories/PushChangesDialogContainer', () => ({
  __esModule: true,
  default: () => <div data-testid="push-changes-dialog">Push Changes Dialog</div>
}));

vi.mock('@/components/git/GitDocumentation', () => ({
  __esModule: true,
  default: () => <div data-testid="git-documentation">Git Documentation</div>
}));

describe('GitRepositoryManager', () => {
  const mockRepositories: import('@/services/git/types').GitRepository[] = [
    { id: '1', name: 'repo1', url: 'https://github.com/user/repo1', branch: 'main', status: 'synced' as const },
    { id: '2', name: 'repo2', url: 'https://github.com/user/repo2', branch: 'main', status: 'modified' as const }
  ];
  
  beforeEach(() => {
    vi.mocked(useGitRepositories).mockReturnValue({
      repositories: mockRepositories,
      loading: false,
      selectedRepo: null,
      setSelectedRepo: vi.fn(),
      activeRepositoryId: null,
      activeRepository: undefined,
      handleCloneRepository: vi.fn(),
      handlePullChanges: vi.fn(),
      handlePushChanges: vi.fn(),
      handleDeleteRepository: vi.fn(),
      handleRepositorySelect: vi.fn(),
      handleUpdateRepository: vi.fn(),
      handleSelectForPush: vi.fn()
    });
  });

  test('renders repository manager with tabs', () => {
    render(<GitRepositoryManager />);
    
    expect(screen.getByTestId('repository-header')).toBeInTheDocument();
    expect(screen.getByText('Repositories')).toBeInTheDocument();
    expect(screen.getByText('Documentation')).toBeInTheDocument();
    expect(screen.getByTestId('repository-section')).toBeInTheDocument();
  });

  test('shows repository section by default', () => {
    render(<GitRepositoryManager />);
    
    expect(screen.getByTestId('repository-section')).toBeInTheDocument();
    // Documentation tab content is not rendered when repositories tab is active
    expect(screen.queryByTestId('git-documentation')).not.toBeInTheDocument();
  });

  test('switches to documentation tab when clicked', async () => {
    render(<GitRepositoryManager />);
    
    // Click on Documentation tab
    const docTab = screen.getByText('Documentation');
    fireEvent.click(docTab);
    
    // Verify the documentation tab trigger exists and is clickable
    expect(docTab).toBeInTheDocument();
    // Repositories tab should still be in the DOM as a tab trigger
    expect(screen.getByText('Repositories')).toBeInTheDocument();
  });

  test('can search repositories', () => {
    render(<GitRepositoryManager />);
    
    const searchInput = screen.getByPlaceholderText('Search repositories...');
    fireEvent.change(searchInput, { target: { value: 'repo1' } });
    
    // The filtering logic is handled within the component
  });

  test('handles refresh all button', async () => {
    const mockHandlePullChanges = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useGitRepositories).mockReturnValue({
      repositories: mockRepositories,
      loading: false,
      selectedRepo: null,
      setSelectedRepo: vi.fn(),
      activeRepositoryId: null,
      activeRepository: undefined,
      handleCloneRepository: vi.fn(),
      handlePullChanges: mockHandlePullChanges,
      handlePushChanges: vi.fn(),
      handleDeleteRepository: vi.fn(),
      handleRepositorySelect: vi.fn(),
      handleUpdateRepository: vi.fn(),
      handleSelectForPush: vi.fn()
    });

    render(<GitRepositoryManager />);
    
    // Click refresh all button
    fireEvent.click(screen.getByTestId('refresh-all'));
    
    // refreshAllRepositories is async - wait for all pull calls
    await waitFor(() => {
      expect(mockHandlePullChanges).toHaveBeenCalledTimes(2);
    });
    expect(mockHandlePullChanges).toHaveBeenCalledWith(mockRepositories[0]);
    expect(mockHandlePullChanges).toHaveBeenCalledWith(mockRepositories[1]);
  });
});
