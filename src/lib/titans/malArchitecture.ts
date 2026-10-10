/**
 * MAL (Memory as Layer) Architecture
 * 
 * The most "Titan-like" approach where memory blocks are interleaved
 * with attention blocks in the network architecture.
 * 
 * Layer Pattern Example: [Attention, Memory, Attention, Memory, ...]
 * 
 * This creates a deep integration between immediate processing
 * and long-term pattern storage.
 */

import {
  MALConfig,
  MALLayerOutput,
  MemoryState,
  MemoryToken,
  DEFAULT_MAL_CONFIG,
} from './types';
import {
  createMemoryToken,
  calculateSurprise,
  cosineSimilarity,
  generateSimpleEmbedding,
  consolidateMemories,
} from './memoryOperations';

interface LayerState {
  type: 'attention' | 'memory';
  weights: number[][];
  bias: number[];
}

export class MALProcessor {
  private config: MALConfig;
  private memoryState: MemoryState;
  private layers: LayerState[] = [];
  private layerOutputs: MALLayerOutput[] = [];

  constructor(config: Partial<MALConfig> = {}) {
    this.config = { ...DEFAULT_MAL_CONFIG, ...config };
    this.memoryState = {
      shortTerm: [],
      longTerm: [],
      workingMemory: [],
    };
    this.initializeLayers();
  }

  /**
   * Initialize the interleaved layer structure
   */
  private initializeLayers(): void {
    const dim = this.config.hiddenDim;
    const scale = Math.sqrt(2.0 / dim);

    for (const layerType of this.config.layerPattern) {
      const weights = Array.from({ length: dim }, () =>
        Array.from({ length: dim }, () => (Math.random() - 0.5) * scale)
      );
      const bias = Array.from({ length: dim }, () => 0);

      this.layers.push({ type: layerType, weights, bias });
    }
  }

  /**
   * Process input through all layers
   */
  process(input: string): MALLayerOutput[] {
    let currentState = generateSimpleEmbedding(input, this.config.hiddenDim);
    this.layerOutputs = [];

    // Process through each layer in sequence
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      const output = layer.type === 'attention'
        ? this.processAttentionLayer(currentState, i)
        : this.processMemoryLayer(currentState, i);
      
      this.layerOutputs.push(output);
      currentState = output.output;
    }

    // Update memory based on final state
    this.updateMemoryFromProcessing(input, currentState);

