import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Zap, Brain, Image, MessageSquare } from 'lucide-react';
import { LLMProvider, LLMModel, LLMConfig } from '@/types/llm';
import { LLM_PROVIDERS } from '@/services/llm/providers';

interface LLMSelectorProps {
  config: LLMConfig;
  onConfigChange: (config: LLMConfig) => void;
}

const LLMSelector: React.FC<LLMSelectorProps> = ({ config, onConfigChange }) => {
  const [showApiKey, setShowApiKey] = useState(false);
  
  const selectedProvider = LLM_PROVIDERS.find(p => p.id === config.provider);
  const selectedModel = selectedProvider?.models.find(m => m.id === config.model);

  const handleProviderChange = (providerId: string) => {
    const provider = LLM_PROVIDERS.find(p => p.id === providerId);
    const firstModel = provider?.models[0];
    
    onConfigChange({
      ...config,
      provider: providerId,
      model: firstModel?.id || '',
      apiKey: provider?.requiresApiKey ? config.apiKey : undefined,
    });
  };

  const handleModelChange = (modelId: string) => {
    onConfigChange({
      ...config,
      model: modelId,
    });
  };

  const getFeatureIcon = (feature: string) => {
    switch (feature) {
      case 'vision': return <Eye className="h-3 w-3" />;
      case 'function-calling': return <Zap className="h-3 w-3" />;
      case 'reasoning': return <Brain className="h-3 w-3" />;
      case 'multimodal': return <Image className="h-3 w-3" />;
      default: return <MessageSquare className="h-3 w-3" />;
    }
  };

  const formatCost = (cost: number) => {
    if (cost < 1) return `$${(cost * 1000).toFixed(0)}/1M tokens`;
    return `$${cost.toFixed(2)}/1M tokens`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>LLM Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Provider Selection */}
        <div className="space-y-2">
          <Label htmlFor="provider">Provider</Label>
          <Select value={config.provider} onValueChange={handleProviderChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a provider" />
            </SelectTrigger>
            <SelectContent>
              {LLM_PROVIDERS.map(provider => (
                <SelectItem key={provider.id} value={provider.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{provider.name}</span>
                    {!provider.requiresApiKey && (
                      <Badge variant="secondary" className="ml-2">Free</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedProvider && (
            <p className="text-sm text-muted-foreground">
              {selectedProvider.description}
            </p>
          )}
        </div>

        {/* API Key */}
        {selectedProvider?.requiresApiKey && (
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? 'text' : 'password'}
                value={config.apiKey || ''}
                onChange={(e) => onConfigChange({ ...config, apiKey: e.target.value })}
                placeholder="Enter your API key"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* Model Selection */}
        {selectedProvider && (
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Select value={config.model} onValueChange={handleModelChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {selectedProvider.models.map(model => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex flex-col items-start">
                      <div className="flex items-center gap-2">
                        <span>{model.name}</span>
                        <div className="flex gap-1">
                          {model.features.slice(0, 3).map(feature => (
                            <div key={feature} className="text-muted-foreground">
                              {getFeatureIcon(feature)}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground flex gap-2">
                        {model.inputCostPer1M && (
                          <span>Input: {formatCost(model.inputCostPer1M)}</span>
                        )}
                        {model.outputCostPer1M && (
                          <span>Output: {formatCost(model.outputCostPer1M)}</span>
                        )}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedModel && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {selectedModel.description}
                </p>
                <div className="flex flex-wrap gap-1">
                  {selectedModel.features.map(feature => (
                    <Badge key={feature} variant="outline" className="text-xs">
                      {getFeatureIcon(feature)}
                      <span className="ml-1">{feature.replace('-', ' ')}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Advanced Settings */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Advanced Settings</h4>
          
          <div className="space-y-2">
            <Label htmlFor="temperature">Temperature: {config.temperature || 0.7}</Label>
            <Slider
              id="temperature"
              min={0}
              max={2}
              step={0.1}
              value={[config.temperature || 0.7]}
              onValueChange={([value]) => onConfigChange({ ...config, temperature: value })}
            />
            <p className="text-xs text-muted-foreground">
              Controls randomness: 0 = deterministic, 2 = very creative
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxTokens">Max Tokens</Label>
            <Input
              id="maxTokens"
              type="number"
              value={config.maxTokens || 4096}
              onChange={(e) => onConfigChange({ ...config, maxTokens: parseInt(e.target.value) })}
              min={1}
              max={selectedModel?.maxTokens || 32000}
            />
            <p className="text-xs text-muted-foreground">
              Maximum tokens to generate (max: {selectedModel?.maxTokens?.toLocaleString() || 'N/A'})
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="systemPrompt">System Prompt</Label>
            <textarea
              id="systemPrompt"
              value={config.systemPrompt || ''}
              onChange={(e) => onConfigChange({ ...config, systemPrompt: e.target.value })}
              placeholder="You are a helpful AI assistant..."
              className="w-full p-2 border rounded-md min-h-20 text-sm"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LLMSelector;