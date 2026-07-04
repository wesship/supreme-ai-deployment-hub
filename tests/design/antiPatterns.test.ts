import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const indexPath = path.join(root, 'src/pages/Index.tsx');
const designPath = path.join(root, 'design.md');
const rulesPath = path.join(root, 'tests/fixtures/design-rules.json');

const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8')) as {
  requiredBrandTerms: string[];
  bannedHomepageWords: string[];
  maxHomepageTextCenterCount: number;
  maxHomepageBackdropBlurXlCount: number;
};

const read = (filePath: string) => fs.readFileSync(filePath, 'utf8');
const count = (content: string, token: string) => (content.match(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;

describe('D3VONN visual operating system', () => {
  const homepage = read(indexPath);
  const design = read(designPath);

  it('keeps the public homepage grounded in D3VONN architecture terms', () => {
    const missing = rules.requiredBrandTerms.filter((term) => !homepage.toLowerCase().includes(term.toLowerCase()));
    expect(missing).toEqual([]);
  });

  it('keeps generic AI marketing filler out of the homepage', () => {
    const violations = rules.bannedHomepageWords.filter((term) => homepage.toLowerCase().includes(term.toLowerCase()));
    expect(violations).toEqual([]);
  });

  it('does not rebuild the homepage as a centered generic SaaS page', () => {
    expect(count(homepage, 'text-center')).toBeLessThanOrEqual(rules.maxHomepageTextCenterCount);
    expect(count(homepage, 'backdrop-blur-xl')).toBeLessThanOrEqual(rules.maxHomepageBackdropBlurXlCount);
    expect(homepage).not.toContain('grid-cols-3');
    expect(homepage).not.toContain('lucide-react');
  });

  it('keeps design.md as the design authority split from CLAUDE.md', () => {
    expect(design).toContain('Visual Operating System');
    expect(design).toContain('Level 3 Design Testing');
    expect(design).toContain('Self-Refinement Rule');
  });
});
