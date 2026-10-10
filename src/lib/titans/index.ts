/**
 * Titans Memory Architecture Library
 * 
 * TypeScript implementation of the Titans neural long-term memory framework.
 * 
 * Three architectures available:
 * - MAC (Memory as Context): Simplest - memory tokens prepended to context
 * - MAG (Memory as Gate): Parallel processing with gating mechanism
 * - MAL (Memory as Layer): Deep integration with interleaved memory layers
 */

// Types
export * from './types';

// Core operations
export {
  generateSimpleEmbedding,
  cosineSimilarity,
  createMemoryToken,
  applyMemoryDecay,
  calculateSurprise,
  retrieveMemories,
  consolidateMemories,
  compressMemories,
  createEmptyMemoryState,
} from './memoryOperations';

// Architectures
export { MACProcessor } from './macArchitecture';
export { MAGProcessor } from './magArchitecture';
export { MALProcessor } from './malArchitecture';

// Factory function to create processor based on config
import { TitansConfig, DEFAULT_TITANS_CONFIG } from './types';
import { MACProcessor } from './macArchitecture';
import { MAGProcessor } from './magArchitecture';
import { MALProcessor } from './malArchitecture';

export type TitansProcessor = MACProcessor | MAGProcessor | MALProcessor;

export function createTitansProcessor(
  config: Partial<TitansConfig> = {}
): TitansProcessor {
  const fullConfig = { ...DEFAULT_TITANS_CONFIG, ...config };
  
  switch (fullConfig.architecture) {
    case 'MAC':
      return new MACProcessor(fullConfig.mac);
    case 'MAG':
      return new MAGProcessor(fullConfig.mag, fullConfig.embeddingDim);
    case 'MAL':
      return new MALProcessor(fullConfig.mal);
    case 'hybrid':
    default:
      // Default to MAG as it's the most balanced approach
      return new MAGProcessor(fullConfig.mag, fullConfig.embeddingDim);
  }
}

// Convenience functions for common use cases
export function createContextEnhancer() {
  return new MACProcessor({
    maxMemoryTokens: 16,
    compressionRatio: 4,
    contextWindowSize: 4096,
    memoryDecayRate: 0.9,
  });
}

export function createMemoryGatedProcessor() {
  return new MAGProcessor({
    shortTermWeight: 0.5,
    longTermWeight: 0.5,
    gateThreshold: 0.5,
    updateFrequency: 5,
  });
}

export function createDeepMemoryProcessor() {
  return new MALProcessor({
    layerPattern: ['attention', 'memory', 'attention', 'memory', 'attention', 'memory'],
    memoryLayerSize: 512,
    attentionHeads: 8,
    hiddenDim: 768,
  });
}
