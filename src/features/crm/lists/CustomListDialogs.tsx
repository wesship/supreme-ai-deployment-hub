import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CrmCustomList } from "./model";

interface CustomListEditorDialogProps {
  open: boolean;
  list: CrmCustomList | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { displayName: string; description: string }) => void;
}

export function CustomListEditorDialog({
  open,
  list,
  onOpenChange,
  onSubmit,
}: CustomListEditorDialogProps) {
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setDisplayName(list?.displayName ?? "");
    setDescription(list?.description ?? "");
  }, [list, open]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = displayName.trim();
    if (!normalizedName) return;
    onSubmit({ displayName: normalizedName, description: description.trim() });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{list ? "Edit custom list" : "Create custom list"}</DialogTitle>
            <DialogDescription>
              {list
                ? "Update the display name or description for this workspace list."
                : "Create a workspace-scoped list for follow-up, service, campaigns, or training."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="custom-list-name">Display name</Label>
            <Input
              id="custom-list-name"
              autoFocus
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={120}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-list-description">Description</Label>
            <Textarea
              id="custom-list-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!displayName.trim()}>
              {list ? "Save changes" : "Create list"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ArchiveCustomListDialogProps {
  list: CrmCustomList | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function ArchiveCustomListDialog({
  list,
  onOpenChange,
  onConfirm,
}: ArchiveCustomListDialogProps) {
  return (
    <AlertDialog open={Boolean(list)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive custom list?</AlertDialogTitle>
          <AlertDialogDescription>
            {list
              ? `“${list.displayName}” will be removed from active views. Contact records will not be deleted.`
              : "This list will be removed from active views."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Archive list
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
