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

  it('uses the exact communications API payload contracts', () => {
    expect(page).toContain("preference_state: formValue(form, 'preference_state', 'allowed')");
    expect(page).toContain("max_frequency_per_day: Number(formValue(form, 'max_frequency_per_day', '1'))");
    expect(page).toContain("decision: formValue(form, 'decision', 'pass')");
    expect(page).toContain("checks: { type: formValue(form, 'check_type', 'consent')");
    expect(page).toContain("reasons: [formValue(form, 'reason'");
    expect(page).toContain("event_type: formValue(form, 'event_type', 'review_requested')");
    expect(page).not.toContain('consent_state');
    expect(page).not.toContain('max_messages_per_day');
    expect(page).not.toContain('created_by: userId');
    expect(page).not.toContain('reviewed_by: userId');
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