    return this.layerOutputs;
  }

  /**
   * Process through an attention layer
   * Implements multi-head self-attention over working memory
   */
  private processAttentionLayer(input: number[], layerIdx: number): MALLayerOutput {
    const layer = this.layers[layerIdx];
    const numHeads = this.config.attentionHeads;
    const headDim = Math.floor(input.length / numHeads);

    // Split input into heads
    const heads: number[][] = [];
    for (let h = 0; h < numHeads; h++) {
      heads.push(input.slice(h * headDim, (h + 1) * headDim));
    }

    // Compute attention for each head using working memory
    const attentionOutputs: number[][] = [];
    const attentionWeights: number[][] = [];

    for (let h = 0; h < numHeads; h++) {
      const headQuery = heads[h];
      
      // Create key-value pairs from working memory
      const keys = this.memoryState.workingMemory.map(m => 
        m.embedding.slice(h * headDim, (h + 1) * headDim)
      );
      
      if (keys.length === 0) {
        // No working memory yet, use identity
        attentionOutputs.push(headQuery);
        attentionWeights.push([1]);
        continue;
      }

      // Compute attention scores
      const scores = keys.map(k => 
        this.dotProduct(headQuery, k) / Math.sqrt(headDim)
      );

      // Softmax
      const maxScore = Math.max(...scores);
      const expScores = scores.map(s => Math.exp(s - maxScore));
      const sumExp = expScores.reduce((a, b) => a + b, 0) || 1;
      const weights = expScores.map(e => e / sumExp);
      attentionWeights.push(weights);

      // Weighted sum of values
      const headOutput = new Array(headDim).fill(0);
      this.memoryState.workingMemory.forEach((memory, i) => {
        const value = memory.embedding.slice(h * headDim, (h + 1) * headDim);
        value.forEach((v, j) => {
          headOutput[j] += v * weights[i];
        });
      });
      attentionOutputs.push(headOutput);
    }

    // Concatenate heads
    const concatOutput = attentionOutputs.flat();

    // Apply layer transformation (residual connection + layer norm simplified)
    const output = this.applyLayerTransform(concatOutput, layer);

    // Add input to working memory
    const token = createMemoryToken(`[attention_L${layerIdx}]`, 0.5, input);
    this.memoryState.workingMemory.push(token);
    
    // Limit working memory size
    if (this.memoryState.workingMemory.length > 20) {
      this.memoryState.workingMemory = this.memoryState.workingMemory.slice(-20);
    }

    return {
      layerType: 'attention',
      output,
      attentionWeights,
    };
  }

  /**
   * Process through a memory layer
   * Implements neural memory read/write operations
   */
  private processMemoryLayer(input: number[], layerIdx: number): MALLayerOutput {
    const layer = this.layers[layerIdx];
    const memoryUpdates: MemoryToken[] = [];

    // Read from long-term memory
    const readOutput = this.readFromMemory(input);

    // Calculate surprise to determine if we should write
    const surprise = calculateSurprise(
      `layer_${layerIdx}`,
      this.memoryState.longTerm,
      0.7
    );

    // Write to memory if surprising
    if (surprise.shouldUpdate) {
      const writeToken = createMemoryToken(
        `[memory_L${layerIdx}]`,
        surprise.noveltyScore,
        input
      );
      this.memoryState.longTerm.push(writeToken);
      memoryUpdates.push(writeToken);

      // Update layer weights based on gradient (learning)
      this.updateMemoryLayerWeights(layer, input, surprise.gradient);
    }

    // Combine input with read output
    const combined = input.map((v, i) => v * 0.6 + readOutput[i] * 0.4);

    // Apply layer transformation
    const output = this.applyLayerTransform(combined, layer);

    return {
      layerType: 'memory',
      output,
      memoryUpdates,
    };
  }

  /**
   * Read from long-term memory using content-based addressing
   */
  private readFromMemory(query: number[]): number[] {
    if (this.memoryState.longTerm.length === 0) {
      return query; // Return query unchanged if no memories
    }

    // Calculate read weights based on similarity
    const similarities = this.memoryState.longTerm.map(memory =>
      cosineSimilarity(query, memory.embedding) * memory.decayFactor
    );

    // Softmax to get read weights
    const maxSim = Math.max(...similarities);
    const expSims = similarities.map(s => Math.exp((s - maxSim) * 5));
    const sumExp = expSims.reduce((a, b) => a + b, 0) || 1;
    const weights = expSims.map(e => e / sumExp);

    // Weighted read
    const readVector = new Array(query.length).fill(0);
    this.memoryState.longTerm.forEach((memory, i) => {
      const memEmb = memory.embedding.length === query.length
        ? memory.embedding
        : generateSimpleEmbedding(memory.content, query.length);
      
      memEmb.forEach((v, j) => {
        readVector[j] += v * weights[i];
      });
    });

    return readVector;
  }

  /**
   * Update memory layer weights (learning step)
   */
  private updateMemoryLayerWeights(
    layer: LayerState,
    input: number[],
    gradient: number[]
  ): void {
    const learningRate = 0.005;

    for (let i = 0; i < layer.weights.length && i < gradient.length; i++) {
      for (let j = 0; j < layer.weights[i].length && j < input.length; j++) {
        layer.weights[i][j] += learningRate * gradient[i] * input[j];
      }
      if (i < layer.bias.length) {
        layer.bias[i] += learningRate * gradient[i];
      }
    }
  }

  /**
   * Apply layer transformation with residual connection
   */
  private applyLayerTransform(input: number[], layer: LayerState): number[] {
    const output = new Array(input.length).fill(0);

    // Linear transformation
    for (let i = 0; i < layer.weights.length && i < input.length; i++) {
      let sum = layer.bias[i] || 0;
      for (let j = 0; j < layer.weights[i].length && j < input.length; j++) {
        sum += layer.weights[i][j] * input[j];
      }
      output[i] = sum;
    }

    // GELU activation (approximation)
    const activated = output.map(x => {
      const cdf = 0.5 * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * Math.pow(x, 3))));
      return x * cdf;
    });

    // Residual connection
    return activated.map((v, i) => v + input[i] * 0.1);
  }

  /**
   * Compute dot product
   */
  private dotProduct(a: number[], b: number[]): number {
    let sum = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  /**
   * Update memories based on processing results
   */
  private updateMemoryFromProcessing(input: string, finalState: number[]): void {
    // Add to short-term memory
    const shortTermToken = createMemoryToken(input, 0.5, finalState);
    this.memoryState.shortTerm.push(shortTermToken);

    // Consolidate periodically
    if (this.memoryState.shortTerm.length > 50) {
      this.memoryState = consolidateMemories(this.memoryState, 30, 200);
    }
  }

  /**
   * Get layer-by-layer analysis
   */
  analyzeProcessing(): {
    layerAnalysis: Array<{
      layer: number;
      type: 'attention' | 'memory';
      outputNorm: number;
      memoryInteraction: string;
    }>;
  } {
    return {
      layerAnalysis: this.layerOutputs.map((output, idx) => ({
        layer: idx,
        type: output.layerType,
        outputNorm: Math.sqrt(
          output.output.reduce((sum, v) => sum + v * v, 0)
        ),
        memoryInteraction: output.layerType === 'memory'
          ? `Updated ${output.memoryUpdates?.length || 0} memories`
          : `Attended over ${this.memoryState.workingMemory.length} items`,
      })),
    };
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
   * Load memory state and layer weights
   */
  loadState(memoryState: MemoryState, layers?: LayerState[]): void {
    this.memoryState = { ...memoryState };
    if (layers && layers.length === this.layers.length) {
      this.layers = layers.map(l => ({
        ...l,
        weights: l.weights.map(row => [...row]),
        bias: [...l.bias],
      }));
    }
  }

  /**
   * Export layer weights for persistence
   */
  exportLayers(): LayerState[] {
    return this.layers.map(l => ({
      ...l,
      weights: l.weights.map(row => [...row]),
      bias: [...l.bias],
    }));
  }

  /**
   * Get processing statistics
   */
  getStats(): {
    numLayers: number;
    layerTypes: string[];
    shortTermCount: number;
    longTermCount: number;
    workingMemoryCount: number;
  } {
    return {
      numLayers: this.layers.length,
      layerTypes: this.config.layerPattern,
      shortTermCount: this.memoryState.shortTerm.length,
      longTermCount: this.memoryState.longTerm.length,
      workingMemoryCount: this.memoryState.workingMemory.length,
    };
  }
}
