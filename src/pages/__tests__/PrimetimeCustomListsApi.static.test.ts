import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const API = readFileSync('src/lib/primetimeRelease1Api.ts', 'utf8');

describe('PRIMETIME Custom Lists frontend API contract', () => {
  it('reuses the authenticated PRIMETIME client boundary', () => {
    expect(API).toContain('supabase.auth.getSession');
    expect(API).toContain('Authorization: `Bearer ${token}`');
    expect(API).toContain("const API_URL = import.meta.env.VITE_API_URL || 'https://api.d3vonn.io'");
  });

  it('defines typed list and member records', () => {
    expect(API).toContain('export interface PrimetimeCustomList');
    expect(API).toContain('record_count: number');
    expect(API).toContain('archived_at: string | null');
    expect(API).toContain('export interface PrimetimeCustomListMember');
    expect(API).toContain('removed_at: string | null');
  });

  it('exposes all governed Custom Lists endpoints', () => {
    expect(API).toContain('listCustomLists');
    expect(API).toContain('createCustomList');
    expect(API).toContain('updateCustomList');
    expect(API).toContain('archiveCustomList');
    expect(API).toContain('listCustomListMembers');
    expect(API).toContain('addCustomListMember');
    expect(API).toContain('removeCustomListMember');
    expect(API).toContain('/primetime/v1/custom-lists');
    expect(API).toContain('/archive');
    expect(API).toContain('/remove');
  });

  it('supports boolean query parameters without adding hard delete', () => {
    expect(API).toContain('string | number | boolean | undefined | null');
    expect(API).toContain('include_archived: includeArchived');
    expect(API).not.toContain("method: 'DELETE'");
  });
});
