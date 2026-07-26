import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const APP = readFileSync('src/App.tsx', 'utf8');
const PAGE = readFileSync('src/pages/PrimetimeCustomLists.tsx', 'utf8');
const API = readFileSync('src/lib/primetimeRelease1Api.ts', 'utf8');

describe('PRIMETIME governed Custom Lists wiring', () => {
  it('registers authenticated current-runtime routes', () => {
    expect(APP).toContain('PrimetimeCustomLists');
    expect(APP).toContain('path="/primetime/custom-lists"');
    expect(APP).toContain('path="/primetime/lists"');
    expect(APP).toContain('<AuthenticatedRoute><PrimetimeCustomLists /></AuthenticatedRoute>');
  });

  it('uses the governed API and workspace selector', () => {
    expect(PAGE).toContain('primetimeRelease1Api.listWorkspaces');
    expect(PAGE).toContain('primetimeRelease1Api.listCustomLists');
    expect(PAGE).toContain('primetimeRelease1Api.createCustomList');
    expect(PAGE).toContain('primetimeRelease1Api.updateCustomList');
    expect(PAGE).toContain('primetimeRelease1Api.archiveCustomList');
    expect(PAGE).toContain('Include archived');
    expect(PAGE).toContain('Server governed');
  });

  it('keeps destructive deletion out of the UI and client', () => {
    expect(PAGE).not.toContain('deleteCustomList');
    expect(PAGE).not.toContain("method: 'DELETE'");
    expect(API).not.toContain('deleteCustomList');
    expect(API).not.toContain("method: 'DELETE'");
    expect(PAGE).toContain('people records and audit history will remain intact');
  });
});
