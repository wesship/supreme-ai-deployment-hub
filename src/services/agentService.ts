
// This file is kept for backward compatibility
// It re-exports all the agent service modules from the new modular structure

import { AgentCoreService } from './agent/coreService';
import { AgentWorkflowService } from './agent/workflowService';
import { AgentFileService } from './agent/fileService';
import { AgentToolsService } from './agent/toolsService';
import { AgentMemoryService } from './agent/memoryService';

// Combine all service modules into a single export for backward compatibility
export const AgentService = {
  // Agent core operations
  ...AgentCoreService,
  
  // Workflow operations
  ...AgentWorkflowService,
  
  // File operations
  ...AgentFileService,
  
  // Tools operations
  ...AgentToolsService,
  
  // Memory operations
  ...AgentMemoryService
};
