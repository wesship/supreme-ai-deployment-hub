#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { lstat, readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SHA40 = /^[0-9a-f]{40}$/i;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for --${key}`);
    args[key] = value;
    i += 1;
  }
  return args;
}

async function sha256File(filePath) {
  const data = await readFile(filePath);
  return createHash('sha256').update(data).digest('hex');
}

async function collectFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(current, entry.name);
    const logical = path.relative(root, absolute).split(path.sep).join('/');
    if (entry.isDirectory()) {
      files.push(...await collectFiles(root, absolute));
      continue;
    }
    if (entry.isSymbolicLink()) {
      const target = await realpath(absolute);
      const targetStat = await stat(target);
      if (!targetStat.isFile()) throw new Error(`symlink must resolve to a file: ${logical}`);
      files.push({ logical, absolute, size: targetStat.size });
      continue;
    }
    if (entry.isFile()) {
      const fileStat = await lstat(absolute);
      files.push({ logical, absolute, size: fileStat.size });
    }
  }
  return files;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.provider || !args.root) {
    throw new Error('usage: node scripts/music-provider-artifact-manifest.mjs --provider <id> --root <artifact-dir> [--out <manifest.json>]');
  }

  const root = path.resolve(args.root);
  const rootStat = await stat(root);
  if (!rootStat.isDirectory()) throw new Error('--root must be a directory');

  if (args.out) {
    const output = path.resolve(args.out);
    const relativeOutput = path.relative(root, output);
    if (relativeOutput === '' || (!relativeOutput.startsWith('..') && !path.isAbsolute(relativeOutput))) {
      throw new Error('--out must be outside the artifact root so the manifest cannot hash itself');
    }
  }

  const registry = JSON.parse(await readFile('config/music/providers.json', 'utf8'));
  const provider = registry.providers?.find((candidate) => candidate.id === args.provider);
  if (!provider) throw new Error(`unknown provider: ${args.provider}`);
  if (!SHA40.test(provider.source_revision ?? '')) throw new Error('provider source_revision is not an immutable 40-hex commit');
  if (!SHA40.test(provider.model_revision ?? '')) throw new Error('provider model_revision is not an immutable 40-hex commit');

  const files = await collectFiles(root);
  if (files.length === 0) throw new Error('artifact root contains no files');

  const hashed = [];
  for (const file of files.sort((a, b) => a.logical.localeCompare(b.logical))) {
    hashed.push({
      path: file.logical,
      size_bytes: file.size,
      sha256: await sha256File(file.absolute),
    });
  }

  const canonical = hashed.map((file) => `${file.sha256}  ${file.size_bytes}  ${file.path}\n`).join('');
  const aggregate = createHash('sha256').update(canonical, 'utf8').digest('hex');
  const manifest = {
    schema_version: 1,
    provider_id: provider.id,
    source_revision: provider.source_revision,
    model_revision: provider.model_revision,
    artifact_root_basename: path.basename(root),
    file_count: hashed.length,
    aggregate_sha256: aggregate,
    files: hashed,
  };

  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  if (args.out) {
    await writeFile(path.resolve(args.out), serialized, { flag: 'wx' });
  } else {
    process.stdout.write(serialized);
  }
}

main().catch((error) => {
  console.error(`music artifact manifest failed: ${error.message}`);
  process.exitCode = 1;
});
