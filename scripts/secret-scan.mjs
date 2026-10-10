#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ignoredDirs = new Set([
  '.git', 'node_modules', 'dist', 'build', '.next', '.vercel', 'coverage',
  'benchmark-artifacts', '.turbo', '.cache', 'storybook-static'
]);
const virtualEnvironmentDirPattern = /^\.?venv.*$/;
const ignoredFiles = new Set(['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock']);
const fixtureFiles = new Set([
  '.env.example',
  '.gitleaks.toml',
  'hermes/tests/hermes.test.cjs',
  // The scanner contains literal detector patterns and must not scan itself.
  'scripts/secret-scan.mjs',
]);
const allowedExtensions = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.yml', '.yaml', '.env',
  '.example', '.md', '.py', '.toml', '.ini', '.sh', '.txt'
]);

const patterns = [
  { name: 'OpenAI key', regex: /sk-[A-Za-z0-9_-]{20,}/g },
  { name: 'Anthropic key', regex: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { name: 'AWS access key', regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'GitHub token', regex: /gh[pousr]_[A-Za-z0-9_]{30,}/g },
  { name: 'Pinecone key', regex: /pcsk_[A-Za-z0-9_-]{20,}/g },
  { name: 'JWT token', regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { name: 'Private key block', regex: /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/g },
];

function shouldScan(filePath) {
  const relative = path.relative(root, filePath).split(path.sep).join('/');
  const base = path.basename(filePath);
  if (ignoredFiles.has(base) || fixtureFiles.has(relative)) return false;
  if (base.startsWith('.env')) return true;
  const ext = path.extname(filePath);
  return allowedExtensions.has(ext) || [...allowedExtensions].some((suffix) => filePath.endsWith(suffix));
}

function isPlaceholder(line) {
  return /example|placeholder|dummy|fake|test-only|your[_-]?key|changeme|redacted/i.test(line);
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name) && !virtualEnvironmentDirPattern.test(entry.name)) {
        walk(path.join(dir, entry.name), files);
      }
      continue;
    }
    const filePath = path.join(dir, entry.name);
    if (shouldScan(filePath)) files.push(filePath);
  }
  return files;
}

const findings = [];
for (const filePath of walk(root)) {
  const relative = path.relative(root, filePath);
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    continue;
  }
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (isPlaceholder(line)) return;
    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(line)) {
        findings.push({ file: relative, line: index + 1, type: pattern.name });
      }
    }
  });
}

if (findings.length > 0) {
  console.error('Secret scan failed. Potential committed secrets found:');
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.type}`);
  }
  process.exit(1);
}

console.log('Secret scan passed. No high-confidence secrets found.');
