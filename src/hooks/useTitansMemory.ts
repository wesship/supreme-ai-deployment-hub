/**
 * React hook for using Titans memory architectures
 * 
 * Provides an easy interface to integrate MAC, MAG, or MAL
 * memory processing into React components.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  TitansConfig,
  MemoryState,
  DEFAULT_TITANS_CONFIG,
  MACOutput,
  MAGGateOutput,
  MALLayerOutput,
} from '@/lib/titans/types';
import { MACProcessor } from '@/lib/titans/macArchitecture';
import { MAGProcessor } from '@/lib/titans/magArchitecture';
import { MALProcessor } from '@/lib/titans/malArchitecture';
import { createEmptyMemoryState } from '@/lib/titans/memoryOperations';

type ProcessorType = MACProcessor | MAGProcessor | MALProcessor;

interface TitansMemoryState {
  processor: ProcessorType | null;
  architecture: TitansConfig['architecture'];
  memoryState: MemoryState;
  isProcessing: boolean;
  lastOutput: MACOutput | MAGGateOutput | MALLayerOutput[] | null;
  stats: {
    shortTermCount: number;
    longTermCount: number;
    processCount: number;
  };
}

interface UseTitansMemoryOptions {
  agentId?: string;
  architecture?: TitansConfig['architecture'];
  config?: Partial<TitansConfig>;
  persistMemory?: boolean;
}

export function useTitansMemory(options: UseTitansMemoryOptions = {}) {
  const {
    agentId,
    architecture = 'MAG',
    config = {},
    persistMemory = true,
  } = options;

  const [state, setState] = useState<TitansMemoryState>({
    processor: null,
    architecture,
    memoryState: createEmptyMemoryState(),
    isProcessing: false,
    lastOutput: null,
    stats: { shortTermCount: 0, longTermCount: 0, processCount: 0 },
  });

  const processCountRef = useRef(0);

  // Initialize processor
  useEffect(() => {
    const fullConfig = { ...DEFAULT_TITANS_CONFIG, ...config, architecture };
    let processor: ProcessorType;

    switch (architecture) {
      case 'MAC':
        processor = new MACProcessor(fullConfig.mac);
        break;
      case 'MAL':
        processor = new MALProcessor(fullConfig.mal);
        break;
      case 'MAG':
      default:
        processor = new MAGProcessor(fullConfig.mag, fullConfig.embeddingDim);
    }

    setState(prev => ({ ...prev, processor, architecture }));

    // Load persisted memory if agentId provided
    if (agentId && persistMemory) {
      loadPersistedMemory(agentId, processor);
    }
  }, [architecture, agentId]);

  // Load memory from database
  const loadPersistedMemory = async (agentId: string, processor: ProcessorType) => {
    try {
      const { data: memories, error } = await (supabase as any)
        .from('mcp_connections')
        .select('custom_config')
        .eq('server_id', `titans_memory_${agentId}`)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading memory:', error);
        return;
      }

      const memoryData = memories as { custom_config?: any } | null;
      if (memoryData?.custom_config) {
        const config = memoryData.custom_config as { memoryState?: MemoryState };
        if (config.memoryState) {
          if ('loadMemoryState' in processor && typeof processor.loadMemoryState === 'function') {
            processor.loadMemoryState(config.memoryState);
          }
          setState(prev => ({
            ...prev,
            memoryState: config.memoryState!,
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load persisted memory:', error);
    }
  };

  // Save memory to database
  const persistMemoryState = useCallback(async () => {
    if (!agentId || !state.processor || !persistMemory) return;

    try {
      const memoryState = state.processor.getMemoryState();
      const { data: session } = await supabase.auth.getSession();
      
      if (!session?.session?.user) {
        console.warn('No user session for memory persistence');
        return;
      }

      // Check if record exists first
      const { data: existing } = await (supabase as any)
        .from('mcp_connections')
        .select('id')
        .eq('server_id', `titans_memory_${agentId}`)
        .eq('user_id', session.session.user.id)
        .single();

      const existingId = (existing as any)?.id;

      if (existingId) {
        // Update existing
        const { error } = await (supabase as any)
          .from('mcp_connections')
          .update({
            custom_config: { memoryState },
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingId);

        if (error) console.error('Error updating memory:', error);
      } else {
        // Insert new
        const { error } = await (supabase as any)
          .from('mcp_connections')
          .insert({
            server_id: `titans_memory_${agentId}`,
            server_name: `Titans Memory - ${agentId}`,
            server_type: 'memory',
            category: 'titans',
            user_id: session.session.user.id,
            custom_config: { memoryState },
          });

        if (error) console.error('Error inserting memory:', error);
      }
    } catch (error) {
      console.error('Failed to persist memory:', error);
    }
  }, [agentId, state.processor, persistMemory]);

  // Process input through the memory architecture
  const process = useCallback(async (
    input: string,
    conversationHistory?: string[]
  ): Promise<MACOutput | MAGGateOutput | MALLayerOutput[] | null> => {
    if (!state.processor) {
      toast.error('Memory processor not initialized');
      return null;
    }

    setState(prev => ({ ...prev, isProcessing: true }));
    processCountRef.current++;

    try {
      let output: MACOutput | MAGGateOutput | MALLayerOutput[];

      if (state.processor instanceof MACProcessor) {
        output = state.processor.process(input, conversationHistory);
      } else if (state.processor instanceof MAGProcessor) {
        output = state.processor.process(input);
      } else {
        output = state.processor.process(input);
      }

      const memoryState = state.processor.getMemoryState();
      const stats = {
        shortTermCount: memoryState.shortTerm.length,
        longTermCount: memoryState.longTerm.length,
        processCount: processCountRef.current,
      };

      setState(prev => ({
        ...prev,
        memoryState,
        lastOutput: output,
        stats,
        isProcessing: false,
      }));

      // Persist every 5 processes
      if (processCountRef.current % 5 === 0) {
        persistMemoryState();
      }

      return output;
    } catch (error) {
      console.error('Error processing input:', error);
      toast.error('Memory processing failed');
      setState(prev => ({ ...prev, isProcessing: false }));
      return null;
    }
  }, [state.processor, persistMemoryState]);

  // Analyze gate (MAG only)
  const analyzeGate = useCallback((input: string) => {
    if (!(state.processor instanceof MAGProcessor)) {
      return null;
    }
    return state.processor.analyzeGate(input);
  }, [state.processor]);

  // Analyze layers (MAL only)
  const analyzeLayers = useCallback(() => {
    if (!(state.processor instanceof MALProcessor)) {
      return null;
    }
    return state.processor.analyzeProcessing();
  }, [state.processor]);

  // Get context string (MAC only)
  const getContextString = useCallback(() => {
    if (!state.lastOutput) return '';
    
    if ('compressedMemory' in state.lastOutput) {
      return (state.lastOutput as MACOutput).compressedMemory;
    }
    return '';
  }, [state.lastOutput]);

  // Clear memory
  const clearMemory = useCallback(() => {
    if (state.processor && 'clearMemory' in state.processor && typeof state.processor.clearMemory === 'function') {
      state.processor.clearMemory();
    }
    setState(prev => ({
      ...prev,
      memoryState: createEmptyMemoryState(),
      lastOutput: null,
      stats: { shortTermCount: 0, longTermCount: 0, processCount: 0 },
    }));
  }, [state.processor]);

  // Force persist
  const forcePersist = useCallback(() => {
    persistMemoryState();
    toast.success('Memory persisted');
  }, [persistMemoryState]);

  return {
    // State
    architecture: state.architecture,
    memoryState: state.memoryState,
    isProcessing: state.isProcessing,
    lastOutput: state.lastOutput,
    stats: state.stats,
    
    // Actions
    process,
    analyzeGate,
    analyzeLayers,
    getContextString,
    clearMemory,
    forcePersist,
    
    // Utilities
    isMAC: state.processor instanceof MACProcessor,
    isMAG: state.processor instanceof MAGProcessor,
    isMAL: state.processor instanceof MALProcessor,
  };
}

export default useTitansMemory;
