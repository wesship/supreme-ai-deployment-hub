
import React, { useState, useEffect } from 'react';
import AddRepositoryDialog from '../AddRepositoryDialog';

interface AddRepositoryDialogContainerProps {
  loading: boolean;
  onCloneRepository: (url: string, branch: string, token: string) => Promise<boolean>;
  onOpenAddDialog?: () => void;
}

const AddRepositoryDialogContainer: React.FC<AddRepositoryDialogContainerProps> = ({ 
  loading, 
  onCloneRepository,
  onOpenAddDialog
}) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newRepoUrl, setNewRepoUrl] = useState('');
  const [newRepoBranch, setNewRepoBranch] = useState('main');
  const [newRepoToken, setNewRepoToken] = useState('');

  // If onOpenAddDialog is provided, use it to control dialog open state
  useEffect(() => {
    if (onOpenAddDialog) {
      const handleOpen = () => setIsAddDialogOpen(true);
      // This is a simple event emitter pattern
      window.addEventListener('openAddRepoDialog', handleOpen);
      return () => window.removeEventListener('openAddRepoDialog', handleOpen);
    }
  }, [onOpenAddDialog]);

  const handleCloneRepository = async () => {
    const success = await onCloneRepository(newRepoUrl, newRepoBranch, newRepoToken);
    if (success) {
      setNewRepoUrl('');
      setNewRepoBranch('main');
      setNewRepoToken('');
      setIsAddDialogOpen(false);
    }
  };

  return (
    <AddRepositoryDialog
      isOpen={isAddDialogOpen}
      onOpenChange={setIsAddDialogOpen}
      loading={loading}
      newRepoUrl={newRepoUrl}
      setNewRepoUrl={setNewRepoUrl}
      newRepoBranch={newRepoBranch}
      setNewRepoBranch={setNewRepoBranch}
      newRepoToken={newRepoToken}
      setNewRepoToken={setNewRepoToken}
      onCloneRepository={handleCloneRepository}
    />
  );
};

export default AddRepositoryDialogContainer;
