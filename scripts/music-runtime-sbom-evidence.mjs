#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const IMAGE_DIGEST = /@sha256:([0-9a-f]{64})$/i;
const SHA40 = /^[0-9a-f]{40}$/i;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith('--') || !value || value.startsWith('--')) throw new Error('arguments must be --key value pairs');
    args[key.slice(2)] = value;
  }
  return args;
}

function licensesFor(component) {
  const values = [];
  for (const entry of component.licenses ?? []) {
    if (entry?.license?.id) values.push(entry.license.id);
    else if (entry?.license?.name) values.push(entry.license.name);
    else if (entry?.expression) values.push(entry.expression);
  }
  return [...new Set(values.map(String).map((v) => v.trim()).filter(Boolean))].sort();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.provider || !args['image-ref'] || !args.sbom) {
    throw new Error('usage: node scripts/music-runtime-sbom-evidence.mjs --provider <id> --image-ref <image@sha256:digest> --sbom <cyclonedx.json> [--out <evidence.json>]');
  }
  const imageMatch = args['image-ref'].match(IMAGE_DIGEST);
  if (!imageMatch) throw new Error('--image-ref must be immutable and end with @sha256:<64-hex>');

  const registry = JSON.parse(await readFile('config/music/providers.json', 'utf8'));
  const provider = registry.providers?.find((candidate) => candidate.id === args.provider);
  if (!provider) throw new Error(`unknown provider: ${args.provider}`);
  if (!SHA40.test(provider.source_revision ?? '') || !SHA40.test(provider.model_revision ?? '')) {
    throw new Error('provider source/model revisions must be immutable 40-hex commits');
  }

  const sbomBytes = await readFile(path.resolve(args.sbom));
  const sbom = JSON.parse(sbomBytes.toString('utf8'));
  if (sbom.bomFormat !== 'CycloneDX') throw new Error('SBOM must use CycloneDX format');
  if (!Array.isArray(sbom.components) || sbom.components.length === 0) throw new Error('SBOM contains no components');

  const components = sbom.components.map((component) => ({
    type: String(component.type ?? ''),
    name: String(component.name ?? ''),
    version: String(component.version ?? ''),
    purl: component.purl ? String(component.purl) : null,
    licenses: licensesFor(component),
  })).sort((a, b) => `${a.purl ?? ''}|${a.name}|${a.version}`.localeCompare(`${b.purl ?? ''}|${b.name}|${b.version}`));

  if (components.some((component) => !component.name)) throw new Error('every SBOM component must have a name');
  const unresolved = components.filter((component) => component.licenses.length === 0);
  const evidence = {
    schema_version: 1,
    provider_id: provider.id,
    source_revision: provider.source_revision,
    model_revision: provider.model_revision,
    runtime_image_ref: args['image-ref'],
    runtime_image_sha256: imageMatch[1].toLowerCase(),
    sbom_format: 'CycloneDX',
    sbom_sha256: createHash('sha256').update(sbomBytes).digest('hex'),
    component_count: components.length,
    unresolved_license_count: unresolved.length,
    unresolved_license_components: unresolved.map(({ name, version, purl }) => ({ name, version, purl })),
    components,
    review_status: 'PENDING_REVIEW'
  };

  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  if (args.out) await writeFile(path.resolve(args.out), serialized, { flag: 'wx' });
  else process.stdout.write(serialized);
}

main().catch((error) => {
  console.error(`music runtime SBOM evidence failed: ${error.message}`);
  process.exitCode = 1;
});
