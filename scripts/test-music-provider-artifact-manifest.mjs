#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const tmp = await mkdtemp(path.join(os.tmpdir(), 'd3vonn-music-manifest-'));
const root = path.join(tmp, 'artifacts');
await mkdir(path.join(root, 'weights'), { recursive: true });
await writeFile(path.join(root, 'config.json'), '{"model":"fixture"}\n');
await writeFile(path.join(root, 'weights', 'model.safetensors'), 'fixture-weights');

function run() {
  const result = spawnSync(process.execPath, [
    'scripts/music-provider-artifact-manifest.mjs',
    '--provider', 'ace-step-1.5',
    '--root', root,
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

try {
  const first = run();
  const second = run();
  assert.equal(first.aggregate_sha256, second.aggregate_sha256, 'same artifacts must produce same aggregate');
  assert.equal(first.file_count, 2);
  assert.match(first.aggregate_sha256, /^[0-9a-f]{64}$/);
  assert.match(first.source_revision, /^[0-9a-f]{40}$/);
  assert.match(first.model_revision, /^[0-9a-f]{40}$/);

  await writeFile(path.join(root, 'weights', 'model.safetensors'), 'changed-fixture-weights');
  const changed = run();
  assert.notEqual(first.aggregate_sha256, changed.aggregate_sha256, 'artifact mutation must change aggregate');

  const out = path.join(tmp, 'manifest.json');
  const written = spawnSync(process.execPath, [
    'scripts/music-provider-artifact-manifest.mjs', '--provider', 'ace-step-1.5', '--root', root, '--out', out,
  ], { encoding: 'utf8' });
  assert.equal(written.status, 0, written.stderr);
  const persisted = JSON.parse(await readFile(out, 'utf8'));
  assert.equal(persisted.aggregate_sha256, changed.aggregate_sha256);

  const overwrite = spawnSync(process.execPath, [
    'scripts/music-provider-artifact-manifest.mjs', '--provider', 'ace-step-1.5', '--root', root, '--out', out,
  ], { encoding: 'utf8' });
  assert.notEqual(overwrite.status, 0, 'existing evidence file must not be overwritten');

  console.log('music artifact manifest self-test passed');
} finally {
  await rm(tmp, { recursive: true, force: true });
}
