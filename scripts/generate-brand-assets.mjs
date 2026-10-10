import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const sourceDir = resolve(root, 'brand-assets');
const outputDir = resolve(root, 'public');

const parts = await Promise.all([
  readFile(resolve(sourceDir, 'logo.part0.b64'), 'utf8'),
  readFile(resolve(sourceDir, 'logo.part1.b64'), 'utf8'),
  readFile(resolve(sourceDir, 'logo.part2.b64'), 'utf8'),
]);

const encoded = parts.map((part) => part.trim()).join('');
const image = Buffer.from(encoded, 'base64');

if (image.subarray(0, 4).toString('ascii') !== 'RIFF' || image.subarray(8, 12).toString('ascii') !== 'WEBP') {
  throw new Error('Generated D3VONN.IO logo is not a valid WebP asset.');
}

await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, 'd3vonn-logo.webp'), image);

console.log(`Generated public/d3vonn-logo.webp (${image.length} bytes).`);
