const expected = process.env.CERTIFIED_SHA || process.env.GITHUB_SHA;
if (!/^[0-9a-f]{40}$/.test(expected || '')) throw new Error('Full certified commit SHA required');
const endpoints = [
  ['API', 'https://api.d3vonn.io/api/runtime/identity'],
  ['frontend', 'https://www.d3vonn.io/health.json'],
];
for (let attempt = 1; attempt <= 30; attempt++) {
  const identities = await Promise.all(endpoints.map(async ([name, url]) => {
    try {
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
      if (!response.ok) return false;
      const body = await response.json();
      const match = body.commit_sha === expected;
      console.log(`${name}: ${match ? 'certified commit' : 'waiting for certified commit'}`);
      return match;
    } catch {
      console.log(`${name}: identity unavailable`);
      return false;
    }
  }));
  if (identities.every(Boolean)) process.exit(0);
  if (attempt < 30) await new Promise(resolve => setTimeout(resolve, 10_000));
}
throw new Error('Production API and frontend did not deploy the certified commit');
