import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/PrimetimeCommunications.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const apiClient = readFileSync('src/lib/primetimeRelease1Api.ts', 'utf8');

describe('PrimetimeCommunications static wiring', () => {
  it('registers Release 3 communications routes', () => {
    expect(app).toContain('PrimetimeCommunications');
    expect(app).toContain('/primetime/communications');
    expect(app).toContain('/primetime/release-3');
  });

  it('exposes governed communications API client methods', () => {
    const requiredMethods = [
      'listMessageTemplates',
      'createMessageTemplate',
      'updateMessageTemplate',
      'listMessageTemplateVersions',
      'createMessageTemplateVersion',
      'listCommunicationPreferences',
      'createCommunicationPreference',
      'listCommunications',
      'createCommunication',
      'updateCommunication',
      'listCommunicationEvents',
      'createCommunicationEvent',
      'listCommunicationPolicyChecks',
      'createCommunicationPolicyCheck',
    ];

    for (const method of requiredMethods) {
      expect(apiClient).toContain(method);
    }
  });

  it('renders all Release 3 governance surfaces', () => {
    const requiredText = [
      'Template library',
      'Template version editor',
      'Communication preferences',
      'Draft communication workspace',
      'Policy-check panel',
      'Communication timeline',
      'No autonomous sending',
      'no send button',
      'no delete actions',
    ];

    for (const text of requiredText) {
      expect(page).toContain(text);
    }
  });

  it('does not expose send, bulk-send, or delete handlers', () => {
    expect(page).not.toMatch(/sendCommunication|sendMessage|bulkSend|bulk_send|deleteCommunication|deleteTemplate/);
    expect(apiClient).not.toContain('/send');
    expect(apiClient).not.toContain('method: \'DELETE\'');
  });

  it('keeps communications draft-first and review-gated', () => {
    expect(page).toContain("status: 'draft'");
    expect(page).toContain('createCommunicationPolicyCheck');
    expect(page).toContain('approveTemplate');
    expect(page).toContain('Communication timeline');
  });
});
