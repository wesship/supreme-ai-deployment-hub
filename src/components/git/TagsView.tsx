
import React from 'react';
import { Button } from '@/components/ui/button';
import { GitTag, GitRepository } from '@/services/git';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tag, Trash2, Plus, Calendar } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface TagsViewProps {
  repository: GitRepository;
  tags: GitTag[];
  loading: boolean;
  onCreateTag: () => void;
  onDeleteTag: (tagName: string) => void;
}

const TagsView: React.FC<TagsViewProps> = ({
  repository,
  tags,
  loading,
  onCreateTag,
  onDeleteTag
}) => {
  const [tagToDelete, setTagToDelete] = React.useState<string | null>(null);

  const handleDeleteTag = (tagName: string) => {
    setTagToDelete(tagName);
  };

  const confirmDeleteTag = () => {
    if (tagToDelete) {
      onDeleteTag(tagToDelete);
      setTagToDelete(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Tags</h3>
        <Button size="sm" onClick={onCreateTag}>
          <Plus className="h-4 w-4 mr-2" />
          Create Tag
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-4">Loading tags...</div>
      ) : tags.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center">
            <Tag className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">
              No tags found. Create a tag to mark an important point in your repository history.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[300px]">
          <div className="space-y-3">
            {tags.map((tag) => (
              <Card key={tag.name}>
                <CardHeader className="py-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-sm font-medium flex items-center">
                        <Tag className="h-4 w-4 mr-2" />
                        {tag.name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        By {tag.taggerName} ({tag.taggerEmail})
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleDeleteTag(tag.name)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pb-2 pt-0">
                  {tag.message && (
                    <p className="text-sm">{tag.message}</p>
                  )}
                  <div className="flex items-center mt-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 mr-1" />
                    {new Date(tag.date).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Commit: {tag.commitHash.substring(0, 7)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      <AlertDialog open={!!tagToDelete} onOpenChange={(open) => !open && setTagToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the tag "{tagToDelete}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTag} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TagsView;
