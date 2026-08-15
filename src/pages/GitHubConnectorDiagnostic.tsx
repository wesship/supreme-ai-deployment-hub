import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, ExternalLink, GitBranch, AlertTriangle, ArrowRight } from "lucide-react";
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';

type ScreenId =
  | "authorize"
  | "install_select_account"
  | "install_repos"
  | "install_and_authorize"
  | "settings_installed"
  | "404_or_suspended"
  | "lovable_connectors"
  | "unknown";

interface Screen {
  id: ScreenId;
  title: string;
  description: string;
  matchesUrl?: (url: URL) => boolean;
  signals: string[];
  nextSteps: string[];
  cta?: { label: string; href: string };
}

function parseHttpUrl(value: string): URL | null {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed : null;
  } catch {
    return null;
  }
}

function isGitHubHost(url: URL): boolean {
  return url.hostname.toLowerCase() === 'github.com';
}

function pathSegments(url: URL): string[] {
  return url.pathname.split('/').filter(Boolean);
}

function hasNumericSegment(value: string | undefined): boolean {
  return Boolean(value) && Array.from(value as string).every((character) => character >= '0' && character <= '9');
}

const SCREENS: Screen[] = [
  {
    id: "authorize",
    title: "GitHub — Authorize Lovable",
    description: "OAuth consent screen. Grants Lovable read access to your account profile only. Does NOT install the app on any repo yet.",
    matchesUrl: (url) => isGitHubHost(url) && url.pathname === '/login/oauth/authorize' && !url.searchParams.toString().toLowerCase().includes('lovable'),
    signals: [
      'Green button labeled "Authorize lovable-dev" or "Authorize"',
      'Heading: "Authorize Lovable"',
      'Lists permissions like "Verify your GitHub identity"',
    ],
    nextSteps: [
      'Click the green "Authorize" button.',
      'GitHub will redirect you to the Install screen — do NOT stop here.',
      'If it redirects back to Lovable without installing, open the direct install link below.',
    ],
    cta: { label: "Open install page", href: "https://github.com/apps/lovable/installations/new" },
  },
  {
    id: "install_select_account",
    title: "GitHub — Install Lovable: choose account",
    description: "You're picking WHICH account or org Lovable will be installed on. Pick the owner of the repo containing PR #78.",
    matchesUrl: (url) => isGitHubHost(url) && (
      url.pathname === '/apps/lovable/installations/new' ||
      url.pathname === '/apps/lovable/installations/select_target'
    ),
    signals: [
      'Heading: "Install Lovable"',
      'List of your personal account + every org you belong to',
      'Each row has an "Install" button on the right',
    ],
    nextSteps: [
      'Identify the OWNER part of your PR URL: github.com/<OWNER>/<repo>/pull/78.',
      'Click "Install" next to that exact owner (your username OR the org).',
      'If the owner is an org and you are not an admin, the button says "Request" — an org admin must approve.',
    ],
  },
  {
    id: "install_repos",
    title: "GitHub — Install Lovable: choose repositories",
    description: "Final install step. Pick which repos Lovable can see. CI rerun access requires the PR repo to be selected.",
    matchesUrl: (url) => {
      if (!isGitHubHost(url)) return false;
      const parts = pathSegments(url);
      const personalInstall = parts[0] === 'settings' && parts[1] === 'installations' && hasNumericSegment(parts[2]) && parts[3] === 'permissions' && parts[4] === 'update';
      const orgInstall = parts[0] === 'organizations' && Boolean(parts[1]) && parts[2] === 'settings' && parts[3] === 'installations' && hasNumericSegment(parts[4]) && parts.length === 5;
      return personalInstall || orgInstall;
    },
    signals: [
      'Two radio options: "All repositories" and "Only select repositories"',
      'Green "Install" or "Install & Authorize" button at the bottom',
    ],
    nextSteps: [
      'Pick "Only select repositories" and add the repo containing PR #78 (safer), OR pick "All repositories".',
      'Click the green "Install" / "Install & Authorize" button.',
      'You will be redirected back to Lovable — return to this page and click "Re-check connection".',
    ],
  },
  {
    id: "install_and_authorize",
    title: "GitHub — Install & Authorize Lovable",
    description: "Combined screen when you've never authorized + never installed. One click does both.",
    matchesUrl: (url) => isGitHubHost(url) && url.pathname === '/login/oauth/authorize' && url.searchParams.toString().toLowerCase().includes('lovable'),
    signals: [
      'Green button: "Install & Authorize"',
      'Shows both account permissions AND repository selection on one page',
    ],
    nextSteps: [
      'Choose "Only select repositories" → add the PR #78 repo (or pick "All repositories").',
      'Click the green "Install & Authorize" button.',
      'You\'ll be redirected back to Lovable.',
    ],
  },
  {
    id: "settings_installed",
    title: "GitHub — Lovable already installed (Settings)",
    description: "The app is installed. From here you can change which repos it can access.",
    matchesUrl: (url) => {
      if (!isGitHubHost(url)) return false;
      const parts = pathSegments(url);
      const personal = parts[0] === 'settings' && parts[1] === 'installations' && hasNumericSegment(parts[2]) && parts.length === 3;
      const organization = parts[0] === 'organizations' && Boolean(parts[1]) && parts[2] === 'settings' && parts[3] === 'installations' && hasNumericSegment(parts[4]) && parts.length === 5;
      return personal || organization;
    },
    signals: [
      'Heading: "Installed GitHub Apps" or "Lovable"',
      '"Configure" or "Repository access" section visible',
      'Option to Suspend or Uninstall at the bottom',
    ],
    nextSteps: [
      'Under "Repository access" make sure the PR #78 repo is included.',
      'Click "Save".',
      'Return to Lovable and click "Re-check connection".',
    ],
  },
  {
    id: "404_or_suspended",
    title: 'GitHub — 404, suspended, or "Request access"',
    description: "You hit a wall. Either the org blocks third-party apps, the install is suspended, or you lack admin rights.",
    matchesUrl: (url) => isGitHubHost(url) && pathSegments(url).some((segment) => ['404', 'suspended', 'request'].includes(segment.toLowerCase())),
    signals: [
      '"Page not found" 404 page',
      '"This installation is suspended" banner',
      'Button reads "Request" instead of "Install"',
    ],
    nextSteps: [
      'If "Request": an org admin must approve at github.com/organizations/<org>/settings/oauth_application_policy.',
      'If suspended: go to org Settings → Integrations → GitHub Apps → Lovable → Unsuspend.',
      'If 404: the org restricts third-party apps. Ask an admin to allow Lovable, then retry.',
    ],
  },
  {
    id: "lovable_connectors",
    title: "Lovable — Connectors page",
    description: "You're back in Lovable. The connection should now show as linked.",
    matchesUrl: (url) => ['lovable.app', 'lovable.dev'].includes(url.hostname.toLowerCase()) && url.pathname.toLowerCase().includes('connector'),
    signals: [
      'GitHub card shows "Connected" badge',
      'Repo dropdown is populated',
    ],
    nextSteps: [
      'Confirm the GitHub card shows "Connected".',
      'Tell me "GitHub connected" in chat and I will re-run CI on PR #78.',
    ],
  },
];

