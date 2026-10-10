/**
 * Titans Memory Architecture Types
 * 
 * Based on the Titans framework for Neural Long-Term Memory:
 * - MAC (Memory as Context): Memory tokens prepended to input
 * - MAG (Memory as Gate): Parallel processing with gating mechanism
 * - MAL (Memory as Layer): Interleaved memory and attention layers
 */

// Core memory types
export interface MemoryToken {
  id: string;
  embedding: number[];
  content: string;
  timestamp: number;
  surprise: number; // Gradient/loss indicating novelty
  decayFactor: number;
}

export interface MemoryState {
  shortTerm: MemoryToken[];
  longTerm: MemoryToken[];
  workingMemory: MemoryToken[];
}

// MAC (Memory as Context) types
export interface MACConfig {
  maxMemoryTokens: number;
  compressionRatio: number;
  contextWindowSize: number;
  memoryDecayRate: number;
}

export interface MACOutput {
  contextTokens: MemoryToken[];
  compressedMemory: string;
  relevanceScores: Map<string, number>;
}

// MAG (Memory as Gate) types
export interface MAGConfig {
  shortTermWeight: number;
  longTermWeight: number;
  gateThreshold: number;
  updateFrequency: number;
}

export interface MAGGateOutput {
  gateValue: number; // 0-1 sigmoid output
  shortTermOutput: number[];
  longTermOutput: number[];
  combinedOutput: number[];
}

// MAL (Memory as Layer) types
export interface MALConfig {
  layerPattern: ('attention' | 'memory')[];
  memoryLayerSize: number;
  attentionHeads: number;
  hiddenDim: number;
}

export interface MALLayerOutput {
  layerType: 'attention' | 'memory';
  output: number[];
  attentionWeights?: number[][];
  memoryUpdates?: MemoryToken[];
}

// Surprise calculation for memory updates
export interface SurpriseMetrics {
  loss: number;
  gradient: number[];
  shouldUpdate: boolean;
  noveltyScore: number;
}

// Memory retrieval types
export interface MemoryQuery {
  query: string;
  embedding?: number[];
  topK: number;
  threshold: number;
  includeDecayed: boolean;
}

export interface MemoryRetrievalResult {
  memories: MemoryToken[];
  scores: number[];
  totalRetrieved: number;
}

// Persistent memory store interface
export interface MemoryStore {
  agentId: string;
  memories: MemoryState;
  config: TitansConfig;
  lastUpdated: number;
  version: number;
}

// Combined Titans configuration
export interface TitansConfig {
  architecture: 'MAC' | 'MAG' | 'MAL' | 'hybrid';
  mac?: MACConfig;
  mag?: MAGConfig;
  mal?: MALConfig;
  embeddingDim: number;
  maxTotalMemory: number;
  surpriseThreshold: number;
  persistMemory: boolean;
}

// Default configurations
export const DEFAULT_MAC_CONFIG: MACConfig = {
  maxMemoryTokens: 32,
  compressionRatio: 4,
  contextWindowSize: 4096,
  memoryDecayRate: 0.95,
};

export const DEFAULT_MAG_CONFIG: MAGConfig = {
  shortTermWeight: 0.6,
  longTermWeight: 0.4,
  gateThreshold: 0.5,
  updateFrequency: 10,
};

export const DEFAULT_MAL_CONFIG: MALConfig = {
  layerPattern: ['attention', 'memory', 'attention', 'memory'],
  memoryLayerSize: 512,
  attentionHeads: 8,
  hiddenDim: 768,
};

export const DEFAULT_TITANS_CONFIG: TitansConfig = {
  architecture: 'MAG',
  mac: DEFAULT_MAC_CONFIG,
  mag: DEFAULT_MAG_CONFIG,
  mal: DEFAULT_MAL_CONFIG,
  embeddingDim: 768,
  maxTotalMemory: 10000,
  surpriseThreshold: 0.7,
  persistMemory: true,
};
