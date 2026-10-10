/**
 * MAC (Memory as Context) Architecture
 * 
 * The simplest Titans approach: treats long-term memory as compressed
 * summary tokens that are prepended to the context window.
 * 
 * Flow:
 * 1. Process input through current context
 * 2. Retrieve relevant memories
 * 3. Compress memories into memory tokens
 * 4. Prepend memory tokens to input for attention
 */

import {
  MACConfig,
  MACOutput,
  MemoryState,
  MemoryToken,
  DEFAULT_MAC_CONFIG,
} from './types';
import {
  retrieveMemories,
  compressMemories,
  applyMemoryDecay,
  createMemoryToken,
  calculateSurprise,
  cosineSimilarity,
} from './memoryOperations';

export class MACProcessor {
  private config: MACConfig;
  private memoryState: MemoryState;

  constructor(config: Partial<MACConfig> = {}) {
    this.config = { ...DEFAULT_MAC_CONFIG, ...config };
    this.memoryState = {
      shortTerm: [],
      longTerm: [],
      workingMemory: [],
    };
  }

  /**
   * Process input and generate memory-augmented context
   */
  process(input: string, conversationHistory: string[] = []): MACOutput {
    // Step 1: Apply decay to existing memories
    this.memoryState.longTerm = applyMemoryDecay(
      this.memoryState.longTerm,
      this.config.memoryDecayRate
    );

    // Step 2: Calculate surprise for new input
    const surprise = calculateSurprise(input, [
      ...this.memoryState.shortTerm,
      ...this.memoryState.longTerm,
    ]);

    // Step 3: Add input to short-term memory
    const inputToken = createMemoryToken(input, surprise.noveltyScore);
    this.memoryState.shortTerm.push(inputToken);

    // Step 4: Retrieve relevant memories
    const retrieved = retrieveMemories(
      {
        query: input,
        topK: this.config.maxMemoryTokens,
        threshold: 0.3,
        includeDecayed: false,
      },
      this.memoryState
    );

    // Step 5: Compress memories into context tokens
    const contextTokens = this.compressForContext(retrieved.memories);

    // Step 6: Calculate relevance scores
    const relevanceScores = new Map<string, number>();
    retrieved.memories.forEach((memory, idx) => {
      relevanceScores.set(memory.id, retrieved.scores[idx]);
    });

    // Step 7: Build compressed memory string for context
    const compressedMemory = this.buildContextString(contextTokens, conversationHistory);

    // Step 8: If surprise is high, consolidate to long-term
    if (surprise.shouldUpdate) {
      this.consolidateToLongTerm(inputToken);
    }

    return {
      contextTokens,
      compressedMemory,
      relevanceScores,
    };
  }

  /**
   * Compress retrieved memories to fit within token budget
   */
  private compressForContext(memories: MemoryToken[]): MemoryToken[] {
    if (memories.length <= this.config.maxMemoryTokens) {
      return memories;
    }

    // Group memories by similarity and compress each group
    const groups = this.groupBySimilarity(memories);
    const compressed: MemoryToken[] = [];

    for (const group of groups) {
      if (compressed.length >= this.config.maxMemoryTokens) break;
      compressed.push(compressMemories(group));
    }

    return compressed;
  }

  /**
   * Group memories by embedding similarity
   */
  private groupBySimilarity(memories: MemoryToken[]): MemoryToken[][] {
    const groups: MemoryToken[][] = [];
    const used = new Set<string>();

    for (const memory of memories) {
      if (used.has(memory.id)) continue;

      const group: MemoryToken[] = [memory];
      used.add(memory.id);

      // Find similar memories
      for (const other of memories) {
        if (used.has(other.id)) continue;
        
        const similarity = cosineSimilarity(memory.embedding, other.embedding);
        if (similarity > 0.7) {
          group.push(other);
          used.add(other.id);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  /**
   * Build context string from memory tokens
   */
  private buildContextString(tokens: MemoryToken[], history: string[]): string {
    const memorySection = tokens
      .map(t => `[Memory] ${t.content}`)
      .join('\n');

    const historySection = history
      .slice(-5) // Last 5 messages
      .join('\n');

    return `=== Long-Term Memory Context ===\n${memorySection}\n\n=== Recent History ===\n${historySection}`;
  }

  /**
   * Move important memory to long-term storage
   */
  private consolidateToLongTerm(token: MemoryToken): void {
    // Check if similar memory already exists
    const existing = this.memoryState.longTerm.find(
      m => cosineSimilarity(m.embedding, token.embedding) > 0.9
    );

    if (existing) {
      // Strengthen existing memory
      existing.surprise = Math.min(1, existing.surprise + 0.1);
      existing.decayFactor = 1.0;
    } else {
      // Add new long-term memory
      this.memoryState.longTerm.push(token);
      
      // Trim if exceeding max
      if (this.memoryState.longTerm.length > this.config.contextWindowSize / 4) {
        this.memoryState.longTerm = this.memoryState.longTerm
          .sort((a, b) => (b.surprise * b.decayFactor) - (a.surprise * a.decayFactor))
          .slice(0, this.config.contextWindowSize / 4);
      }
    }
  }

  /**
   * Get current memory state
   */
  getMemoryState(): MemoryState {
    return { ...this.memoryState };
  }

  /**
   * Load memory state from persistence
   */
  loadMemoryState(state: MemoryState): void {
    this.memoryState = { ...state };
  }

  /**
   * Clear all memories
   */
  clearMemory(): void {
    this.memoryState = {
      shortTerm: [],
      longTerm: [],
      workingMemory: [],
    };
  }

  /**
   * Get memory statistics
   */
  getStats(): {
    shortTermCount: number;
    longTermCount: number;
    avgSurprise: number;
    avgDecay: number;
  } {
    const allMemories = [
      ...this.memoryState.shortTerm,
      ...this.memoryState.longTerm,
    ];

    return {
      shortTermCount: this.memoryState.shortTerm.length,
      longTermCount: this.memoryState.longTerm.length,
      avgSurprise: allMemories.length > 0
        ? allMemories.reduce((sum, m) => sum + m.surprise, 0) / allMemories.length
        : 0,
      avgDecay: allMemories.length > 0
        ? allMemories.reduce((sum, m) => sum + m.decayFactor, 0) / allMemories.length
        : 0,
    };
  }
}
