import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, ShieldCheck, Volume2 } from 'lucide-react';
import ConversationalVoiceControls from '@/components/ai/ConversationalVoiceControls';

interface VoiceInterfaceProps {
  apiKey?: string;
  onApiKeyChange?: (key: string) => void;
}

/**
 * Production voice surface.
 *
 * ElevenLabs credentials remain server-side. The browser receives only the
 * public agent identifier through VITE_ELEVENLABS_AGENT_ID and requests
 * microphone access after an explicit user gesture.
 */
const VoiceInterface: React.FC<VoiceInterfaceProps> = () => {
  const agentConfigured = Boolean(import.meta.env.VITE_ELEVENLABS_AGENT_ID?.trim());

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            D3VONN.IO Voice Assistant
          </CardTitle>
          <Badge variant={agentConfigured ? 'default' : 'secondary'}>
            {agentConfigured ? 'Production agent configured' : 'Browser voice mode'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border bg-muted/40 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-md border bg-background p-2">
              <Mic className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="font-medium">Start a secure voice session</h3>
              <p className="text-sm text-muted-foreground">
                Tap the microphone control, allow microphone access when prompted, and speak naturally.
                Your ElevenLabs API key is never entered or stored in the browser.
              </p>
              <div className="flex items-center gap-3 pt-1">
                <ConversationalVoiceControls />
                <span className="text-sm text-muted-foreground">
                  {agentConfigured ? 'Tap to connect' : 'Configure VITE_ELEVENLABS_AGENT_ID to enable live conversation'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>
            Voice access is limited to D3VONN.IO, begins only after your action, and can be ended from the same control.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default VoiceInterface;
