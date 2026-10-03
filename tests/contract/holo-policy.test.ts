import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
const scoped = config.headers.find((h: { source: string }) => h.source === '/holo');
it('includes the downloadable prompt pack in Vercel builds', () => { expect(readFileSync('.vercelignore', 'utf8').split('\n')).toContain('!public/holo/D3VONN_PROMPT_PACK.md'); expect(readFileSync('public/holo/D3VONN_PROMPT_PACK.md', 'utf8')).toContain('Original D3VONN templates'); });
it('enables camera only in the workspace document', () => { expect(scoped.headers.find((h: { key: string }) => h.key === 'Permissions-Policy').value).toContain('camera=(self)'); const globals = config.headers.filter((h: { source: string }) => h.source !== '/holo').flatMap((h: { headers: { key: string; value: string }[] }) => h.headers); expect(globals.some((h: { key: string; value: string }) => h.key === 'Permissions-Policy' && h.value.includes('camera=()'))).toBe(true); });
it('allows WASM without JS unsafe-eval and forbids document caching', () => { const policy = scoped.headers.find((h: { key: string }) => h.key === 'Content-Security-Policy').value; expect(policy).toContain("'wasm-unsafe-eval'"); expect(policy).not.toContain("'unsafe-eval'"); expect(scoped.headers.find((h: { key: string }) => h.key === 'Cache-Control').value).toContain('no-store'); });
it('matches every pinned local model/runtime hash', () => { for (const line of readFileSync('docs/holo/ASSETS.sha256', 'utf8').trim().split('\n')) { const [hash, path] = line.split(/\s+/); expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe(hash); } });
