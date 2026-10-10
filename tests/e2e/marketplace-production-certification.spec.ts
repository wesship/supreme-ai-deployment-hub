import { expect, test } from '@playwright/test';

const MARKETPLACE_API = 'https://api.d3vonn.io/api/marketplace/agents';
const REQUIRED_CANONICAL_AGENTS = ['hermes', 'guardian', 'ion', 'sapphire', 'tars'] as const;

type MarketplaceAgent = {
  name: string;
  slug: string;
  stats: {
    downloads: number;
    activeInstalls: number;
    avgRating: number;
    reviewCount: number;
  };
};

type MarketplacePayload = {
  source: string;
  live: boolean;
  count: number;
  agents: MarketplaceAgent[];
};

test.describe('D3VONN.IO marketplace production certification', () => {
  test('canonical agent registry is live and truthful in production', async ({ request }) => {
    const response = await request.get(MARKETPLACE_API, { failOnStatusCode: false });
    expect(response.status(), 'Marketplace API must be reachable in production').toBe(200);

    const payload = (await response.json()) as MarketplacePayload;
    expect(payload.source).toBe('agent_registry');
    expect(payload.live).toBe(true);
    expect(Array.isArray(payload.agents)).toBe(true);
    expect(payload.count).toBe(payload.agents.length);
    expect(payload.count).toBeGreaterThanOrEqual(REQUIRED_CANONICAL_AGENTS.length);

    const identifiers = payload.agents.map((agent) => `${agent.name} ${agent.slug}`.toLowerCase());
    for (const requiredAgent of REQUIRED_CANONICAL_AGENTS) {
      expect(
        identifiers.some((identifier) => identifier.includes(requiredAgent)),
        `Canonical agent ${requiredAgent} is missing from production marketplace`,
      ).toBe(true);
    }

    for (const agent of payload.agents) {
      expect(agent.stats.downloads).toBe(0);
      expect(agent.stats.activeInstalls).toBe(0);
      expect(agent.stats.avgRating).toBe(0);
      expect(agent.stats.reviewCount).toBe(0);
    }
  });

  test('marketplace UI renders the live canonical registry', async ({ page }) => {
    const responsePromise = page.waitForResponse((response) =>
      response.url() === MARKETPLACE_API && response.request().method() === 'GET',
    );

    const documentResponse = await page.goto('/marketplace', { waitUntil: 'domcontentloaded' });
    expect(documentResponse?.status()).toBeLessThan(400);

    const apiResponse = await responsePromise;
    expect(apiResponse.status()).toBe(200);
    const payload = (await apiResponse.json()) as MarketplacePayload;

    await expect(page.getByText('Live agent registry', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Canonical registry', { exact: true })).toBeVisible();
    await expect(page.getByText(`${payload.count} live agents`, { exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);

    for (const requiredAgent of REQUIRED_CANONICAL_AGENTS) {
      const agent = payload.agents.find((candidate) =>
        `${candidate.name} ${candidate.slug}`.toLowerCase().includes(requiredAgent),
      );
      expect(agent, `Canonical agent ${requiredAgent} missing from API payload`).toBeDefined();
      await expect(page.getByText(agent!.name, { exact: true }).first()).toBeVisible();
    }
  });
});
