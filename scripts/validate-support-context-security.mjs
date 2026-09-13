import fs from 'node:fs';

const storagePath = 'supabase/migrations/20260913190000_support_context_storage.sql';
const auditPath = 'supabase/migrations/20260913190500_support_context_audit_and_portability.sql';
const storage = fs.readFileSync(storagePath, 'utf8');
const audit = fs.readFileSync(auditPath, 'utf8');
const all = `${storage}\n${audit}`;

const failures = [];
const requireText = (condition, message) => {
  if (!condition) failures.push(message);
};

for (const table of ['support_journal_records', 'support_screening_records', 'support_context_audit_events']) {
  requireText(all.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`), `${table}: RLS must be enabled`);
}

requireText(storage.includes("auth.jwt()->'app_metadata'->>'tenant_id'"), 'tenant isolation must use trusted app_metadata tenant_id');
requireText(!all.includes('user_metadata'), 'user_metadata must never be used for authorization');
requireText(storage.includes('REVOKE ALL ON TABLE public.support_journal_records FROM anon, authenticated'), 'journal grants must be fail-closed before authenticated grants');
requireText(storage.includes('REVOKE ALL ON TABLE public.support_screening_records FROM anon, authenticated'), 'screening grants must be fail-closed before authenticated grants');
requireText(audit.includes("SECURITY DEFINER\nSET search_path = ''"), 'audit trigger must pin an empty search_path');
requireText(audit.includes('REVOKE ALL ON FUNCTION support_private.write_context_audit_event() FROM PUBLIC, anon, authenticated'), 'audit trigger function must not be callable by clients');
requireText(audit.includes('SECURITY INVOKER'), 'export/delete functions must use security invoker');
requireText(!/PHQ|GAD|questionnaire item/i.test(all), 'licensed questionnaire content must not be embedded in migrations');
requireText(storage.includes('payload_ciphertext'), 'journal persistence must use ciphertext field, not plaintext content');
requireText(!/\bcontent\s+text\b/i.test(storage), 'plaintext journal content column is prohibited');
requireText(storage.includes('retention_policy_version') && storage.includes('retention_expires_at'), 'retention metadata is required');

if (failures.length) {
  console.error('Support-context security validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Support-context security migration contract: PASS');
