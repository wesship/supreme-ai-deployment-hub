
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DiscardChangesDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  modifiedFiles: string[];
  selectedFiles: string[];
  setSelectedFiles: (files: string[]) => void;
  onDiscardChanges: () => void;
}

export const DiscardChangesDialog = ({
  isOpen,
  onOpenChange,
  modifiedFiles,
  selectedFiles,
  setSelectedFiles,
  onDiscardChanges
}: DiscardChangesDialogProps) => {
  const toggleFileSelection = (file: string) => {
    if (selectedFiles.includes(file)) {
      setSelectedFiles(selectedFiles.filter(f => f !== file));
    } else {
      setSelectedFiles([...selectedFiles, file]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedFiles.length === modifiedFiles.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles([...modifiedFiles]);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Discard Changes</DialogTitle>
          <DialogDescription>
            Select files to discard changes. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        
        <Alert variant="destructive" className="my-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Warning: Discarding changes will permanently delete your modifications.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-4 py-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="selectAll"
              checked={modifiedFiles.length > 0 && selectedFiles.length === modifiedFiles.length}
              onCheckedChange={toggleSelectAll}
            />
            <label htmlFor="selectAll" className="text-sm font-medium">
              Select All Files
            </label>
          </div>
          
          <ScrollArea className="h-[200px] rounded border p-2">
            {modifiedFiles.length > 0 ? (
              <div className="space-y-2">
                {modifiedFiles.map((file) => (
                  <div key={file} className="flex items-center space-x-2">
                    <Checkbox
                      id={file}
                      checked={selectedFiles.includes(file)}
                      onCheckedChange={() => toggleFileSelection(file)}
                    />
                    <label htmlFor={file} className="text-sm">
                      {file}
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-2 text-center text-muted-foreground">
                No modified files found.
              </div>
            )}
          </ScrollArea>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onDiscardChanges}
            disabled={selectedFiles.length === 0}
          >
            Discard Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DiscardChangesDialog;