const UNKNOWN: Screen = {
  id: "unknown",
  title: "Screen not recognized",
  description: "I couldn't match the URL. Pick the screen manually below or paste a screenshot in chat.",
  signals: [],
  nextSteps: [
    'Use the manual picker below — choose the option that matches what you see.',
    'Or paste a screenshot into the chat and I will identify it.',
  ],
};

export default function GitHubConnectorDiagnostic() {
  const [url, setUrl] = useState("");
  const [manual, setManual] = useState<ScreenId | null>(null);

  const parsedUrl = useMemo(() => parseHttpUrl(url), [url]);

  const detected: Screen = useMemo(() => {
    if (manual) return SCREENS.find((screen) => screen.id === manual) ?? UNKNOWN;
    if (!parsedUrl) return UNKNOWN;
    return SCREENS.find((screen) => screen.matchesUrl?.(parsedUrl)) ?? UNKNOWN;
  }, [parsedUrl, manual]);

  const repoOwnerHint = useMemo(() => {
    if (!parsedUrl || !isGitHubHost(parsedUrl)) return null;
    const parts = pathSegments(parsedUrl);
    if (parts.length !== 4 || parts[2] !== 'pull' || !hasNumericSegment(parts[3])) return null;
    return { owner: parts[0], repo: parts[1], pr: parts[3] };
  }, [parsedUrl]);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10 space-y-6">
      <D3vonnPageBanner title="GitHub Connector" />
      <div className="flex items-center gap-3">
        <GitBranch className="h-8 w-8" />
        <div>
          <h2 className="text-3xl font-bold tracking-tight">GitHub Connector Diagnostic</h2>
          <p className="text-muted-foreground">Tell me which GitHub screen you're on — I'll tell you exactly what to click next.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Paste the URL from your GitHub tab</CardTitle>
          <CardDescription>Or the PR #78 URL — I'll extract the owner so you know which account to install Lovable on.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="https://github.com/... or https://github.com/owner/repo/pull/78"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setManual(null); }}
          />
          {repoOwnerHint && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>PR detected</AlertTitle>
              <AlertDescription>
                Owner: <Badge variant="secondary">{repoOwnerHint.owner}</Badge>{" "}
                Repo: <Badge variant="secondary">{repoOwnerHint.repo}</Badge>{" "}
                PR: <Badge variant="secondary">#{repoOwnerHint.pr}</Badge>
                <div className="mt-2 text-sm">
                  When the install screen asks which account, pick <strong>{repoOwnerHint.owner}</strong>.
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Or pick the screen manually</CardTitle>
          <CardDescription>Match what you see on screen.</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-2">
          {SCREENS.map((screen) => (
            <Button
              key={screen.id}
              variant={manual === screen.id ? "default" : "outline"}
              className="justify-start h-auto py-3 text-left"
              onClick={() => { setManual(screen.id); }}
            >
              <span className="truncate">{screen.title}</span>
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card className="border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {detected.id === "unknown" ? <AlertTriangle className="h-5 w-5 text-yellow-500" /> : <CheckCircle2 className="h-5 w-5 text-green-500" />}
            {detected.title}
          </CardTitle>
          <CardDescription>{detected.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {detected.signals.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-2">Signals you should see on GitHub:</h3>
              <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                {detected.signals.map((signal, index) => <li key={index}>{signal}</li>)}
              </ul>
            </div>
          )}
          <div>
            <h3 className="font-semibold text-sm mb-2">Do this next:</h3>
            <ol className="space-y-2">
              {detected.nextSteps.map((step, index) => (
                <li key={index} className="flex gap-2 text-sm">
                  <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          {detected.cta && (
            <Button asChild>
              <a href={detected.cta.href} target="_blank" rel="noreferrer">
                {detected.cta.label} <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Quick links</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href="https://github.com/apps/lovable/installations/new" target="_blank" rel="noreferrer">Install Lovable (direct) <ExternalLink className="ml-2 h-3 w-3" /></a>
          </Button>
          <Button variant="outline" asChild>
            <a href="https://github.com/settings/installations" target="_blank" rel="noreferrer">My installed apps <ExternalLink className="ml-2 h-3 w-3" /></a>
          </Button>
          <Button variant="outline" asChild>
            <a href="https://github.com/settings/connections/applications" target="_blank" rel="noreferrer">OAuth authorizations <ExternalLink className="ml-2 h-3 w-3" /></a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
