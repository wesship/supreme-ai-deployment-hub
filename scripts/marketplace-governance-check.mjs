import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'docs/marketplace/agent-manifest.schema.json',
  'docs/marketplace/governance.md',
  'src/data/verifiedMarketplaceEcosystem.ts',
  'src/data/marketplaceWorkforceBundles.ts',
  'src/data/marketplaceSandboxPolicy.ts',
];
const errors = [];
for (const relative of required) if (!fs.existsSync(path.join(root, relative))) errors.push(`missing required Marketplace governance file: ${relative}`);

const manifestPath = path.join(root, 'docs/marketplace/agent-manifest.schema.json');
if (fs.existsSync(manifestPath)) {
  const schema = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const key of ['schemaVersion', 'publisher', 'capabilities', 'permissions', 'dependencies', 'integrations', 'dataRequirements', 'updatePolicy', 'rollbackSupported']) if (!schema.required?.includes(key)) errors.push(`manifest schema missing required property: ${key}`);
  if (schema.properties?.schemaVersion?.const !== '1.0') errors.push('unsupported Marketplace manifest schema version');
}

const ecosystemPath = path.join(root, 'src/data/verifiedMarketplaceEcosystem.ts');
if (fs.existsSync(ecosystemPath)) {
  const source = fs.readFileSync(ecosystemPath, 'utf8');
  for (const assertion of ['canonicalAgents.length !== 16', 'Duplicate Marketplace agent IDs', 'featured']) if (!source.includes(assertion)) errors.push(`ecosystem integrity assertion missing: ${assertion}`);
}

const bundlePath = path.join(root, 'src/data/marketplaceWorkforceBundles.ts');
if (fs.existsSync(bundlePath)) {
  const source = fs.readFileSync(bundlePath, 'utf8');
  if (!source.includes('unknown agents')) errors.push('bundle unknown-agent guard missing');
  if (!source.includes("verification: 'verified'")) errors.push('bundle verification status missing');
}

const sandboxPath = path.join(root, 'src/data/marketplaceSandboxPolicy.ts');
if (fs.existsSync(sandboxPath)) {
  const source = fs.readFileSync(sandboxPath, 'utf8');
  for (const invariant of ['productionAccess: false', 'testDataOnly: true', 'boundedPermissions: true', 'explicitPromotionRequired: true', 'auditEvents: true']) if (!source.includes(invariant)) errors.push(`sandbox safety invariant missing: ${invariant}`);
}

if (errors.length) {
  console.error('Marketplace governance check FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Marketplace governance check PASSED');
