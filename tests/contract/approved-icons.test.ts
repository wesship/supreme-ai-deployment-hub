import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { verifyApprovedIcons } from '../../scripts/verify-approved-icons.mjs';

describe('Approved icon build guard', () => {
  let root: string;
  const css = "@font-face{src:url('/approved-home/subset.woff2')}\n.approved-home .ri-check-line:before{content:\"\\eb7b\"}";
  const write = (file: string, content: string) => writeFileSync(path.join(root, file), content);

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'approved-icons-'));
    for (const folder of ['config', 'src/styles', 'public/approved-home', 'src/components/sovereign/approved']) {
      mkdirSync(path.join(root, folder), { recursive: true });
    }
    write('src/styles/approved-icons.css', css);
    write('public/approved-home/subset.woff2', 'verified-font-fixture');
    write('src/components/sovereign/approved/Fixture.tsx', '<i className="ri-check-line" />');
    write('config/approved-icons-manifest.json', JSON.stringify({
      output: 'public/approved-home/subset.woff2', unicodes: ['eb7b'],
      sha256: createHash('sha256').update('verified-font-fixture').digest('hex'),
    }));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('accepts consistent assets and blocks new CSS glyphs until regeneration', () => {
    expect(() => verifyApprovedIcons(root, () => {})).not.toThrow();
    write('src/styles/approved-icons.css', `${css}\n.ri-menu-line:before{content:"\\ef32"}`);
    expect(() => verifyApprovedIcons(root, () => {})).toThrow('regenerate the font');
  });

  it('rejects modified font bytes and a CSS URL pointing to the full font', () => {
    write('public/approved-home/subset.woff2', 'modified-font');
    expect(() => verifyApprovedIcons(root, () => {})).toThrow('verified manifest');
    write('src/styles/approved-icons.css', css.replace('subset.woff2', 'original.woff2'));
    expect(() => verifyApprovedIcons(root, () => {})).toThrow('verified subset font');
  });

  it('rejects component icons with missing CSS mappings', () => {
    write('src/components/sovereign/approved/Fixture.tsx', '<i className="ri-information-line" />');
    expect(() => verifyApprovedIcons(root, () => {})).toThrow('undeclared approved icon');
  });
});
