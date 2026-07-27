import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const catalogArg = process.argv.find((arg) => arg.startsWith('--catalog='));
const outputArg = process.argv.find((arg) => arg.startsWith('--output='));
const catalogPath = path.resolve(root, catalogArg?.split('=', 2)[1] || 'config/secret-inventory.json');
const outputPath = outputArg ? path.resolve(root, outputArg.split('=', 2)[1]) : null;
const strict = args.has('--strict');
const syncSupabase = args.has('--sync-supabase');

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const records = Array.isArray(catalog.records) ? catalog.records : [];
const allowedFields = new Set(['name', 'platform', 'environment', 'sensitivity', 'used_by', 'rotation_days']);
const allowedSensitivity = new Set(['public', 'internal', 'critical']);
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'coverage', '.next', '.vercel', 'artifacts']);
const ignoredPrefixes = ['docs/', 'config/secret-inventory.json', 'supabase/migrations/20260727090000_d3vonn_secrets_vault.sql'];
const scannedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.sh', '.yml', '.yaml', '.json', '.toml', '.tf', '.sql', '.mdx']);

const violations = [];
const warnings = [];
const names = new Set();

if (catalog.policy?.stores_secret_values !== false) {
  violations.push('policy.stores_secret_values must be false');
}

for (const [index, record] of records.entries()) {
  const label = `records[${index}]`;
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    violations.push(`${label} must be an object`);
    continue;
  }

  for (const field of Object.keys(record)) {
    if (!allowedFields.has(field)) violations.push(`${label} contains disallowed field: ${field}`);
  }

  if (!record.name || typeof record.name !== 'string') violations.push(`${label}.name is required`);
  if (names.has(record.name)) violations.push(`duplicate secret name: ${record.name}`);
  names.add(record.name);

  if (!record.platform || !record.environment) violations.push(`${record.name || label} is missing platform/environment`);
  if (!allowedSensitivity.has(record.sensitivity)) violations.push(`${record.name || label} has invalid sensitivity`);
  if (!Array.isArray(record.used_by)) violations.push(`${record.name || label}.used_by must be an array`);
  if (record.rotation_days !== null && (!Number.isInteger(record.rotation_days) || record.rotation_days <= 0)) {
    violations.push(`${record.name || label}.rotation_days must be null or a positive integer`);
  }
  if (record.name?.startsWith('VITE_') && record.sensitivity !== 'public') {
    violations.push(`${record.name} is browser-exposed but not classified public`);
  }
}

function walk(directory, relative = '') {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    const rel = path.posix.join(relative, entry.name);
    if (ignoredPrefixes.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))) continue;
    if (entry.isDirectory()) files.push(...walk(absolute, rel));
    else if (scannedExtensions.has(path.extname(entry.name)) || entry.name === 'Dockerfile') files.push({ absolute, rel });
  }
  return files;
}

const files = walk(root);
const reportRecords = records.map((record) => {
  const references = [];
  let count = 0;
  const pattern = new RegExp(`\\b${record.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');

  for (const file of files) {
    let content;
    try {
      content = fs.readFileSync(file.absolute, 'utf8');
    } catch {
      continue;
    }
    const matches = content.match(pattern);
    if (!matches?.length) continue;
    count += matches.length;
    references.push(file.rel);
  }

  if (count === 0) warnings.push(`${record.name} has no repository references`);
  return { ...record, reference_count: count, reference_files: references.sort() };
});

const report = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  catalog_version: catalog.version,
  scanned_file_count: files.length,
  record_count: records.length,
  violation_count: violations.length,
  warning_count: warnings.length,
  violations,
  warnings,
  records: reportRecords,
};

if (outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
}

async function syncReferenceMetadata() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('WARN Supabase metadata sync skipped because SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is unavailable.');
    return { attempted: false, updated: 0, failed: 0 };
  }

  let updated = 0;
  let failed = 0;
  const scannedAt = report.generated_at;

  for (const record of reportRecords) {
    const endpoint = new URL('/rest/v1/secret_inventory', supabaseUrl);
    endpoint.searchParams.set('name', `eq.${record.name}`);
    endpoint.searchParams.set('platform', `eq.${record.platform}`);
    endpoint.searchParams.set('environment', `eq.${record.environment}`);

    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        'content-type': 'application/json',
        prefer: 'return=minimal',
      },
      body: JSON.stringify({
        reference_count: record.reference_count,
        reference_files: record.reference_files,
        last_reference_scan_at: scannedAt,
      }),
    });

    if (response.ok) {
      updated += 1;
      continue;
    }

    failed += 1;
    const responseText = await response.text();
    console.error(`ERROR Failed to sync ${record.name}: HTTP ${response.status} ${responseText.slice(0, 300)}`);
  }

  return { attempted: true, updated, failed };
}

console.log(`Secret inventory audit: ${records.length} records, ${files.length} files scanned`);
console.log(`Policy violations: ${violations.length}`);
console.log(`Potentially unused records: ${warnings.length}`);
for (const violation of violations) console.error(`ERROR ${violation}`);
for (const warning of warnings) console.warn(`WARN ${warning}`);

let syncResult = { attempted: false, updated: 0, failed: 0 };
if (syncSupabase) {
  syncResult = await syncReferenceMetadata();
  console.log(`Supabase metadata sync: ${syncResult.attempted ? `${syncResult.updated} updated, ${syncResult.failed} failed` : 'skipped'}`);
}

console.log('No secret values were read or printed.');

if ((strict && violations.length > 0) || syncResult.failed > 0) process.exit(1);
