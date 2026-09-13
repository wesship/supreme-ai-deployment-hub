import { describe, expect, it } from 'vitest';
import {
  classifyReaddySourceFile,
  scanReaddySourceText,
  summarizeReaddyQuarantine,
} from './quarantinePolicy';

const marketingPages = [
  'src/pages/Index.tsx',
  'src/pages/Solutions.tsx',
  'src/pages/AIAgents.tsx',
  'src/pages/Pricing.tsx',
  'src/pages/About.tsx',
  'src/pages/Resources.tsx',
];

describe('Readdy raw-export quarantine policy', () => {
  it.each(marketingPages)('admits %s only as a transplant candidate', (path) => {
    expect(classifyReaddySourceFile(path).disposition).toBe('transplant-candidate');
  });

  it.each([
    'src/index.css',
    'tailwind.config.ts',
    'src/components/marketing/Hero.tsx',
    'src/assets/readdy-hero.webp',
    'public/readdy/hero.webp',
  ])('requires manual review for shared presentation material: %s', (path) => {
    expect(classifyReaddySourceFile(path).disposition).toBe('manual-review');
  });

  it.each([
    'src/App.tsx',
    'src/main.tsx',
    'backend/app/main.py',
    'src/components/auth/AdminRoute.tsx',
    'src/contexts/AuthContext.tsx',
    'supabase/functions/admin-overview/index.ts',
    'supabase/migrations/20260913000000_readdy.sql',
    '.github/workflows/deploy.yml',
    'package.json',
    'pnpm-lock.yaml',
    'vercel.json',
    '.env.production',
    'src/pages/Admin.tsx',
    'src/pages/MoneyHub.tsx',
  ])('rejects protected/runtime authority: %s', (path) => {
    expect(classifyReaddySourceFile(path).disposition).toBe('reject');
  });

  it('fails closed for unknown files', () => {
    const decision = classifyReaddySourceFile('src/pages/NewReaddyProduct.tsx');
    expect(decision.disposition).toBe('reject');
    expect(decision.reasons[0]).toContain('fail closed');
  });

  it('rejects source containing likely secrets even when the path is otherwise allowed', () => {
    const decision = classifyReaddySourceFile(
      'src/pages/Index.tsx',
      `const token = "sk-proj-${'a'.repeat(32)}";`,
    );

    expect(decision.disposition).toBe('reject');
    expect(decision.findings.map(({ id }) => id)).toContain('openai-style-secret');
  });

  it('detects service-role references and embedded credential assignments', () => {
    const findings = scanReaddySourceText(
      `SUPABASE_SERVICE_ROLE_KEY\nAPI_KEY = "this-is-a-real-looking-secret"`,
    );

    expect(findings.map(({ id }) => id)).toEqual(
      expect.arrayContaining(['supabase-service-role', 'credential-assignment']),
    );
  });

  it('summarizes quarantine outcomes deterministically', () => {
    const summary = summarizeReaddyQuarantine([
      { path: 'src/pages/Index.tsx' },
      { path: 'src/components/marketing/Hero.tsx' },
      { path: 'backend/app/main.py' },
    ]);

    expect(summary.counts).toEqual({
      transplantCandidate: 1,
      manualReview: 1,
      reject: 1,
    });
  });
});
