import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Mic, MicOff, Volume2, VolumeX, Play, Pause } from 'lucide-react';
// @ts-ignore - optional dependency
import { useConversation } from '@11labs/react';

interface VoiceInterfaceProps {
  apiKey?: string;
  onApiKeyChange: (key: string) => void;
}

const ELEVEN_LABS_VOICES = [
  { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George' },
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum' },
  { id: 'SAz9YHcvj6GT2YYXdXww', name: 'River' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte' },
];

const ELEVEN_LABS_MODELS = [
  { id: 'eleven_multilingual_v2', name: 'Multilingual v2', description: 'Life-like, emotionally rich in 29 languages' },
  { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5', description: 'High quality, low latency in 32 languages' },
  { id: 'eleven_turbo_v2', name: 'Turbo v2', description: 'English-only, low latency' },
];

const VoiceInterface: React.FC<VoiceInterfaceProps> = ({ apiKey, onApiKeyChange }) => {
  const [selectedVoice, setSelectedVoice] = useState('9BWtsMINqrJLrRacOk9x');
  const [selectedModel, setSelectedModel] = useState('eleven_multilingual_v2');
  const [volume, setVolume] = useState(0.8);
  const [isEnabled, setIsEnabled] = useState(false);
  
  const conversation = useConversation({
    onConnect: () => console.log('Voice conversation connected'),
    onDisconnect: () => console.log('Voice conversation disconnected'),
    onMessage: (message) => console.log('Voice message:', message),
    onError: (error) => console.error('Voice error:', error),
    overrides: {
      agent: {
        prompt: {
          prompt: "You are a helpful AI assistant with voice capabilities. Keep responses concise and conversational.",
        },
        language: "en",
      },
      tts: {
        voiceId: selectedVoice,
      },
    },
  });

  const { status, isSpeaking } = conversation;

  const handleStartConversation = async () => {
    if (!apiKey) {
      alert('Please enter your ElevenLabs API key first');
      return;
    }

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Generate signed URL (in a real app, this would be done on your server)
      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=YOUR_AGENT_ID`,
        {
          headers: {
            'xi-api-key': apiKey,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to get signed URL');
      }
      
      const { signed_url } = await response.json();
      await conversation.startSession({ agentId: 'demo-agent' }); // Use agentId for demo
      setIsEnabled(true);
    } catch (error) {
      console.error('Error starting voice conversation:', error);
      alert('Failed to start voice conversation. Please check your API key and try again.');
    }
  };

  const handleEndConversation = async () => {
    await conversation.endSession();
    setIsEnabled(false);
  };

  const handleVolumeChange = async (newVolume: number) => {
    setVolume(newVolume);
    if (status === 'connected') {
      await conversation.setVolume({ volume: newVolume });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="h-5 w-5" />
          Voice Interface (ElevenLabs)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* API Key */}
        <div className="space-y-2">
          <Label htmlFor="elevenlabs-key">ElevenLabs API Key</Label>
          <Input
            id="elevenlabs-key"
            type="password"
            value={apiKey || ''}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="Enter your ElevenLabs API key"
          />
          <p className="text-xs text-muted-foreground">
            Get your API key from{' '}
            <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="underline">
              elevenlabs.io
            </a>
          </p>
        </div>

        {/* Voice Selection */}
        <div className="space-y-2">
          <Label htmlFor="voice">Voice</Label>
          <Select value={selectedVoice} onValueChange={setSelectedVoice}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ELEVEN_LABS_VOICES.map(voice => (
                <SelectItem key={voice.id} value={voice.id}>
                  {voice.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Model Selection */}
        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ELEVEN_LABS_MODELS.map(model => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex flex-col">
                    <span>{model.name}</span>
                    <span className="text-xs text-muted-foreground">{model.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Volume Control */}
        <div className="space-y-2">
          <Label htmlFor="volume">Volume: {Math.round(volume * 100)}%</Label>
          <Slider
            id="volume"
            min={0}
            max={1}
            step={0.1}
            value={[volume]}
            onValueChange={([value]) => handleVolumeChange(value)}
          />
        </div>

        {/* Conversation Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status:</span>
            <span className={`text-sm ${status === 'connected' ? 'text-green-600' : 'text-gray-500'}`}>
              {status === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {isSpeaking && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <Volume2 className="h-4 w-4" />
              AI is speaking...
            </div>
          )}

          <div className="flex gap-2">
            {!isEnabled ? (
              <Button 
                onClick={handleStartConversation} 
                disabled={!apiKey}
                className="flex-1"
              >
                <Mic className="h-4 w-4 mr-2" />
                Start Voice Conversation
              </Button>
            ) : (
              <Button 
                onClick={handleEndConversation}
                variant="destructive"
                className="flex-1"
              >
                <MicOff className="h-4 w-4 mr-2" />
                End Conversation
              </Button>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-muted p-3 rounded-md">
          <h4 className="text-sm font-medium mb-2">Instructions:</h4>
          <ol className="text-xs text-muted-foreground space-y-1">
            <li>1. Enter your ElevenLabs API key</li>
            <li>2. Select your preferred voice and model</li>
            <li>3. Click "Start Voice Conversation"</li>
            <li>4. Grant microphone permission when prompted</li>
            <li>5. Speak naturally - the AI will respond with voice</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};

export default VoiceInterface;