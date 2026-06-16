import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCommand, routeCommand } from '../src/index.js';

test('expands CONCEPT-360 and requires canonical approval', () => {
  const result = parseCommand('CONCEPT-360: Analyze the lead-to-appointment system.');
  assert.ok(result.expandedCodes.includes('CONCEPT-READ'));
  assert.ok(result.expandedCodes.includes('CONCEPT-CANON'));
  assert.equal(result.approvalLevel, 3);
  assert.equal(result.humanApprovalRequired, true);
});

test('routes concept work through the supervisor until a dedicated router is added', () => {
  const plan = routeCommand(parseCommand('CONCEPT-GAP + CONCEPT-BRIDGE: Find missing links.'));
  assert.equal(plan.status, 'draft-ready');
  assert.equal(plan.primaryAgent.id, 'primetime-supervisor');
});
