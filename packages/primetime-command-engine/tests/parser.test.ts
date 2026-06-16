import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCode, parseCommand } from '../src/index.js';

test('normalizes spacing and underscores', () => {
  assert.equal(normalizeCode(' crm_audit '), 'CRM-AUDIT');
  assert.equal(normalizeCode('human approval'), 'HUMAN-APPROVAL');
});

test('parses command list and instruction', () => {
  const result = parseCommand('PRIMETIME + CRM-AUDIT + TABLE: Review the lead pipeline.');
  assert.deepEqual(result.requestedCodes, ['PRIMETIME','CRM-AUDIT','TABLE']);
  assert.equal(result.instruction, 'Review the lead pipeline.');
  assert.equal(result.outputFormat, 'TABLE');
  assert.equal(result.approvalLevel, 0);
});

test('expands master codes and escalates approval', () => {
  const result = parseCommand('COMPLIANCE-360 + SMS-SEQUENCE: Draft follow-up messages.');
  assert.ok(result.expandedCodes.includes('TCPA-CHECK'));
  assert.ok(result.expandedCodes.includes('ESCALATE-LICENSED'));
  assert.equal(result.approvalLevel, 3);
  assert.equal(result.humanApprovalRequired, true);
  assert.equal(result.licensedReviewRequired, true);
});

test('resolves aliases', () => {
  const result = parseCommand('crm review: inspect contacts');
  assert.deepEqual(result.requestedCodes, ['CRM-AUDIT']);
  assert.equal(result.unknownCodes.length, 0);
});

test('reports unknown commands', () => {
  const result = parseCommand('CRM-ANALYZE + TABLE: inspect');
  assert.deepEqual(result.unknownCodes, ['CRM-ANALYZE']);
});

test('detects output conflicts', () => {
  const result = parseCommand('TABLE + JSON: format this');
  assert.deepEqual(result.conflicts, [{ left: 'TABLE', right: 'JSON' }]);
});
