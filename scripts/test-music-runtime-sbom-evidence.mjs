#!/usr/bin/env node

import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = await mkdtemp(path.join(tmpdir(), 'music-sbom-'));
const sbomPath = path.join(dir, 'sbom.json');
const outPath = path.join(dir, 'evidence.json');
const sbom = {
  bomFormat: 'CycloneDX', specVersion: '1.6', version: 1,
  components: [
    { type: 'library', name: 'torch', version: '2.8.0', purl: 'pkg:pypi/torch@2.8.0', licenses: [{ license: { id: 'BSD-3-Clause' } }] },
    { type: 'library', name: 'unknown-runtime-piece', version: '1.0.0' }
  ]
};
await writeFile(sbomPath, JSON.stringify(sbom));

const image = `registry.example.invalid/ace-step@sha256:${'a'.repeat(64)}`;
const run = (extra = []) => spawnSync(process.execPath, ['scripts/music-runtime-sbom-evidence.mjs', '--provider', 'ace-step-1.5', '--image-ref', image, '--sbom', sbomPath, ...extra], { encoding: 'utf8' });

const ok = run(['--out', outPath]);
if (ok.status !== 0) throw new Error(ok.stderr || 'valid SBOM evidence generation failed');
const evidence = JSON.parse(await readFile(outPath, 'utf8'));
if (evidence.component_count !== 2 || evidence.unresolved_license_count !== 1) throw new Error('unexpected component/license counts');
if (evidence.review_status !== 'PENDING_REVIEW') throw new Error('tool must never auto-approve license evidence');

const mutable = spawnSync(process.execPath, ['scripts/music-runtime-sbom-evidence.mjs', '--provider', 'ace-step-1.5', '--image-ref', 'registry.example.invalid/ace-step:latest', '--sbom', sbomPath], { encoding: 'utf8' });
if (mutable.status === 0) throw new Error('mutable image reference was accepted');

const overwrite = run(['--out', outPath]);
if (overwrite.status === 0) throw new Error('existing evidence was overwritten');

console.log('music runtime SBOM evidence self-test passed');
