import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const client = readFileSync(resolve(ROOT, 'src/lib/primetimeCustomListsApi.ts'), 'utf8');
const page = readFileSync(resolve(ROOT, 'src/pages/PrimetimeCustomLists.tsx'), 'utf8');
const members = readFileSync(resolve(ROOT, 'src/components/primetime/PrimetimeCustomListMembersDialog.tsx'), 'utf8');


describe('PRIMETIME Custom Lists browser boundary', () => {
  it('requires an authenticated Supabase session before making API calls', () => {
    expect(client).toContain('supabase.auth.getSession()');
    expect(client).toContain("if (!token) throw new Error('Authentication is required for PRIMETIME Custom Lists.')");
    expect(client).toContain('Authorization: `Bearer ${token}`');
  });

  it('never exposes service-role credentials or writes directly to Supabase tables', () => {
    for (const source of [client, page, members]) {
      expect(source).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(source).not.toContain('service_role');
      expect(source).not.toContain(".from('primetime_custom_lists')");
      expect(source).not.toContain(".from('primetime_custom_list_members')");
    }
  });

  it('uses canonical governed HTTP verbs and paths', () => {
    expect(client).toContain("'/primetime/v1/custom-lists'");
    expect(client).toContain('method: \'POST\'');
    expect(client).toContain('method: \'PATCH\'');
    expect(client).toContain('/archive`');
    expect(client).toContain('/remove`');
  });
});
