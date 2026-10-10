
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

const SpeechControl: React.FC = () => {
  const [pitchValue, setPitchValue] = useState([1]);
  const [rateValue, setRateValue] = useState([1]);
  
  const {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: recognitionSupported,
    error: recognitionError
  } = useSpeechRecognition({
    onError: (error) => toast.error(`Speech recognition error: ${error}`)
  });

  const {
    speak,
    cancel,
    isSpeaking,
    voices,
    setVoice,
    setRate,
    setPitch,
    isSupported: synthesisSupported
  } = useSpeechSynthesis();

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleToggleSpeaking = () => {
    if (isSpeaking) {
      cancel();
    } else {
      // Example text
      speak("Deployment system ready. All systems operational. Awaiting your voice commands.");
    }
  };

  const handleRateChange = (value: number[]) => {
    setRateValue(value);
    setRate(value[0]);
  };

  const handlePitchChange = (value: number[]) => {
    setPitchValue(value);
    setPitch(value[0]);
  };

  const handleVoiceChange = (value: string) => {
    setVoice(value);
  };

  const handleTestVoice = () => {
    speak("This is a test of the deployment voice interface. You can use voice commands to control deployments.");
  };

  // Show friendly message if speech recognition is not supported
  if (!recognitionSupported || !synthesisSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Voice Control</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <VolumeX className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Speech recognition is not supported in this browser.
              Try using Chrome or Edge for voice control features.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex justify-between items-center">
          <span>Voice Interface</span>
          {recognitionSupported && synthesisSupported && (
            <Badge variant="outline" className="bg-green-600/10 text-green-600 border-green-600">
              Available
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant={isListening ? "destructive" : "default"}
              onClick={handleToggleListening}
              className="mr-2"
            >
              {isListening ? (
                <>
                  <MicOff className="mr-2 h-4 w-4" />
                  Stop Listening
                </>
              ) : (
                <>
                  <Mic className="mr-2 h-4 w-4" />
                  Start Listening
                </>
              )}
            </Button>
            
            <Button
              variant={isSpeaking ? "destructive" : "outline"}
              onClick={handleToggleSpeaking}
            >
              {isSpeaking ? (
                <>
                  <VolumeX className="mr-2 h-4 w-4" />
                  Stop Speaking
                </>
              ) : (
                <>
                  <Volume2 className="mr-2 h-4 w-4" />
                  Test Voice
                </>
              )}
            </Button>
          </div>
        </div>

        {isListening && (
          <div className="bg-secondary/30 p-3 rounded-md">
            <p className="text-sm font-medium mb-1">Transcript:</p>
            <p className="text-sm">{transcript || "Say something..."}</p>
            {interimTranscript && (
              <p className="text-xs text-muted-foreground italic">{interimTranscript}</p>
            )}
          </div>
        )}

        <div className="space-y-3 pt-2 border-t">
          <div>
            <label className="text-sm font-medium mb-1 block">Voice</label>
            <Select onValueChange={handleVoiceChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select voice" />
              </SelectTrigger>
              <SelectContent>
                {voices.map((voice) => (
                  <SelectItem key={voice.name} value={voice.name}>
                    {voice.name} ({voice.lang})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Rate: {rateValue[0]}</label>
            <Slider
              value={rateValue}
              onValueChange={handleRateChange}
              min={0.5}
              max={2}
              step={0.1}
              className="py-4"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Pitch: {pitchValue[0]}</label>
            <Slider
              value={pitchValue}
              onValueChange={handlePitchChange}
              min={0.5}
              max={2}
              step={0.1}
              className="py-4"
            />
          </div>
          
          <Button variant="secondary" className="w-full" onClick={handleTestVoice}>
            <Volume2 className="mr-2 h-4 w-4" />
            Test Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SpeechControl;
