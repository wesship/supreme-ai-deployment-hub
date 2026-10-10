import { Helmet } from 'react-helmet-async';
import { McpDashboard } from '@/components/mcp';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';
import PublicPageShell from '@/components/shell/PublicPageShell';

const breadcrumbs = [{ label: 'Developer Platform' }, { label: 'MCP Tool Explorer' }];

export default function McpPage() {
  return (
    <PublicPageShell breadcrumbs={breadcrumbs}>
      <Helmet>
        <title>MCP Tool Explorer — D3VONN.IO Developer Platform</title>
        <meta
          name="description"
          content="Explore and operate Model Context Protocol tools available to D3VONN.IO agents and governed workflows."
        />
        <link rel="canonical" href="https://www.d3vonn.io/mcp" />
      </Helmet>

      <section className="d3-os-shell min-h-screen" aria-labelledby="mcp-explorer-heading">
        <D3vonnPageBanner title="MCP Tool Explorer" />
        <h1 id="mcp-explorer-heading" className="sr-only">D3VONN.IO MCP Tool Explorer</h1>
        <div aria-label="Model Context Protocol tools workspace">
          <McpDashboard />
        </div>
      </section>
    </PublicPageShell>
  );
}
