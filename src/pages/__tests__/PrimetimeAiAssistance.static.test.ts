import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/PrimetimeAiAssistance.tsx', 'utf8');
const api = readFileSync('src/lib/primetimeRelease1Api.ts', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');

describe('PRIMETIME Release 4 AI Assistance UI wiring', () => {
  it('registers Release 4 AI assistance routes', () => {
    expect(app).toContain('/primetime/ai-assistance');
    expect(app).toContain('/primetime/release-4');
    expect(app).toContain('PrimetimeAiAssistance');
  });

  it('exposes all Release 4 AI assistance workspace surfaces', () => {
    expect(page).toContain('Agent registry');
    expect(page).toContain('Assistance request console');
    expect(page).toContain('Output review queue');
    expect(page).toContain('AI action ledger');
    expect(page).toContain('Human approval inbox');
    expect(page).toContain('Compliance findings panel');
    expect(page).toContain('Knowledge citation viewer');
  });

  it('keeps regulated action guardrails visible in the UI', () => {
    expect(page).toContain('no send');
    expect(page).toContain('no delete');
    expect(page).toContain('no quote');
    expect(page).toContain('no recommend-policy');
    expect(page).toContain('no submit-application');
    expect(page).toContain('no autonomous regulated recommendations');
  });

  it('uses governed Release 4 API methods and does not expose send, quote, recommendation, submit, or delete calls', () => {
    expect(api).toContain('listAiAgents');
    expect(api).toContain('createAiAssistanceRequest');
    expect(api).toContain('createAiAssistanceOutput');
    expect(api).toContain('createAiActionLedger');
    expect(api).toContain('createAiApprovalRequest');
    expect(api).toContain('createAiComplianceFinding');
    expect(api).toContain('createAiKnowledgeCitation');
    expect(api).not.toContain('/primetime/v1/send');
    expect(api).not.toContain('/primetime/v1/quote');
    expect(api).not.toContain('/primetime/v1/recommend-policy');
    expect(api).not.toContain('/primetime/v1/submit-application');
    expect(api).not.toContain("method: 'DELETE'");
  });
});
