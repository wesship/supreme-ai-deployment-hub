
import React from 'react';
import { GitBranch, GitCompareArrows, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitDiff } from '@/services/git';

interface ComparisonViewProps {
  sourceBranch: string;
  targetBranch: string;
  diffs: GitDiff[];
  loading: boolean;
}

const ComparisonView: React.FC<ComparisonViewProps> = ({
  sourceBranch,
  targetBranch,
  diffs,
  loading
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <GitCompareArrows className="h-5 w-5" />
          Branch Comparison
        </CardTitle>
        <div className="flex items-center text-sm mt-2">
          <div className="flex items-center">
            <GitBranch className="h-4 w-4 mr-1 text-blue-500" />
            <span className="font-medium">{sourceBranch}</span>
          </div>
          <span className="mx-2">→</span>
          <div className="flex items-center">
            <GitBranch className="h-4 w-4 mr-1 text-green-500" />
            <span className="font-medium">{targetBranch}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {diffs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No differences found between branches
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {diffs.map((diff, index) => (
                <div key={index} className="border rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-2" />
                      <span className="font-medium">{diff.filePath}</span>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-green-500 border-green-500">
                        +{diff.additions}
                      </Badge>
                      <Badge variant="outline" className="text-red-500 border-red-500">
                        -{diff.deletions}
                      </Badge>
                    </div>
                  </div>
                  <Separator className="my-2" />
                  <pre className="p-2 bg-muted rounded-md overflow-x-auto text-xs">
                    {diff.hunks.map((hunk, hunkIndex) => (
                      <div key={hunkIndex} className="mb-2">
                        <div className="text-muted-foreground mb-1">
                          @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                        </div>
                        {hunk.content.split('\n').map((line, lineIndex) => {
                          let lineClass = '';
                          if (line.startsWith('+')) lineClass = 'text-green-500';
                          else if (line.startsWith('-')) lineClass = 'text-red-500';
                          
                          return (
                            <div key={lineIndex} className={lineClass}>
                              {line}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </pre>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default ComparisonView;
