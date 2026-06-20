import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send, Sparkles, Brain, Mic, Settings } from 'lucide-react';
import LLMSelector from '@/components/llm/LLMSelector';
import VoiceInterface from '@/components/voice/VoiceInterface';
import { LLMConfig, LLMMessage, LLMResponse } from '@/types/llm';
import { UnifiedLLMClient } from '@/services/llm/client';
import { toast } from 'sonner';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';

const EnhancedAgentDemo = () => {
  const [messages, setMessages] = useState<LLMMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [elevenlabsApiKey, setElevenlabsApiKey] = useState('');
  
  const [llmConfig, setLLMConfig] = useState<LLMConfig>({
    provider: 'openai',
    model: 'gpt-4.1-2025-04-14',
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: 'You are a helpful AI assistant with advanced capabilities.',
  });

  const llmClient = new UnifiedLLMClient();

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    if (llmConfig.provider !== 'huggingface' && !llmConfig.apiKey) {
      toast.error('Please provide an API key for the selected provider');
      return;
    }

    const userMessage: LLMMessage = {
      role: 'user',
      content: inputMessage,
    };

    const allMessages = [
      ...(llmConfig.systemPrompt ? [{
        role: 'system' as const,
        content: llmConfig.systemPrompt,
      }] : []),
      ...messages,
      userMessage,
    ];

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setCurrentResponse('');

    try {
      // Stream the response
      await llmClient.streamResponse(
        allMessages,
        llmConfig,
        (chunk) => {
          setCurrentResponse(chunk.content);
          if (chunk.done) {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: chunk.content,
            }]);
            setCurrentResponse('');
            setIsLoading(false);
          }
        }
      );
    } catch (error: any) {
      console.error('Error generating response:', error);
      toast.error(`Error: ${error.message}`);
      setIsLoading(false);
      setCurrentResponse('');
    }
  };

  const handleTestProviders = async () => {
    const testMessage = "Say hello and briefly describe your capabilities.";
    
    for (const provider of ['openai', 'anthropic', 'google']) {
      if (!llmConfig.apiKey && provider !== 'huggingface') continue;
      
      try {
        const config = {
          ...llmConfig,
          provider,
          model: provider === 'openai' ? 'gpt-4.1-mini-2025-04-14' :
                 provider === 'anthropic' ? 'claude-3-5-haiku-20241022' :
                 'gemini-1.5-flash',
        };

        const response = await llmClient.generateResponse([{
          role: 'user',
          content: testMessage,
        }], config);

        toast.success(`${provider} responded successfully`);
        console.log(`${provider} response:`, response.content.slice(0, 100) + '...');
      } catch (error: any) {
        toast.error(`${provider} failed: ${error.message}`);
      }
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setCurrentResponse('');
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <D3vonnPageBanner title="Enhanced Agent Demo" />
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Enhanced AI Agent Platform</h1>
          <p className="text-muted-foreground">
            Multi-provider LLM support with voice capabilities and advanced features
          </p>
        </div>

        <Tabs defaultValue="chat" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="llm-config" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              LLM Config
            </TabsTrigger>
            <TabsTrigger value="voice" className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              Voice
            </TabsTrigger>
            <TabsTrigger value="tools" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Tools
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chat Interface */}
            <div className="lg:col-span-2">
              <Card className="h-[600px] flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      AI Conversation
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{llmConfig.provider}</Badge>
                      <Badge variant="outline">{llmConfig.model}</Badge>
                      <Button variant="outline" size="sm" onClick={clearConversation}>
                        Clear
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1 flex flex-col">
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                    {messages.length === 0 && (
                      <div className="text-center text-muted-foreground py-8">
                        <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Start a conversation with your AI assistant</p>
                      </div>
                    )}
                    
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] p-3 rounded-lg ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        </div>
                      </div>
                    ))}
                    
                    {/* Current streaming response */}
                    {currentResponse && (
                      <div className="flex justify-start">
                        <div className="max-w-[80%] p-3 rounded-lg bg-muted">
                          <p className="whitespace-pre-wrap">{currentResponse}</p>
                          <div className="flex items-center gap-1 mt-2">
                            <div className="w-1 h-1 bg-current rounded-full animate-pulse" />
                            <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                            <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Input */}
                  <div className="flex gap-2">
                    <Textarea
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 min-h-10 resize-none"
                      disabled={isLoading}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <Button 
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || isLoading}
                      size="icon"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    onClick={handleTestProviders}
                    variant="outline" 
                    className="w-full"
                    disabled={isLoading}
                  >
                    Test All Providers
                  </Button>
                  
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Quick Prompts</h4>
                    {[
                      "Explain quantum computing simply",
                      "Write a Python function to sort a list",
                      "What are the latest AI trends?",
                      "Help me plan a weekend trip"
                    ].map((prompt, index) => (
                      <Button
                        key={index}
                        variant="ghost"
                        size="sm"
                        className="w-full text-left justify-start h-auto p-2"
                        onClick={() => setInputMessage(prompt)}
                        disabled={isLoading}
                      >
                        <p className="text-xs truncate">{prompt}</p>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="llm-config">
            <LLMSelector config={llmConfig} onConfigChange={setLLMConfig} />
          </TabsContent>

          <TabsContent value="voice">
            <VoiceInterface 
              apiKey={elevenlabsApiKey}
              onApiKeyChange={setElevenlabsApiKey}
            />
          </TabsContent>

          <TabsContent value="tools">
            <Card>
              <CardHeader>
                <CardTitle>Advanced Tools</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card className="p-4">
                    <h3 className="font-medium mb-2">Memory Systems</h3>
                    <p className="text-sm text-muted-foreground">Persistent conversation memory and context management</p>
                    <Badge className="mt-2">Coming Soon</Badge>
                  </Card>
                  
                  <Card className="p-4">
                    <h3 className="font-medium mb-2">Function Calling</h3>
                    <p className="text-sm text-muted-foreground">Custom tools and API integrations</p>
                    <Badge className="mt-2">Coming Soon</Badge>
                  </Card>
                  
                  <Card className="p-4">
                    <h3 className="font-medium mb-2">Quantization</h3>
                    <p className="text-sm text-muted-foreground">Model optimization for edge deployment</p>
                    <Badge className="mt-2">Coming Soon</Badge>
                  </Card>
                  
                  <Card className="p-4">
                    <h3 className="font-medium mb-2">Multi-modal</h3>
                    <p className="text-sm text-muted-foreground">Image and document processing</p>
                    <Badge className="mt-2">Coming Soon</Badge>
                  </Card>
                  
                  <Card className="p-4">
                    <h3 className="font-medium mb-2">n8n Integration</h3>
                    <p className="text-sm text-muted-foreground">Workflow automation and MCP support</p>
                    <Badge className="mt-2">Coming Soon</Badge>
                  </Card>
                  
                  <Card className="p-4">
                    <h3 className="font-medium mb-2">Agent Marketplace</h3>
                    <p className="text-sm text-muted-foreground">Share and discover AI agents</p>
                    <Badge className="mt-2">Coming Soon</Badge>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default EnhancedAgentDemo;