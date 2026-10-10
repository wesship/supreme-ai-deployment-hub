
// This file is kept for backward compatibility
// It re-exports all the agent API modules from the new modular structure

import { agentCoreApi } from './agent/agentCore';
import { agentMemoryApi } from './agent/agentMemory';
import { agentToolsApi } from './agent/agentTools';
import { workflowApi } from './agent/workflowApi';
import { fileApi } from './agent/fileApi';

// Combine all API modules into a single export for backward compatibility
export const agentApi = {
  // Agent core operations
  ...agentCoreApi,
  
  // Memory operations
  ...agentMemoryApi,
  
  // Tools operations
  ...agentToolsApi,
  
  // Workflow operations
  ...workflowApi,
  
  // File operations
  ...fileApi
};
