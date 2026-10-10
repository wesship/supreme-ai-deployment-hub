import React from 'react';
import { FileCode, Plus, Minus, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { GitDiff, GitCommit } from '@/services/git';

interface DiffViewProps {
  commit?: GitCommit;
  diffs: GitDiff[];
  loading: boolean;
}

export const DiffView = ({ commit, diffs, loading }: DiffViewProps) => {
  return (
    <Card className="w-full shadow-md">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              {commit 
                ? `Changes in commit ${commit.shortHash}`
                : 'File Changes'}
            </CardTitle>
            {commit && (
              <CardDescription>
                {commit.message}
              </CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 pt-2">
        <ScrollArea className="h-[500px] rounded-md">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">
              Loading diff data...
            </div>
          ) : diffs.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No changes found
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {diffs.map((diff, index) => (
                <FileDiff key={index} diff={diff} />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

interface FileDiffProps {
  diff: GitDiff;
}

const FileDiff = ({ diff }: FileDiffProps) => {
  return (
    <div className="border rounded-md overflow-hidden">
      <div className="bg-muted p-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{diff.filePath}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1 text-green-600">
            <Plus className="h-3.5 w-3.5" />
            <span>{diff.additions}</span>
          </div>
          <div className="flex items-center gap-1 text-red-600">
            <Minus className="h-3.5 w-3.5" />
            <span>{diff.deletions}</span>
          </div>
        </div>
      </div>
      <div className="font-mono text-sm overflow-x-auto bg-code-bg">
        {diff.hunks.map((hunk, hunkIndex) => (
          <div key={hunkIndex} className="border-t first:border-t-0">
            <div className="bg-muted/70 px-4 py-1 text-xs text-muted-foreground">
              {`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`}
            </div>
            <div>
              {formatDiffContent(hunk.content).map((line, lineIndex) => (
                <div 
                  key={lineIndex} 
                  className={`px-4 py-0.5 whitespace-pre ${
                    line.startsWith('+') 
                      ? 'bg-green-50 text-green-900' 
                      : line.startsWith('-') 
                      ? 'bg-red-50 text-red-900' 
                      : ''
                  }`}
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper function to format diff content into lines
const formatDiffContent = (content: string): string[] => {
  // Skip the first line which is the hunk header
  const lines = content.split('\n');
  if (lines[0].startsWith('@@')) {
    return lines.slice(1);
  }
  return lines;
};

export default DiffView;
