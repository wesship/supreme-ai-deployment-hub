import {
  READDY_DESIGN_SYSTEM_HOSTS,
  READDY_TRANSPLANT_TARGETS,
} from './transplantManifest';

export type ReaddyQuarantineDisposition =
  | 'transplant-candidate'
  | 'manual-review'
  | 'reject';

export type ReaddyQuarantineFinding = {
  id: string;
  message: string;
};

export type ReaddyQuarantineDecision = {
  path: string;
  disposition: ReaddyQuarantineDisposition;
  reasons: string[];
  findings: ReaddyQuarantineFinding[];
};

const TRANSPLANT_PAGE_FILES = new Set(
  Object.values(READDY_TRANSPLANT_TARGETS).map(({ pageFile }) => pageFile),
);

const DESIGN_SYSTEM_HOSTS = new Set<string>(READDY_DESIGN_SYSTEM_HOSTS);

const REJECT_EXACT_PATHS = new Set([
  'src/App.tsx',
  'src/main.tsx',
  'package.json',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'vercel.json',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  'supabase/config.toml',
  '.env',
  '.env.local',
  '.env.production',
  '.env.staging',
]);

const REJECT_PREFIXES = [
  '.github/',
  'backend/',
  'api/',
  'server/',
  'infra/',
  'deploy/',
  'scripts/',
  'supabase/functions/',
  'supabase/migrations/',
  'src/components/auth/',
  'src/contexts/',
  'src/providers/',
  'src/integrations/supabase/',
  'src/lib/auth',
  'src/lib/api',
  'src/pages/Admin',
  'src/pages/Operations',
  'src/pages/Security',
  'src/pages/MoneyHub',
  'src/pages/OCC',
  'src/pages/Assurance',
  'public/.well-known/',
] as const;

const MANUAL_REVIEW_PREFIXES = [
  'src/components/',
  'src/assets/',
  'public/',
] as const;

const SECRET_PATTERNS: Array<{
  id: string;
  message: string;
  pattern: RegExp;
}> = [
  {
    id: 'private-key',
    message: 'Private-key material is not permitted in a Readdy export.',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  },
  {
    id: 'openai-style-secret',
    message: 'A secret-token pattern resembling an OpenAI key was detected.',
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  },
  {
    id: 'github-token',
    message: 'A GitHub token pattern was detected.',
    pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  },
  {
    id: 'supabase-service-role',
    message: 'A Supabase service-role credential reference was detected.',
    pattern: /\bSUPABASE_SERVICE_ROLE_KEY\b/i,
  },
  {
    id: 'credential-assignment',
    message: 'A likely embedded credential assignment was detected.',
    pattern:
      /\b(?:API_KEY|ACCESS_TOKEN|AUTH_TOKEN|SECRET|PASSWORD)\s*[:=]\s*["'][^"']{8,}["']/i,
  },
];

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

export function scanReaddySourceText(sourceText: string): ReaddyQuarantineFinding[] {
  if (!sourceText) return [];

  return SECRET_PATTERNS.flatMap(({ id, message, pattern }) =>
    pattern.test(sourceText) ? [{ id, message }] : [],
  );
}

export function classifyReaddySourceFile(
  rawPath: string,
  sourceText = '',
): ReaddyQuarantineDecision {
  const path = normalizePath(rawPath);
  const findings = scanReaddySourceText(sourceText);

  if (findings.length > 0) {
    return {
      path,
      disposition: 'reject',
      reasons: ['Secret-bearing source is rejected before any transplant review.'],
      findings,
    };
  }

  if (
    path.startsWith('.env.') ||
    REJECT_EXACT_PATHS.has(path) ||
    REJECT_PREFIXES.some((prefix) => path.startsWith(prefix))
  ) {
    return {
      path,
      disposition: 'reject',
      reasons: [
        'This path belongs to D3VONN runtime, auth, schema, deployment, security, or configuration authority.',
      ],
      findings,
    };
  }

  if (TRANSPLANT_PAGE_FILES.has(path)) {
    return {
      path,
      disposition: 'transplant-candidate',
      reasons: ['Canonical Phase 1 marketing page; presentation-only transplant is permitted.'],
      findings,
    };
  }

  if (
    DESIGN_SYSTEM_HOSTS.has(path) ||
    MANUAL_REVIEW_PREFIXES.some((prefix) => path.startsWith(prefix))
  ) {
    return {
      path,
      disposition: 'manual-review',
      reasons: [
        'Shared presentation material may be useful, but must be reconciled against D3VONN design/runtime authority.',
      ],
      findings,
    };
  }

  return {
    path,
    disposition: 'reject',
    reasons: ['Unrecognized Readdy path is rejected by default (fail closed).'],
    findings,
  };
}

export function summarizeReaddyQuarantine(
  files: Array<{ path: string; sourceText?: string }>,
) {
  const decisions = files.map(({ path, sourceText }) =>
    classifyReaddySourceFile(path, sourceText),
  );

  return {
    decisions,
    counts: {
      transplantCandidate: decisions.filter(
        ({ disposition }) => disposition === 'transplant-candidate',
      ).length,
      manualReview: decisions.filter(
        ({ disposition }) => disposition === 'manual-review',
      ).length,
      reject: decisions.filter(({ disposition }) => disposition === 'reject').length,
    },
  };
}
