import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const positional = args.filter((arg) => !arg.startsWith('--'));
const inventoryPath = positional[0] ?? 'config/required-secrets.json';
const environment = positional[1] ?? 'production';
const scope = positional[2] ?? 'github';
const allowMissing = args.includes('--allow-missing');
const outputArgument = args.find((arg) => arg.startsWith('--output='));
const outputPath = outputArgument?.slice('--output='.length);

const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
const required = inventory?.environments?.[environment]?.[scope];

if (!Array.isArray(required)) {
  console.error(`Unknown secret inventory scope: ${environment}.${scope}`);
  process.exit(2);
}

const records = required.map((name) => ({
  name,
  present: Boolean(process.env[name]?.trim()),
}));
const present = records.filter((record) => record.present);
const missing = records.filter((record) => !record.present);

const report = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  environment,
  scope,
  secret_values_included: false,
  record_count: records.length,
  present_count: present.length,
  missing_count: missing.length,
  records,
};

console.log(`Secret preflight: ${environment}.${scope}`);
console.log(`Present: ${present.length}/${records.length}`);

for (const record of records) {
  console.log(`${record.present ? 'PRESENT' : 'MISSING'} ${record.name}`);
}

if (outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Metadata-only report written to ${outputPath}`);
}

if (missing.length > 0 && !allowMissing) {
  console.error(`Missing required secret names: ${missing.map((record) => record.name).join(', ')}`);
  process.exit(1);
}

if (missing.length > 0) {
  console.warn(`Optional names not populated: ${missing.map((record) => record.name).join(', ')}`);
} else {
  console.log('All checked secret names are populated.');
}

console.log('Secret values were not printed or written to the report.');
