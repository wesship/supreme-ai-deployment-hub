import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifest = path.join(root, 'docs/marketplace/agent-manifest.schema.json');
const governance = path.join(root, 'docs/marketplace/governance.md');
const ecosystem = path.join(root, 'src/data/verifiedMarketplaceEcosystem.ts');
const errors = [];

for (const file of [manifest, governance, ecosystem]) if (!fs.existsSync(file)) errors.push(`missing required Marketplace governance file: ${file}`);

if (fs.existsSync(manifest)) {
  const schema = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  for (const key of ['schemaVersion', 'publisher', 'capabilities', 'permissions', 'dependencies', 'integrations', 'dataRequirements', 'updatePolicy', 'rollbackSupported']) {
    if (!schema.required?.includes(key)) errors.push(`manifest schema missing required property: ${key}`);
  }
  if (schema.properties?.schemaVersion?.const !== '1.0') errors.push('unsupported Marketplace manifest schema version');
}

if (fs.existsSync(ecosystem)) {
  const source = fs.readFileSync(ecosystem, 'utf8');
  if (!source.includes('canonicalAgents.length !== 16')) errors.push('canonical 16-agent integrity assertion missing');
  if (!source.includes('Duplicate Marketplace agent IDs')) errors.push('duplicate-agent integrity assertion missing');
  if (!source.includes('featured')) errors.push('featured metadata missing');
}

if (errors.length) {
  console.error('Marketplace governance check FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Marketplace governance check PASSED');
console.log('- manifest schema present and required fields declared');
console.log('- governance policy present');
console.log('- canonical 16-agent integrity assertions present');
console.log('- duplicate and featured metadata checks present');
