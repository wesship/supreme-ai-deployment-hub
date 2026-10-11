import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function verifyApprovedIcons(root = defaultRoot, log = console.log) {
  const css = readFileSync(path.join(root, 'src/styles/approved-icons.css'), 'utf8');
  const manifest = JSON.parse(readFileSync(path.join(root, 'config/approved-icons-manifest.json'), 'utf8'));
  const codes = [...new Set([...css.matchAll(/content:"\\([0-9a-fA-F]+)"/g)].map((match) => match[1].toLowerCase()))].sort();
  if (JSON.stringify(codes) !== JSON.stringify(manifest.unicodes)) {
    throw new Error('Approved icon CSS changed; regenerate the font with scripts/subset-approved-icons.py.');
  }
  const font = readFileSync(path.join(root, manifest.output));
  if (!css.includes(`url('/${manifest.output.replace(/^public\//, '')}')`)) {
    throw new Error('Approved icon CSS must load the verified subset font.');
  }
  if (createHash('sha256').update(font).digest('hex') !== manifest.sha256) {
    throw new Error('Approved icon font does not match its verified manifest.');
  }
  const declared = new Set([...css.matchAll(/\.(ri-[\w-]+):before/g)].map((match) => match[1]));
  const folder = path.join(root, 'src/components/sovereign/approved');
  for (const file of readdirSync(folder).filter((file) => file.endsWith('.tsx') && !file.endsWith('.test.tsx'))) {
    for (const [icon] of readFileSync(path.join(folder, file), 'utf8').matchAll(/\bri-[\w-]+/g)) {
      if (!declared.has(icon)) throw new Error(`${file} references an undeclared approved icon: ${icon}`);
    }
  }
  log(`Approved icon subset verified (${codes.length} glyphs, ${font.byteLength} bytes).`);
}
