/**
 * MAG (Memory as Gate) Architecture
 * 
 * A parallel processing approach that runs input through two pipes:
 * - Pipe A: Standard attention for immediate context (short-term)
 * - Pipe B: Persistent memory MLP for historical context (long-term)
 * 
 * A gating mechanism (sigmoid) determines the blend ratio between pipes.
 */

import {
  MAGConfig,
  MAGGateOutput,
  MemoryState,
  MemoryToken,
  DEFAULT_MAG_CONFIG,
} from './types';
import {
  createMemoryToken,
  calculateSurprise,
  retrieveMemories,
  cosineSimilarity,
  generateSimpleEmbedding,
  consolidateMemories,
} from './memoryOperations';

export class MAGProcessor {
  private config: MAGConfig;
  private memoryState: MemoryState;
  private updateCounter: number = 0;
  
  // Simulated MLP weights for long-term memory
  private ltmWeights: number[][] = [];
  private ltmBias: number[] = [];

  constructor(config: Partial<MAGConfig> = {}, embeddingDim: number = 768) {
    this.config = { ...DEFAULT_MAG_CONFIG, ...config };
    this.memoryState = {
      shortTerm: [],
      longTerm: [],
      workingMemory: [],
    };
    this.initializeLTMWeights(embeddingDim);
  }

  /**
   * Initialize long-term memory MLP weights
   */
  private initializeLTMWeights(dim: number): void {
    // Xavier initialization for weights
    const scale = Math.sqrt(2.0 / dim);
    this.ltmWeights = Array.from({ length: dim }, () =>
      Array.from({ length: dim }, () => (Math.random() - 0.5) * scale)
    );
    this.ltmBias = Array.from({ length: dim }, () => 0);
  }

  /**
   * Process input through the MAG architecture
   */
  process(input: string): MAGGateOutput {
    const inputEmbedding = generateSimpleEmbedding(input);
    
    // Pipe A: Short-term attention output
    const shortTermOutput = this.processShortTerm(input, inputEmbedding);
    
    // Pipe B: Long-term memory MLP output
    const longTermOutput = this.processLongTerm(inputEmbedding);
    
    // Calculate gate value (sigmoid)
    const gateValue = this.calculateGate(input, inputEmbedding);
    
    // Combine outputs based on gate
    const combinedOutput = this.combineOutputs(
      shortTermOutput,
      longTermOutput,
      gateValue
    );
    
    // Update memories based on surprise
    this.updateMemories(input, inputEmbedding);
    
    return {
      gateValue,
      shortTermOutput,
      longTermOutput,
      combinedOutput,
    };
  }

  /**
   * Process through short-term attention (Pipe A)
   * Simulates attention over recent context
   */
  private processShortTerm(input: string, inputEmbedding: number[]): number[] {
    // Add to short-term memory
    const token = createMemoryToken(input, 0.5, inputEmbedding);
    this.memoryState.shortTerm.push(token);
    
    // Keep only recent memories
    if (this.memoryState.shortTerm.length > 50) {
      this.memoryState.shortTerm = this.memoryState.shortTerm.slice(-50);
    }
    
    // Compute attention-weighted output over short-term memories
    const attentionWeights = this.memoryState.shortTerm.map(memory =>
      cosineSimilarity(inputEmbedding, memory.embedding)
    );
    
    // Softmax normalization
    const maxWeight = Math.max(...attentionWeights);
    const expWeights = attentionWeights.map(w => Math.exp(w - maxWeight));
    const sumExp = expWeights.reduce((a, b) => a + b, 0) || 1;
    const normalizedWeights = expWeights.map(w => w / sumExp);
    
    // Weighted sum of memory embeddings
    const output = new Array(inputEmbedding.length).fill(0);
    this.memoryState.shortTerm.forEach((memory, idx) => {
      const weight = normalizedWeights[idx];
      memory.embedding.forEach((val, i) => {
        output[i] += val * weight;
      });
    });
    
    return output;
  }

  /**
   * Process through long-term memory MLP (Pipe B)
   * The MLP stores persistent patterns learned over time
   */
  private processLongTerm(inputEmbedding: number[]): number[] {
    // Forward pass through MLP: output = ReLU(W * input + b)
    const output = new Array(inputEmbedding.length).fill(0);
    
    for (let i = 0; i < this.ltmWeights.length; i++) {
      let sum = this.ltmBias[i];
      for (let j = 0; j < inputEmbedding.length; j++) {
        sum += this.ltmWeights[i][j] * inputEmbedding[j];
      }
      output[i] = Math.max(0, sum); // ReLU activation
    }
    
    return output;
  }

