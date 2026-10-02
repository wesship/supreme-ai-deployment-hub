import { readFileSync } from 'node:fs';

if (process.argv.includes('--security')) {
  const security = JSON.parse(readFileSync('coverage/backend-security.json', 'utf8'));
  for (const file of ['backend/app/security/approval_execution.py', 'backend/middleware/rate_limit.py',
    'backend/occ_operator/public_stats_router.py']) {
    const pct = security.files?.[file]?.summary?.percent_covered;
    if (typeof pct !== 'number' || !Number.isFinite(pct) || pct < 90) {
      throw new Error(`${file}: ${pct ?? 'missing'}%; required 90%`);
    }
  }
  console.log('Each security boundary module meets 90% coverage.');
  process.exit(0);
}

const summary = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'));
const thresholds = { lines: 9, functions: 8, branches: 7, statements: 9 };
for (const [metric, minimum] of Object.entries(thresholds)) {
  const actual = summary.total?.[metric]?.pct;
  if (typeof actual !== 'number' || !Number.isFinite(actual) || actual < minimum) {
    throw new Error(`Coverage ${metric}: ${actual ?? 'missing'}%; required ${minimum}%`);
  }
}
console.log('Coverage baseline enforced. Security boundary coverage separately requires 90%.');
