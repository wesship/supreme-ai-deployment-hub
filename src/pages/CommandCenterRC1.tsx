import { Helmet } from 'react-helmet-async';
import PublicPageShell from '@/components/shell/PublicPageShell';
import CommandCenter from './CommandCenter';

const breadcrumbs = [{ label: 'Operations' }, { label: 'Command Center' }];

export default function CommandCenterRC1() {
  return (
    <PublicPageShell breadcrumbs={breadcrumbs}>
      <Helmet>
        <title>AI Operations Command Center — D3VONN.IO</title>
        <meta
          name="description"
          content="Operate D3VONN.IO agents, MCP tools, marketplace deployments, governance, and platform settings from one command surface."
        />
        <link rel="canonical" href="https://d3vonn.io/command-center" />
      </Helmet>
      <section aria-label="D3VONN.IO Command Center workspace">
        <CommandCenter />
      </section>
    </PublicPageShell>
  );
}
