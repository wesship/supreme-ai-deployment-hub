/**
 * Titans Memory Visualization Panel
 * 
 * Provides a visual interface to inspect and interact with
 * the Titans memory architectures (MAC, MAG, MAL).
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { 
  Brain, 
  Layers, 
  GitBranch, 
  Zap,
  Database,
  RefreshCw,
  Trash2,
  Save,
  Activity,
  BarChart3
} from 'lucide-react';
import { useTitansMemory } from '@/hooks/useTitansMemory';
import { TitansConfig } from '@/lib/titans/types';
import { cn } from '@/lib/utils';

interface TitansMemoryPanelProps {
  agentId?: string;
  defaultArchitecture?: TitansConfig['architecture'];
  showTestInput?: boolean;
}

export const TitansMemoryPanel: React.FC<TitansMemoryPanelProps> = ({
  agentId = 'default',
  defaultArchitecture = 'MAG',
  showTestInput = true,
}) => {
  const [selectedArch, setSelectedArch] = useState<TitansConfig['architecture']>(defaultArchitecture);
  const [testInput, setTestInput] = useState('');

  const {
    architecture,
    memoryState,
    isProcessing,
    lastOutput,
    stats,
    process,
    analyzeGate,
    analyzeLayers,
    getContextString,
    clearMemory,
    forcePersist,
    isMAC,
    isMAG,
    isMAL,
  } = useTitansMemory({
    agentId,
    architecture: selectedArch,
    persistMemory: true,
  });

  const handleTest = async () => {
    if (!testInput.trim()) return;
    await process(testInput);
    setTestInput('');
  };

  const gateAnalysis = isMAG ? analyzeGate(testInput || 'test') : null;
  const layerAnalysis = isMAL ? analyzeLayers() : null;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Titans Memory System</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={forcePersist}>
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
            <Button variant="outline" size="sm" onClick={clearMemory}>
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>
        <CardDescription>
          Neural long-term memory architecture for AI agents
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Architecture Selection */}
        <Tabs value={selectedArch} onValueChange={(v) => setSelectedArch(v as TitansConfig['architecture'])}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="MAC" className="flex items-center gap-1">
              <Database className="h-3 w-3" />
              MAC
            </TabsTrigger>
            <TabsTrigger value="MAG" className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              MAG
            </TabsTrigger>
            <TabsTrigger value="MAL" className="flex items-center gap-1">
              <Layers className="h-3 w-3" />
              MAL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="MAC" className="mt-4">
            <ArchitectureDescription
              title="Memory as Context"
              description="Memory tokens are compressed and prepended to the context window. Best for RAG-style applications."
              icon={<Database className="h-4 w-4" />}
            />
          </TabsContent>

          <TabsContent value="MAG" className="mt-4">
            <ArchitectureDescription
              title="Memory as Gate"
              description="Parallel processing with gating mechanism. Balances short-term attention with long-term patterns."
              icon={<GitBranch className="h-4 w-4" />}
            />
            {gateAnalysis && (
              <div className="mt-3 p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Gate Value</span>
                  <Badge variant={gateAnalysis.gateValue > 0.5 ? 'default' : 'secondary'}>
                    {(gateAnalysis.gateValue * 100).toFixed(1)}%
                  </Badge>
                </div>
                <Progress value={gateAnalysis.gateValue * 100} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {gateAnalysis.interpretation}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="MAL" className="mt-4">
            <ArchitectureDescription
              title="Memory as Layer"
              description="Deep integration with interleaved attention and memory layers. Most powerful for complex reasoning."
              icon={<Layers className="h-4 w-4" />}
            />
            {layerAnalysis && (
              <div className="mt-3 space-y-2">
                {layerAnalysis.layerAnalysis.map((layer, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded">
                    <div className="flex items-center gap-2">
                      {layer.type === 'attention' ? (
                        <Zap className="h-3 w-3 text-yellow-500" />
                      ) : (
                        <Database className="h-3 w-3 text-blue-500" />
                      )}
                      <span className="text-xs">Layer {idx + 1}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {layer.memoryInteraction}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Separator />

        {/* Memory Statistics */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Short-term"
            value={stats.shortTermCount}
            icon={<Activity className="h-4 w-4" />}
            color="text-green-500"
          />
          <StatCard
            label="Long-term"
            value={stats.longTermCount}
            icon={<Database className="h-4 w-4" />}
            color="text-blue-500"
          />
          <StatCard
            label="Processed"
            value={stats.processCount}
            icon={<BarChart3 className="h-4 w-4" />}
            color="text-purple-500"
          />
        </div>

        {/* Memory Contents */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Database className="h-4 w-4" />
            Memory Contents
          </h4>
          <ScrollArea className="h-32 rounded border p-2">
            {memoryState.longTerm.length === 0 && memoryState.shortTerm.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No memories stored yet
              </p>
            ) : (
              <div className="space-y-1">
                {memoryState.longTerm.slice(0, 5).map((memory, idx) => (
                  <div key={memory.id} className="flex items-center justify-between text-xs p-1 hover:bg-muted rounded">
                    <span className="truncate flex-1 mr-2">{memory.content}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {(memory.surprise * 100).toFixed(0)}%
                    </Badge>
                  </div>
                ))}
                {memoryState.longTerm.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{memoryState.longTerm.length - 5} more memories
                  </p>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Test Input */}
        {showTestInput && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Test Memory Processing</h4>
            <div className="flex gap-2">
              <Input
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Enter test input..."
                onKeyDown={(e) => e.key === 'Enter' && handleTest()}
              />
              <Button onClick={handleTest} disabled={isProcessing || !testInput.trim()}>
                {isProcessing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* MAC Context Output */}
        {isMAC && lastOutput && 'compressedMemory' in lastOutput && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Context Output</h4>
            <ScrollArea className="h-24 rounded border p-2">
              <pre className="text-xs whitespace-pre-wrap">
                {getContextString()}
              </pre>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface ArchitectureDescriptionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const ArchitectureDescription: React.FC<ArchitectureDescriptionProps> = ({
  title,
  description,
  icon,
}) => (
  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
    <div className="p-2 bg-primary/10 rounded-md text-primary">
      {icon}
    </div>
    <div>
      <h5 className="text-sm font-medium">{title}</h5>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  </div>
);

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color }) => (
  <div className="p-3 bg-muted/50 rounded-lg text-center">
    <div className={cn('flex justify-center mb-1', color)}>
      {icon}
    </div>
    <p className="text-lg font-bold">{value}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
);

export default TitansMemoryPanel;
