const fs = require('node:fs');
const path = require('node:path');

const workflowDir = path.resolve('.github/workflows');
const allowed = new Set(['required-pr-gate.yml']);
const files = fs.readdirSync(workflowDir).filter((file) => /\.ya?ml$/i.test(file)).sort();
const automatic = [];

for (const file of files) {
  const source = fs.readFileSync(path.join(workflowDir, file), 'utf8');
  const lines = source.split(/\r?\n/);
  let inOn = false;
  let hasPullRequest = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const indent = line.length - line.trimStart().length;
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (indent === 0 && /^on\s*:/.test(trimmed)) {
      inOn = true;
      if (/pull_request/.test(trimmed)) hasPullRequest = true;
      continue;
    }

    if (inOn && indent === 0) inOn = false;
    if (inOn && /^pull_request(?:_target)?\s*:/.test(trimmed)) hasPullRequest = true;
  }

  if (hasPullRequest) automatic.push(file);
}

const unauthorized = automatic.filter((file) => !allowed.has(file));
console.log(`Workflow files scanned: ${files.length}`);
console.log(`Automatic pull-request workflows: ${automatic.length}`);
for (const file of automatic) console.log(` - ${file}`);

if (unauthorized.length) {
  console.error('\nOnly required-pr-gate.yml may run automatically on every pull request.');
  console.error('Unauthorized workflows:');
  for (const file of unauthorized) console.error(` - ${file}`);
  process.exit(1);
}
