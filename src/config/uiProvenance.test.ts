import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('canonical D3VONN frontend source', () => {
  it('uses the repository-local Sovereign Signal presentation at the public root', () => {
    const indexPage = fs.readFileSync('src/pages/Index.tsx', 'utf8');
    expect(indexPage).toContain("import SovereignSignalHomepage from '@/components/sovereign/SovereignSignalHomepage'");
    expect(indexPage).toContain('<SovereignSignalHomepage telemetry={telemetry} />');
    expect(indexPage).not.toContain('readdy.ai');
  });

  it('keeps the repository as production UI provenance', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const provenance = fs.readFileSync('src/config/uiProvenance.ts', 'utf8');

    expect(html).toContain('d3vonn-ui-source" content="repository"');
    expect(html).toContain('wesship/supreme-ai-deployment-hub');
    expect(provenance).toContain("source: 'repository'");
    expect(provenance).not.toContain("source: 'readdy'");
  });
});
