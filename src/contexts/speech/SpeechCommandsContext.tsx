
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import { useDeployment } from '@/contexts/DeploymentContext';
import { toast } from 'sonner';

interface SpeechCommandsContextType {
  isEnabled: boolean;
  enableVoiceCommands: () => void;
  disableVoiceCommands: () => void;
  isListening: boolean;
  isSpeaking: boolean;
  startListening: () => void;
  stopListening: () => void;
  lastCommand: string | null;
  voiceCommandResult: string | null;
  speakResponse: (text: string) => void;
}

const SpeechCommandsContext = createContext<SpeechCommandsContextType | undefined>(undefined);

// Commands that can be recognized
const DEPLOYMENT_COMMANDS = {
  START: ['start deployment', 'deploy application', 'launch deployment', 'begin deploy'],
  STOP: ['stop deployment', 'cancel deployment', 'abort deployment', 'halt deployment'],
  CONNECT: ['connect to cluster', 'establish connection', 'connect kubernetes'],
  DISCONNECT: ['disconnect from cluster', 'close connection'],
  SHOW_LOGS: ['show logs', 'display logs', 'view logs', 'open logs'],
  CLEAR_LOGS: ['clear logs', 'delete logs', 'clean logs'],
};

export const SpeechCommandsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [voiceCommandResult, setVoiceCommandResult] = useState<string | null>(null);

  const { 
    isDeploying, startDeployment, cancelDeployment, 
    isConnected, connectToCluster, disconnectFromCluster,
    clearLogs
  } = useDeployment();

  const { speak, cancel, isSpeaking } = useSpeechSynthesis({
    rate: 1.0,
    pitch: 1.0
  });

  // Handle recognized speech
  const handleSpeechResult = (text: string) => {
    const lowerText = text.toLowerCase().trim();
    setLastCommand(lowerText);
    
    // Check against available commands
    let commandFound = false;
    
    // Start deployment
    if (DEPLOYMENT_COMMANDS.START.some(cmd => lowerText.includes(cmd))) {
      commandFound = true;
      if (isDeploying) {
        speakResponse("Deployment is already in progress.");
      } else if (!isConnected) {
        speakResponse("Please connect to a Kubernetes cluster before starting a deployment.");
      } else {
        speakResponse("Starting deployment process.");
        startDeployment();
      }
    }
    
    // Stop deployment
    else if (DEPLOYMENT_COMMANDS.STOP.some(cmd => lowerText.includes(cmd))) {
      commandFound = true;
      if (!isDeploying) {
        speakResponse("No deployment is currently running.");
      } else {
        speakResponse("Cancelling the current deployment.");
        cancelDeployment();
      }
    }
    
    // Connect to cluster
    else if (DEPLOYMENT_COMMANDS.CONNECT.some(cmd => lowerText.includes(cmd))) {
      commandFound = true;
      if (isConnected) {
        speakResponse("Already connected to a Kubernetes cluster.");
      } else {
        speakResponse("Attempting to connect to Kubernetes cluster.");
        connectToCluster();
      }
    }
    
    // Disconnect from cluster
    else if (DEPLOYMENT_COMMANDS.DISCONNECT.some(cmd => lowerText.includes(cmd))) {
      commandFound = true;
      if (!isConnected) {
        speakResponse("Not currently connected to any cluster.");
      } else {
        speakResponse("Disconnecting from Kubernetes cluster.");
        disconnectFromCluster();
      }
    }
    
    // Clear logs
    else if (DEPLOYMENT_COMMANDS.CLEAR_LOGS.some(cmd => lowerText.includes(cmd))) {
      commandFound = true;
      speakResponse("Clearing deployment logs.");
      clearLogs();
    }
    
    // No command recognized
    if (!commandFound) {
      setVoiceCommandResult(`Command not recognized: "${text}"`);
    }
  };
  
  const {
    isListening,
    startListening: startSpeechRecognition,
    stopListening: stopSpeechRecognition,
  } = useSpeechRecognition({
    onResult: handleSpeechResult,
    onError: (error) => {
      toast.error(`Speech recognition error: ${error}`);
      setVoiceCommandResult(`Speech error: ${error}`);
    }
  });

  // Enable/disable voice commands
  const enableVoiceCommands = () => {
    setIsEnabled(true);
    toast.success('Voice commands enabled');
    speakResponse('Voice commands are now active. You can say "start deployment" to begin.');
  };

  const disableVoiceCommands = () => {
    setIsEnabled(false);
    stopSpeechRecognition();
    toast.info('Voice commands disabled');
  };

  // Start/stop listening
  const startListening = () => {
    if (isEnabled) {
      startSpeechRecognition();
    }
  };

  const stopListening = () => {
    stopSpeechRecognition();
  };

  // Speak a response
  const speakResponse = (text: string) => {
    if (isEnabled) {
      cancel(); // Cancel any previous speech
      speak(text);
      setVoiceCommandResult(text);
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopSpeechRecognition();
      cancel();
    };
  }, []);

  return (
    <SpeechCommandsContext.Provider
      value={{
        isEnabled,
        enableVoiceCommands,
        disableVoiceCommands,
        isListening,
        isSpeaking,
        startListening,
        stopListening,
        lastCommand,
        voiceCommandResult,
        speakResponse
      }}
    >
      {children}
    </SpeechCommandsContext.Provider>
  );
};

export const useSpeechCommands = () => {
  const context = useContext(SpeechCommandsContext);
  if (!context) {
    throw new Error('useSpeechCommands must be used within a SpeechCommandsProvider');
  }
  return context;
};

export default SpeechCommandsContext;
