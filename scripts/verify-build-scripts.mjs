#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const packageJsonPath = resolve(root, 'package.json');

if (!existsSync(packageJsonPath)) {
  console.error('❌ package.json was not found.');
  process.exit(1);
}

let packageJson;
try {
  packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
} catch (error) {
  console.error('❌ package.json could not be parsed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const scripts = packageJson.scripts ?? {};
const rootScript = 'vercel-build';
const visited = new Set();
const referencedFiles = new Set();
const missingPackageScripts = new Set();

function inspectCommand(command) {
  if (typeof command !== 'string') return;

  const nodeScriptPattern = /(?:^|[\s;&|])node\s+(?:"([^"]+\.m?js)"|'([^']+\.m?js)'|([^\s;&|]+\.m?js))/g;
  for (const match of command.matchAll(nodeScriptPattern)) {
    const scriptPath = match[1] ?? match[2] ?? match[3];
    if (scriptPath) referencedFiles.add(scriptPath);
  }

  const packageScriptPattern = /(?:pnpm\s+(?:run\s+)?|npm\s+run\s+|yarn\s+)([A-Za-z0-9:_-]+)/g;
  for (const match of command.matchAll(packageScriptPattern)) {
    const referencedScript = match[1];
    if (referencedScript && referencedScript !== rootScript && !visited.has(referencedScript)) {
      inspectPackageScript(referencedScript);
    }
  }
}

function inspectPackageScript(scriptName) {
  if (visited.has(scriptName)) return;
  visited.add(scriptName);

  const command = scripts[scriptName];
  if (typeof command !== 'string') {
    missingPackageScripts.add(scriptName);
    return;
  }
  inspectCommand(command);
}

inspectPackageScript(rootScript);

let failed = false;
for (const scriptName of [...missingPackageScripts].sort()) {
  console.error(`❌ Missing package.json script: "${scriptName}" referenced by "${rootScript}"`);
  failed = true;
}

for (const relativePath of [...referencedFiles].sort()) {
  const fullPath = resolve(root, relativePath);
  if (existsSync(fullPath)) {
    console.log(`✅ ${relativePath}`);
  } else {
    console.error(`❌ Missing file: ${relativePath}`);
    failed = true;
  }
}

if (referencedFiles.size === 0) {
  console.log('ℹ️ No direct Node script files were referenced.');
}

if (failed) {
  console.error('\nVercel deployment validation failed. Restore the missing scripts or update package.json.');
  process.exit(1);
}

console.log('\n✅ All package.json build scripts and referenced files are present.');
