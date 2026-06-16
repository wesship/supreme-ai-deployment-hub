import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCommand, routeCommand } from '../src/index.js';

test('routes CRM commands to the CRM architect', () => {
  const plan = routeCommand(parseCommand('CRM-360: Review the pipeline.'));
  assert.equal(plan.primaryAgent.id, 'crm-architect');
  assert.equal(plan.status, 'review-required');
});

test('blocks commands with unknown codes', () => {
  const plan = routeCommand(parseCommand('UNKNOWN-CODE + TABLE: Review this.'));
  assert.equal(plan.status, 'blocked');
});

test('routes deployment work to software engineering', () => {
  const plan = routeCommand(parseCommand('DEPLOY-360: Prepare release.'));
  assert.equal(plan.primaryAgent.id, 'software-engineer');
});
