import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SpeechHandler } from '@/contexts/chat/SpeechHandler';
import { Mic, MicOff, Volume2, AlertTriangle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useSafeChat } from '@/contexts/ChatContext';

const VoiceEnabledAI: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const speechHandlerRef = useRef<SpeechHandler | null>(null);
  const { sendMessage, isSpeechSupported } = useSafeChat();
  const supportStatus = isSpeechSupported();

  useEffect(() => {
    // Initialize speech handler
    speechHandlerRef.current = new SpeechHandler({
      onStart: () => setIsListening(true),
      onEnd: () => setIsListening(false),
      onResult: (text) => {
        setTranscript(text);
        handleVoiceCommand(text);
      },
      onInterim: (text) => setInterimTranscript(text),
      onError: (error) => {
        toast.error(`Speech recognition error: ${error}`);
        setIsListening(false);
      }
    });

    return () => {
      if (speechHandlerRef.current) {
        speechHandlerRef.current.stopListening();
        speechHandlerRef.current.stopSpeaking();
      }
    };
  }, []);

  const toggleListening = () => {
    if (!speechHandlerRef.current) return;
    
    if (isListening) {
      speechHandlerRef.current.stopListening();
      setIsListening(false);
    } else {
      speechHandlerRef.current.startListening();
      toast.info("Voice assistant is listening");
      setIsListening(true);
    }
  };

  const handleVoiceCommand = (text: string) => {
    if (!text.trim()) return;
    
    setIsProcessing(true);
    // Process common voice commands
    const lowerText = text.toLowerCase();
    
    // Look for deployment commands
    if (lowerText.includes('deploy') || lowerText.includes('start deployment')) {
      speak("Starting deployment process. Please navigate to the deployment dashboard.");
      setTimeout(() => {
        window.location.href = '/deployment';
      }, 3000);
      return;
    }
    
    // Look for API commands
    if (lowerText.includes('api') || lowerText.includes('manage api')) {
      speak("Opening API management interface. You can manage your connections there.");
      setTimeout(() => {
        window.location.href = '/api';
      }, 3000);
      return;
    }
    
    // Look for help commands
    if (lowerText.includes('help me') || lowerText.includes('get help')) {
      speak("Opening documentation to help you get started.");
      setTimeout(() => {
        window.location.href = '/documentation';
      }, 3000);
      return;
    }
    
    // If no special command was detected, send to chat assistant
    sendMessage(text, true);
    setIsProcessing(false);
  };

  const speak = (text: string) => {
    if (!speechHandlerRef.current) return;
    
    setIsSpeaking(true);
    speechHandlerRef.current.speak(text, {
      rate: 1.0,
      pitch: 1.0
    });
    
    // Reset speaking state after estimated speaking time
    const speakingTime = text.length * 80; // Rough estimate
    setTimeout(() => {
      setIsSpeaking(false);
    }, speakingTime);
  };

  return (
    <section className="py-12 relative overflow-hidden">
      {/* Abstract background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20"></div>
      </div>
      
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-sm font-semibold tracking-wider text-primary uppercase"
            >
              Voice-Enabled AI Assistant
            </motion.div>
            
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-3xl font-bold mt-2"
            >
              Control D3VONN.IO with Your Voice
            </motion.h2>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-4 text-muted-foreground max-w-2xl mx-auto"
            >
              Speak to your AI deployment system. Command deployments, check status, and manage APIs using natural language.
            </motion.p>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-card border rounded-xl p-6 shadow-lg"
          >
            {!supportStatus.voiceInput && (
              <div className="flex items-center gap-2 p-3 mb-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-500">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-sm">Speech recognition is not supported in this browser</span>
              </div>
            )}
            
            <div className="flex flex-col items-center justify-center">
              <div className="relative w-32 h-32 mb-6">
                <AnimatePresence mode="wait">
                  {isListening ? (
                    <motion.div 
                      key="listening"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <div className="relative">
                        <motion.div 
                          animate={{ 
                            scale: [1, 1.2, 1],
                            opacity: [0.5, 0.8, 0.5] 
                          }}
                          transition={{ 
                            repeat: Infinity,
                            duration: 2
                          }}
                          className="absolute inset-0 bg-primary/20 rounded-full"
                        />
                        <div 
                          className="relative z-10 bg-primary text-primary-foreground rounded-full w-24 h-24 flex items-center justify-center cursor-pointer"
                          onClick={toggleListening}
                        >
                          <Mic className="h-10 w-10" />
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="not-listening"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <div 
                        className="bg-secondary text-secondary-foreground rounded-full w-24 h-24 flex items-center justify-center cursor-pointer hover:bg-secondary/90 transition-colors"
                        onClick={toggleListening}
                      >
                        <MicOff className="h-10 w-10" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              <div className="w-full mb-6">
                <div className="relative bg-muted/40 rounded-lg p-4 min-h-[80px] flex items-center justify-center">
                  {isProcessing && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 bg-background/50 rounded-lg flex items-center justify-center z-10"
                    >
                      <div className="flex flex-col items-center">
                        <div className="relative w-8 h-8 mb-2">
                          <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                            className="w-full h-full border-t-2 border-primary rounded-full"
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">Processing command...</span>
                      </div>
                    </motion.div>
                  )}
                  
                  <AnimatePresence mode="wait">
                    {transcript || interimTranscript ? (
                      <motion.div
                        key="transcript"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center"
                      >
                        {transcript || 
                          <span className="text-muted-foreground italic">{interimTranscript}</span>
                        }
                      </motion.div>
                    ) : (
                      <motion.div
                        key="placeholder"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-muted-foreground text-center"
                      >
                        {isListening ? "Listening..." : "Press the microphone button to speak"}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              
              <div className="text-center">
                <h3 className="text-lg font-medium mb-3">Try saying:</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-secondary/30 rounded-lg p-3 text-sm">
                    "Deploy my AI system"
                  </div>
                  <div className="bg-secondary/30 rounded-lg p-3 text-sm">
                    "Manage API connections"
                  </div>
                  <div className="bg-secondary/30 rounded-lg p-3 text-sm">
                    "Check deployment status"
                  </div>
                  <div className="bg-secondary/30 rounded-lg p-3 text-sm">
                    "Show me the documentation"
                  </div>
                </div>
                
                <div className="mt-6 flex items-center justify-center">
                  {isSpeaking ? (
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <Volume2 className="h-4 w-4" />
                      <span>AI is speaking...</span>
                    </div>
                  ) : supportStatus.voiceOutput ? (
                    <div className="flex items-center gap-2 text-sm text-green-500">
                      <Check className="h-4 w-4" />
                      <span>Voice output ready</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-yellow-500">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Voice output not supported</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default VoiceEnabledAI;
