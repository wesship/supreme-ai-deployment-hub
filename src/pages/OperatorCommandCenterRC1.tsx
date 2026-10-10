import { Helmet } from 'react-helmet-async';
import PublicPageShell from '@/components/shell/PublicPageShell';
import OperatorCommandCenter from './OperatorCommandCenter';

const breadcrumbs = [{ label: 'Operations' }, { label: 'Operator Command Center' }];

export default function OperatorCommandCenterRC1() {
  return (
    <PublicPageShell breadcrumbs={breadcrumbs}>
      <Helmet>
        <title>Operator Command Center — D3VONN.IO</title>
        <meta
          name="description"
          content="Monitor D3VONN.IO production activity, approvals, agents, tool calls, RAG documents, errors, and Hermes orchestration."
        />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <section aria-label="Protected Operator Command Center workspace">
        <OperatorCommandCenter />
      </section>
    </PublicPageShell>
  );
}
