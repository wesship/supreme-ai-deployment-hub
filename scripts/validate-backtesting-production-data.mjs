import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('config/backtesting/production-data-certification.json', 'utf8'));
const failures = [];
const sha256 = /^(?:sha256:)?[0-9a-f]{64}$/i;

if (manifest.production_trading_enabled !== false) failures.push('production trading must remain disabled');

const evidence = manifest.evidence ?? {};
const requiredStrings = [
  'provider',
  'license_reference',
  'dataset_id',
  'universe_as_of',
  'corporate_action_policy',
  'exchange_calendar',
  'timezone_policy',
  'strategy_revision',
  'reviewer',
  'reviewed_at',
];

const requiredBooleans = [
  'includes_delisted',
  'no_lookahead_test',
  'survivorship_test',
  'transaction_cost_sensitivity',
  'parameter_sensitivity',
  'walk_forward_validation',
];

const passRequested = manifest.status === 'PASS' || manifest.research_qualification_enabled === true;

if (passRequested) {
  for (const key of requiredStrings) {
    if (typeof evidence[key] !== 'string' || evidence[key].trim() === '') failures.push(`${key}: required for PASS`);
  }
  for (const key of requiredBooleans) {
    if (evidence[key] !== true) failures.push(`${key}: must be true for PASS`);
  }
  if (!sha256.test(evidence.dataset_snapshot_sha256 ?? '')) failures.push('dataset_snapshot_sha256: valid SHA-256 required');
  if (!sha256.test(evidence.independent_fixture_sha256 ?? '')) failures.push('independent_fixture_sha256: valid SHA-256 required');
  if (!sha256.test(evidence.config_sha256 ?? '')) failures.push('config_sha256: valid SHA-256 required');
  if (Number.isNaN(Date.parse(evidence.reviewed_at ?? ''))) failures.push('reviewed_at: valid timestamp required');
}

if (!passRequested && manifest.status !== 'PENDING_EXTERNAL_DATA_EVIDENCE') {
  failures.push('incomplete certification must remain PENDING_EXTERNAL_DATA_EVIDENCE');
}

if (failures.length) {
  console.error('Backtesting production-data certification FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Backtesting production-data certification ${passRequested ? 'PASS' : 'PENDING (fail-closed)'}.`);
