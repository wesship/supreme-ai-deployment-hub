import fs from 'node:fs';
import process from 'node:process';

const inventoryPath = process.argv[2] ?? 'config/required-secrets.json';
const environment = process.argv[3] ?? 'production';
const scope = process.argv[4] ?? 'github';

const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
const required = inventory?.environments?.[environment]?.[scope];

if (!Array.isArray(required)) {
  console.error(`Unknown secret inventory scope: ${environment}.${scope}`);
  process.exit(2);
}

const missing = required.filter((name) => !process.env[name]?.trim());
const present = required.filter((name) => process.env[name]?.trim());

console.log(`Secret preflight: ${environment}.${scope}`);
console.log(`Present: ${present.length}/${required.length}`);

for (const name of required) {
  console.log(`${process.env[name]?.trim() ? 'OK' : 'MISSING'} ${name}`);
}

if (missing.length > 0) {
  console.error(`Missing required secrets: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('All required secret names are populated. Values were not printed.');
