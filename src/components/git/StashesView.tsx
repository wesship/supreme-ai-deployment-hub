
import React from 'react';
import { Button } from '@/components/ui/button';
import { GitStashEntry, GitRepository } from '@/services/git';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Archive, Trash2, ArrowDownToLine, Plus } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface StashesViewProps {
  repository: GitRepository;
  stashes: GitStashEntry[];
  loading: boolean;
  onCreateStash: () => void;
  onApplyStash: (stashId: string, drop: boolean) => void;
  onDropStash: (stashId: string) => void;
}

const StashesView: React.FC<StashesViewProps> = ({
  repository,
  stashes,
  loading,
  onCreateStash,
  onApplyStash,
  onDropStash
}) => {
  const [stashToDelete, setStashToDelete] = React.useState<string | null>(null);

  const handleDropStash = (stashId: string) => {
    setStashToDelete(stashId);
  };

  const confirmDropStash = () => {
    if (stashToDelete) {
      onDropStash(stashToDelete);
      setStashToDelete(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Stashes</h3>
        <Button size="sm" onClick={onCreateStash}>
          <Plus className="h-4 w-4 mr-2" />
          Create Stash
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-4">Loading stashes...</div>
      ) : stashes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center">
            <Archive className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">
              No stashes found. Create a stash to save your changes temporarily.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[300px]">
          <div className="space-y-3">
            {stashes.map((stash) => (
              <Card key={stash.id}>
                <CardHeader className="py-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-medium">{stash.message}</h4>
                      <p className="text-xs text-muted-foreground">
                        Created on {new Date(stash.date).toLocaleDateString()} in branch {stash.branch}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleDropStash(stash.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardFooter className="pt-0 pb-3">
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => onApplyStash(stash.id, false)}
                    >
                      <ArrowDownToLine className="h-3 w-3 mr-1" />
                      Apply
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => onApplyStash(stash.id, true)}
                    >
                      Apply & Drop
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      <AlertDialog open={!!stashToDelete} onOpenChange={(open) => !open && setStashToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stash</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this stash? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDropStash} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StashesView;
