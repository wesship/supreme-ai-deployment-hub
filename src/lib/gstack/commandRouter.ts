import { getGStackAgent } from './registry';
import type { GStackCommandDecision, GStackCommandRequest } from './agentTypes';

export function routeGStackCommand(request: GStackCommandRequest): GStackCommandDecision {
 const agent = getGStackAgent(request.command);
 if (!agent) {
  return {
   accepted:false,
   reason:`Unknown command: ${request.command}`,
   requiredProof:[],
   nextActions:['Use a registered GStack command']
  };
 }

 const requiredProof = agent.requiredGates.map(g=>`Gate proof required: ${g}`);

 if (request.requiresDestructiveAction) {
   requiredProof.push('Hermes HITL approval required before destructive action');
 }

 return {
  accepted:true,
  agent,
  reason:`Routed to ${agent.name}`,
  requiredProof,
  nextActions:[
   `Execute ${agent.command}`,
   'Collect evidence before changing gate status',
   'Do not mark green without proof'
  ]
 };
}
