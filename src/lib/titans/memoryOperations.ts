/**
 * Core Memory Operations for Titans Architecture
 * 
 * Implements the fundamental operations for neural memory management:
 * - Embedding generation (via Lovable AI)
 * - Similarity computation
 * - Memory decay and consolidation
 * - Surprise-based updates
 */

import { MemoryToken, MemoryState, SurpriseMetrics, MemoryQuery, MemoryRetrievalResult } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a simple hash-based embedding for text
 * In production, this would call an embedding model
 */
export function generateSimpleEmbedding(text: string, dim: number = 768): number[] {
  const embedding = new Array(dim).fill(0);
  const normalized = text.toLowerCase().trim();
  
  // Simple hash-based embedding for demonstration
  for (let i = 0; i < normalized.length; i++) {
    const charCode = normalized.charCodeAt(i);
    const idx = (i * 17 + charCode * 31) % dim;
    embedding[idx] += Math.sin(charCode * 0.1) * 0.1;
    embedding[(idx + 1) % dim] += Math.cos(charCode * 0.1) * 0.1;
  }
  
  // Normalize the embedding
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0)) || 1;
  return embedding.map(val => val / magnitude);
}

/**
 * Compute cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Create a new memory token
 */
export function createMemoryToken(
  content: string,
  surprise: number = 0.5,
  embedding?: number[]
): MemoryToken {
  return {
    id: uuidv4(),
    content,
    embedding: embedding || generateSimpleEmbedding(content),
    timestamp: Date.now(),
    surprise,
    decayFactor: 1.0,
  };
}

/**
 * Apply decay to memory tokens based on time
 */
export function applyMemoryDecay(
  memories: MemoryToken[],
  decayRate: number = 0.95,
  currentTime: number = Date.now()
): MemoryToken[] {
  const hourInMs = 3600000;
  
  return memories.map(memory => {
    const hoursElapsed = (currentTime - memory.timestamp) / hourInMs;
    const decay = Math.pow(decayRate, hoursElapsed);
    
    return {
      ...memory,
      decayFactor: memory.decayFactor * decay,
    };
  });
}

/**
 * Calculate surprise metrics for new input
 * High surprise = should update long-term memory
 */
export function calculateSurprise(
  input: string,
  existingMemories: MemoryToken[],
  threshold: number = 0.7
): SurpriseMetrics {
  const inputEmbedding = generateSimpleEmbedding(input);
  
  // Calculate novelty based on similarity to existing memories
  let maxSimilarity = 0;
  for (const memory of existingMemories) {
    const similarity = cosineSimilarity(inputEmbedding, memory.embedding);
    maxSimilarity = Math.max(maxSimilarity, similarity);
  }
  
  // Novelty is inverse of max similarity
  const noveltyScore = 1 - maxSimilarity;
  
  // Calculate gradient (simplified as embedding difference)
  const gradient = inputEmbedding.map((val, idx) => {
    const avgExisting = existingMemories.length > 0
      ? existingMemories.reduce((sum, m) => sum + m.embedding[idx], 0) / existingMemories.length
      : 0;
    return val - avgExisting;
  });
  
  // Loss is based on how different this input is
  const loss = gradient.reduce((sum, val) => sum + val * val, 0) / gradient.length;
  
  return {
    loss,
    gradient,
    noveltyScore,
    shouldUpdate: noveltyScore > threshold,
  };
}

/**
 * Retrieve relevant memories based on query
 */
export function retrieveMemories(
  query: MemoryQuery,
  state: MemoryState
): MemoryRetrievalResult {
  const queryEmbedding = query.embedding || generateSimpleEmbedding(query.query);
  
  // Combine all memories
  const allMemories = [
    ...state.shortTerm,
    ...state.longTerm,
    ...state.workingMemory,
  ];
  
  // Filter by decay if needed
  const filteredMemories = query.includeDecayed
    ? allMemories
    : allMemories.filter(m => m.decayFactor > 0.1);
  
  // Calculate scores
  const scored = filteredMemories.map(memory => ({
    memory,
    score: cosineSimilarity(queryEmbedding, memory.embedding) * memory.decayFactor,
  }));
  
  // Sort by score and filter by threshold
  const filtered = scored
    .filter(item => item.score >= query.threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, query.topK);
  
  return {
    memories: filtered.map(item => item.memory),
    scores: filtered.map(item => item.score),
    totalRetrieved: filtered.length,
  };
}

/**
 * Consolidate memories - move important short-term to long-term
 */
export function consolidateMemories(
  state: MemoryState,
  maxShortTerm: number = 100,
  maxLongTerm: number = 1000
): MemoryState {
  // Sort short-term by surprise (importance)
  const sortedShortTerm = [...state.shortTerm].sort((a, b) => b.surprise - a.surprise);
  
  // Move high-surprise memories to long-term
  const toConsolidate = sortedShortTerm.filter(m => m.surprise > 0.7);
  const remaining = sortedShortTerm.filter(m => m.surprise <= 0.7);
  
  // Trim short-term to max size
  const newShortTerm = remaining.slice(0, maxShortTerm);
  
  // Add consolidated to long-term
  const newLongTerm = [...state.longTerm, ...toConsolidate]
    .sort((a, b) => b.decayFactor * b.surprise - a.decayFactor * a.surprise)
    .slice(0, maxLongTerm);
  
  return {
    shortTerm: newShortTerm,
    longTerm: newLongTerm,
    workingMemory: state.workingMemory,
  };
}

/**
 * Compress memories into a summary token
 */
export function compressMemories(memories: MemoryToken[]): MemoryToken {
  if (memories.length === 0) {
    return createMemoryToken('[empty memory]', 0);
  }
  
  // Average the embeddings
  const dim = memories[0].embedding.length;
  const avgEmbedding = new Array(dim).fill(0);
  
  for (const memory of memories) {
    for (let i = 0; i < dim; i++) {
      avgEmbedding[i] += memory.embedding[i] / memories.length;
    }
  }
  
  // Normalize
  const magnitude = Math.sqrt(avgEmbedding.reduce((sum, val) => sum + val * val, 0)) || 1;
  const normalized = avgEmbedding.map(val => val / magnitude);
  
  // Create summary content
  const summary = memories
    .slice(0, 5)
    .map(m => m.content.substring(0, 50))
    .join(' | ');
  
  return {
    id: uuidv4(),
    content: `[Compressed: ${memories.length} memories] ${summary}...`,
    embedding: normalized,
    timestamp: Date.now(),
    surprise: memories.reduce((sum, m) => sum + m.surprise, 0) / memories.length,
    decayFactor: 1.0,
  };
}

/**
 * Initialize empty memory state
 */
export function createEmptyMemoryState(): MemoryState {
  return {
    shortTerm: [],
    longTerm: [],
    workingMemory: [],
  };
}