  /**
   * Calculate gate value based on input characteristics
   * High gate = favor long-term memory
   * Low gate = favor short-term attention
   */
  private calculateGate(input: string, inputEmbedding: number[]): number {
    // Calculate how "novel" this input is relative to short-term memory
    const surprise = calculateSurprise(
      input,
      this.memoryState.shortTerm,
      this.config.gateThreshold
    );
    
    // Check relevance to long-term memory
    const ltmRelevance = this.memoryState.longTerm.length > 0
      ? Math.max(...this.memoryState.longTerm.map(
          m => cosineSimilarity(inputEmbedding, m.embedding)
        ))
      : 0;
    
    // Gate formula: sigmoid(novelty * ltmRelevance - threshold)
    const gateInput = surprise.noveltyScore * ltmRelevance - this.config.gateThreshold;
    const gateValue = 1 / (1 + Math.exp(-gateInput * 5)); // Sigmoid with scaling
    
    return gateValue;
  }

  /**
   * Combine short-term and long-term outputs using gate
   */
  private combineOutputs(
    shortTerm: number[],
    longTerm: number[],
    gate: number
  ): number[] {
    // Weighted combination: output = (1-gate) * shortTerm + gate * longTerm
    const stWeight = (1 - gate) * this.config.shortTermWeight;
    const ltWeight = gate * this.config.longTermWeight;
    const totalWeight = stWeight + ltWeight || 1;
    
    return shortTerm.map((st, i) => 
      (st * stWeight + longTerm[i] * ltWeight) / totalWeight
    );
  }

  /**
   * Update memories and MLP weights based on surprise
   */
  private updateMemories(input: string, inputEmbedding: number[]): void {
    this.updateCounter++;
    
    const surprise = calculateSurprise(
      input,
      [...this.memoryState.shortTerm, ...this.memoryState.longTerm],
      this.config.gateThreshold
    );
    
    // Only update LTM weights periodically or when surprised
    if (surprise.shouldUpdate || this.updateCounter % this.config.updateFrequency === 0) {
      this.updateLTMWeights(inputEmbedding, surprise.gradient);
      
      // Add to long-term memory
      const token = createMemoryToken(input, surprise.noveltyScore, inputEmbedding);
      this.memoryState.longTerm.push(token);
    }
    
    // Consolidate memories periodically
    if (this.updateCounter % (this.config.updateFrequency * 5) === 0) {
      this.memoryState = consolidateMemories(this.memoryState);
    }
  }

  /**
   * Update LTM MLP weights using gradient
   * This is the "learning" step that modifies persistent memory
   */
  private updateLTMWeights(input: number[], gradient: number[]): void {
    const learningRate = 0.01;
    
    // Simple gradient descent update
    for (let i = 0; i < this.ltmWeights.length; i++) {
      for (let j = 0; j < input.length; j++) {
        // Hebbian-like update: strengthen connections for correlated activations
        this.ltmWeights[i][j] += learningRate * gradient[i] * input[j];
      }
      this.ltmBias[i] += learningRate * gradient[i];
    }
  }

  /**
   * Get interpretable gate analysis
   */
  analyzeGate(input: string): {
    gateValue: number;
    interpretation: string;
    memoryContribution: string;
  } {
    const inputEmbedding = generateSimpleEmbedding(input);
    const gate = this.calculateGate(input, inputEmbedding);
    
    let interpretation: string;
    let memoryContribution: string;
    
    if (gate < 0.3) {
      interpretation = 'Favoring short-term context (recent interactions)';
      memoryContribution = 'Primarily using recent conversation history';
    } else if (gate < 0.7) {
      interpretation = 'Balanced blend of short and long-term memory';
      memoryContribution = 'Combining recent context with historical patterns';
    } else {
      interpretation = 'Favoring long-term memory (historical patterns)';
      memoryContribution = 'Primarily leveraging learned patterns and past experiences';
    }
    
    return { gateValue: gate, interpretation, memoryContribution };
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
    this.initializeLTMWeights(this.ltmWeights.length || 768);
  }

  /**
   * Load memory state and optionally LTM weights
   */
  loadState(
    memoryState: MemoryState,
    ltmWeights?: number[][],
    ltmBias?: number[]
  ): void {
    this.memoryState = { ...memoryState };
    if (ltmWeights) this.ltmWeights = ltmWeights;
    if (ltmBias) this.ltmBias = ltmBias;
  }

  /**
   * Export LTM weights for persistence
   */
  exportLTMWeights(): { weights: number[][]; bias: number[] } {
    return {
      weights: this.ltmWeights.map(row => [...row]),
      bias: [...this.ltmBias],
    };
  }

  /**
   * Get processing statistics
   */
  getStats(): {
    shortTermCount: number;
    longTermCount: number;
    updateCount: number;
    avgGate: number;
  } {
    return {
      shortTermCount: this.memoryState.shortTerm.length,
      longTermCount: this.memoryState.longTerm.length,
      updateCount: this.updateCounter,
      avgGate: 0.5, // Would need to track this over time
    };
  }
}
