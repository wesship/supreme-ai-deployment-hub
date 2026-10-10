import React, { useState } from 'react';
import PushChangesDialog from '../PushChangesDialog';
import { GitRepository } from '@/services/git';

interface PushChangesDialogContainerProps {
  selectedRepo: GitRepository | null;
  loading: boolean;
  onPushChanges: (repo: GitRepository, message: string) => Promise<boolean>;
  onClose: () => void;
  isOpen: boolean;
}

function isGitHubRepositoryUrl(repositoryUrl: string): boolean {
  try {
    const parsed = new URL(repositoryUrl);
    return parsed.hostname.toLowerCase() === 'github.com';
  } catch {
    const separator = repositoryUrl.indexOf(':');
    return separator > 0 && repositoryUrl.slice(0, separator).toLowerCase() === 'git@github.com';
  }
}

const PushChangesDialogContainer: React.FC<PushChangesDialogContainerProps> = ({
  selectedRepo,
  loading,
  onPushChanges,
  onClose,
  isOpen
}) => {
  const [commitMessage, setCommitMessage] = useState('');

  const handlePushChanges = async () => {
    if (!selectedRepo) return;

    const isGitHub = isGitHubRepositoryUrl(selectedRepo.url);
    console.log(`Preparing to push to ${isGitHub ? 'GitHub' : 'Git'} repository: ${selectedRepo.name}`);

    const success = await onPushChanges(selectedRepo, commitMessage);
    if (success) {
      setCommitMessage('');
      onClose();
      console.log(`Successfully pushed changes to ${isGitHub ? 'GitHub' : 'Git'} repository: ${selectedRepo.name}`);
    }
  };

  return (
    <PushChangesDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      selectedRepo={selectedRepo}
      loading={loading}
      commitMessage={commitMessage}
      setCommitMessage={setCommitMessage}
      onPushChanges={handlePushChanges}
    />
  );
};

export default PushChangesDialogContainer;
