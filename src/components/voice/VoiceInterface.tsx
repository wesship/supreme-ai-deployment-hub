import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, PhoneCall, ShieldCheck, Volume2 } from 'lucide-react';
import ConversationalVoiceControls from '@/components/ai/ConversationalVoiceControls';
import { getVapiAssistantId, getVapiPublicKey } from '@/config/voice';

interface VoiceInterfaceProps {
  apiKey?: string;
  onApiKeyChange?: (key: string) => void;
}

/**
 * Production voice surface.
 *
 * Vapi is the preferred browser/PSTN orchestration layer. ElevenLabs remains
 * the direct browser fallback and can also be selected as Vapi's voice engine.
 * Provider private keys remain server-side.
 */
const VoiceInterface: React.FC<VoiceInterfaceProps> = () => {
  const vapiAssistantId = getVapiAssistantId();
  const vapiConfigured = Boolean(getVapiPublicKey() && vapiAssistantId);
  const elevenLabsConfigured = Boolean(import.meta.env.VITE_ELEVENLABS_AGENT_ID?.trim());
  const provider = vapiConfigured ? 'Vapi + ElevenLabs' : elevenLabsConfigured ? 'ElevenLabs' : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            D3VONN.IO Voice Assistant
          </CardTitle>
          <Badge variant={provider ? 'default' : 'secondary'}>
            {provider ? `${provider} configured` : 'Voice configuration required'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border bg-muted/40 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-md border bg-background p-2">
              {vapiConfigured ? <PhoneCall className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="font-medium">Start a secure D3VONN voice session</h3>
              <p className="text-sm text-muted-foreground">
                Tap the control, allow microphone access, and speak naturally. Vapi manages the
                browser or phone conversation, ElevenLabs supplies the production voice, and Hermes
                remains the D3VONN reasoning and tool-execution layer.
              </p>
              <div className="flex items-center gap-3 pt-1">
                <ConversationalVoiceControls />
                <span className="text-sm text-muted-foreground">
                  {vapiConfigured
                    ? 'Tap to start the published D3VONN Vapi assistant'
                    : elevenLabsConfigured
                      ? 'Vapi public access is not configured; ElevenLabs fallback is active'
                      : 'Voice configuration is unavailable'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>
            The browser receives only publishable configuration. Vapi and ElevenLabs private keys,
            webhook credentials, call tools, and Hermes authorization remain on trusted server-side
            infrastructure.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default VoiceInterface;
