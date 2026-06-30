import { AgentTemplate, AgentCategory } from '@/types/marketplace';

export const mockAgentTemplates: AgentTemplate[] = [
  {
    id: 'agent-001',
    name: 'Security Sentinel',
    slug: 'security-sentinel',
    description: 'AI-powered security monitoring with automated threat detection and incident response.',
    longDescription: `Security Sentinel provides enterprise-grade security monitoring powered by advanced AI. 
    
Features:
- Real-time threat detection using ML models
- Automated incident response playbooks
- Integration with SIEM tools (Wazuh, Splunk)
- BloodHound attack path analysis
- Compliance reporting (SOC2, HIPAA, PCI-DSS)`,
    category: 'security',
    capabilities: ['monitoring', 'alerting', 'remediation', 'ml-powered', 'reporting'],
    pricing: { model: 'subscription', amount: 99, currency: 'USD', interval: 'monthly' },
    author: {
      id: 'd3vonn',
      name: 'D3VONN.IO',
      verified: true,
      agentCount: 12
    },
    status: 'published',
    version: '2.1.0',
    icon: '🛡️',
    tags: ['security', 'monitoring', 'siem', 'threat-detection', 'compliance'],
    requirements: ['Wazuh or compatible SIEM', 'API access to security tools'],
    integrations: ['Wazuh', 'BloodHound', 'ServiceNow', 'Slack'],
    stats: {
      downloads: 1247,
      activeInstalls: 892,
      avgRating: 4.8,
      reviewCount: 156,
      lastUpdated: '2025-01-10'
    },
    createdAt: '2024-06-15',
    updatedAt: '2025-01-10',
    featured: true
  },
  {
    id: 'agent-002',
    name: 'Infrastructure Healer',
    slug: 'infrastructure-healer',
    description: 'Self-healing infrastructure agent that automatically detects and resolves system issues.',
    longDescription: `Infrastructure Healer brings autonomous self-healing capabilities to your infrastructure.

Capabilities:
- Automatic service restart on failure
- Resource scaling based on demand
- Configuration drift detection and correction
- Health check automation
- Runbook execution via Ansible/Terraform`,
    category: 'infrastructure',
    capabilities: ['monitoring', 'alerting', 'remediation', 'scheduling'],
    pricing: { model: 'subscription', amount: 149, currency: 'USD', interval: 'monthly' },
    author: {
      id: 'd3vonn',
      name: 'D3VONN.IO',
      verified: true,
      agentCount: 12
    },
    status: 'published',
    version: '1.8.3',
    icon: '🔧',
    tags: ['infrastructure', 'self-healing', 'automation', 'ansible', 'terraform'],
    requirements: ['SSH access to target servers', 'Ansible or Terraform'],
    integrations: ['Ansible', 'Terraform', 'Docker', 'Kubernetes', 'AWS'],
    stats: {
      downloads: 2103,
      activeInstalls: 1456,
      avgRating: 4.7,
      reviewCount: 234,
      lastUpdated: '2025-01-08'
    },
    createdAt: '2024-04-20',
    updatedAt: '2025-01-08',
    featured: true
  },
  {
    id: 'agent-003',
    name: 'Cloud Cost Optimizer',
    slug: 'cloud-cost-optimizer',
    description: 'Intelligent cost optimization agent that reduces cloud spending by up to 40%.',
    category: 'analytics',
    capabilities: ['monitoring', 'reporting', 'ml-powered', 'scheduling'],
    pricing: { model: 'usage-based', amount: 0.5, currency: 'USD', interval: 'per-use' },
    author: {
      id: 'cloudops',
      name: 'CloudOps Pro',
      verified: true,
      agentCount: 5
    },
    status: 'published',
    version: '3.0.1',
    icon: '💰',
    tags: ['cloud', 'cost-optimization', 'aws', 'azure', 'gcp', 'finops'],
    requirements: ['Cloud provider API access'],
    integrations: ['AWS', 'Azure', 'GCP', 'Cloudflare'],
    stats: {
      downloads: 3567,
      activeInstalls: 2890,
      avgRating: 4.9,
      reviewCount: 412,
      lastUpdated: '2025-01-09'
    },
    createdAt: '2024-02-10',
    updatedAt: '2025-01-09',
    featured: true
  },
  {
    id: 'agent-004',
    name: 'DevOps Pipeline Guardian',
    slug: 'devops-pipeline-guardian',
    description: 'Monitors CI/CD pipelines and automatically resolves common build failures.',
    category: 'automation',
    capabilities: ['monitoring', 'alerting', 'remediation', 'integration'],
    pricing: { model: 'subscription', amount: 79, currency: 'USD', interval: 'monthly' },
    author: {
      id: 'devtools',
      name: 'DevTools Inc',
      verified: true,
      agentCount: 8
    },
    status: 'published',
    version: '2.4.0',
    icon: '🚀',
    tags: ['devops', 'ci-cd', 'github', 'gitlab', 'jenkins', 'automation'],
    integrations: ['GitHub Actions', 'GitLab CI', 'Jenkins', 'CircleCI'],
    stats: {
      downloads: 1890,
      activeInstalls: 1234,
      avgRating: 4.6,
      reviewCount: 189,
      lastUpdated: '2025-01-07'
    },
    createdAt: '2024-05-01',
    updatedAt: '2025-01-07'
  },
  {
    id: 'agent-005',
    name: 'Database Performance Tuner',
    slug: 'database-performance-tuner',
    description: 'AI-driven database optimization with query analysis and index recommendations.',
    category: 'analytics',
    capabilities: ['monitoring', 'reporting', 'ml-powered'],
    pricing: { model: 'subscription', amount: 129, currency: 'USD', interval: 'monthly' },
    author: {
      id: 'd3vonn',
      name: 'D3VONN.IO',
      verified: true,
      agentCount: 12
    },
    status: 'published',
    version: '1.5.2',
    icon: '🗄️',
    tags: ['database', 'performance', 'sql', 'postgres', 'mysql', 'optimization'],
    requirements: ['Database read access', 'Query log access'],
    integrations: ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis'],
    stats: {
      downloads: 987,
      activeInstalls: 654,
      avgRating: 4.5,
      reviewCount: 98,
      lastUpdated: '2025-01-05'
    },
    createdAt: '2024-08-15',
    updatedAt: '2025-01-05'
  },
  {
    id: 'agent-006',
    name: 'Log Analyzer Pro',
    slug: 'log-analyzer-pro',
    description: 'Intelligent log analysis with pattern detection and anomaly alerting.',
    category: 'analytics',
    capabilities: ['monitoring', 'alerting', 'reporting', 'ml-powered'],
    pricing: { model: 'free' },
    author: {
      id: 'opensource',
      name: 'Open Source Community',
      verified: false,
      agentCount: 3
    },
    status: 'published',
    version: '1.2.0',
    icon: '📊',
    tags: ['logs', 'analytics', 'monitoring', 'anomaly-detection', 'free'],
    integrations: ['Elasticsearch', 'Loki', 'CloudWatch'],
    stats: {
      downloads: 5678,
      activeInstalls: 4123,
      avgRating: 4.3,
      reviewCount: 567,
      lastUpdated: '2025-01-04'
    },
    createdAt: '2024-03-20',
    updatedAt: '2025-01-04'
  },
  {
    id: 'agent-007',
    name: 'API Gateway Monitor',
    slug: 'api-gateway-monitor',
    description: 'Real-time API monitoring with latency tracking and error rate alerting.',
    category: 'infrastructure',
    capabilities: ['monitoring', 'alerting', 'reporting'],
    pricing: { model: 'one-time', amount: 199, currency: 'USD' },
    author: {
      id: 'apitools',
      name: 'API Tools',
      verified: true,
      agentCount: 4
    },
    status: 'published',
    version: '2.0.0',
    icon: '🌐',
    tags: ['api', 'monitoring', 'latency', 'uptime', 'gateway'],
    integrations: ['Kong', 'AWS API Gateway', 'Nginx', 'Traefik'],
    stats: {
      downloads: 1234,
      activeInstalls: 890,
      avgRating: 4.7,
      reviewCount: 134,
      lastUpdated: '2025-01-06'
    },
    createdAt: '2024-07-01',
    updatedAt: '2025-01-06'
  },
  {
    id: 'agent-008',
    name: 'Kubernetes Autopilot',
    slug: 'kubernetes-autopilot',
    description: 'Autonomous Kubernetes management with auto-scaling and self-healing pods.',
    category: 'infrastructure',
    capabilities: ['monitoring', 'alerting', 'remediation', 'scheduling', 'ml-powered'],
    pricing: { model: 'subscription', amount: 199, currency: 'USD', interval: 'monthly' },
    author: {
      id: 'd3vonn',
      name: 'D3VONN.IO',
      verified: true,
      agentCount: 12
    },
    status: 'published',
    version: '3.1.0',
    icon: '☸️',
    tags: ['kubernetes', 'k8s', 'auto-scaling', 'containers', 'orchestration'],
    requirements: ['Kubernetes cluster access', 'kubectl configured'],
    integrations: ['Kubernetes', 'Helm', 'Prometheus', 'Grafana'],
    stats: {
      downloads: 2456,
      activeInstalls: 1789,
      avgRating: 4.8,
      reviewCount: 267,
      lastUpdated: '2025-01-10'
    },
    createdAt: '2024-01-15',
    updatedAt: '2025-01-10',
    featured: true
  },
  {
    id: 'agent-009',
    name: 'Slack Ops Bot',
    slug: 'slack-ops-bot',
    description: 'ChatOps agent for Slack with natural language infrastructure control.',
    category: 'integration',
    capabilities: ['integration', 'alerting', 'scheduling'],
    pricing: { model: 'free' },
    author: {
      id: 'chatops',
      name: 'ChatOps Team',
      verified: false,
      agentCount: 2
    },
    status: 'published',
    version: '1.0.5',
    icon: '💬',
    tags: ['slack', 'chatops', 'integration', 'notifications', 'free'],
    requirements: ['Slack workspace', 'Bot token'],
    integrations: ['Slack', 'PagerDuty', 'Jira'],
    stats: {
      downloads: 3421,
      activeInstalls: 2567,
      avgRating: 4.4,
      reviewCount: 345,
      lastUpdated: '2025-01-03'
    },
    createdAt: '2024-09-01',
    updatedAt: '2025-01-03'
  },
  {
    id: 'agent-010',
    name: 'Compliance Auditor',
    slug: 'compliance-auditor',
    description: 'Automated compliance checking for SOC2, HIPAA, PCI-DSS, and GDPR.',
    category: 'security',
    capabilities: ['monitoring', 'reporting', 'scheduling'],
    pricing: { model: 'subscription', amount: 249, currency: 'USD', interval: 'monthly' },
    author: {
      id: 'd3vonn',
      name: 'D3VONN.IO',
      verified: true,
      agentCount: 12
    },
    status: 'published',
    version: '2.2.1',
    icon: '📋',
    tags: ['compliance', 'soc2', 'hipaa', 'pci-dss', 'gdpr', 'audit'],
    requirements: ['Infrastructure access', 'Policy definitions'],
    integrations: ['AWS Config', 'Azure Policy', 'Terraform'],
    stats: {
      downloads: 876,
      activeInstalls: 543,
      avgRating: 4.6,
      reviewCount: 87,
      lastUpdated: '2025-01-09'
    },
    createdAt: '2024-10-15',
    updatedAt: '2025-01-09'
  },
  {
    id: 'agent-011',
    name: 'N8N Workflow Orchestrator',
    slug: 'n8n-workflow-orchestrator',
    description: 'Bridge agent connecting AI agents to n8n workflows for complex automation.',
    category: 'automation',
    capabilities: ['integration', 'scheduling', 'monitoring'],
    pricing: { model: 'subscription', amount: 49, currency: 'USD', interval: 'monthly' },
    author: {
      id: 'd3vonn',
      name: 'D3VONN.IO',
      verified: true,
      agentCount: 12
    },
    status: 'published',
    version: '1.3.0',
    icon: '🔄',
    tags: ['n8n', 'workflows', 'automation', 'orchestration', 'integration'],
    requirements: ['n8n instance', 'Webhook access'],
    integrations: ['n8n', 'Zapier', 'Make'],
    stats: {
      downloads: 1567,
      activeInstalls: 1123,
      avgRating: 4.7,
      reviewCount: 156,
      lastUpdated: '2025-01-08'
    },
    createdAt: '2024-11-01',
    updatedAt: '2025-01-08'
  },
  {
    id: 'agent-012',
    name: 'Backup Verification Agent',
    slug: 'backup-verification-agent',
    description: 'Automated backup testing and restoration verification for data integrity.',
    category: 'infrastructure',
    capabilities: ['monitoring', 'scheduling', 'reporting'],
    pricing: { model: 'one-time', amount: 149, currency: 'USD' },
    author: {
      id: 'dataops',
      name: 'DataOps Solutions',
      verified: true,
      agentCount: 6
    },
    status: 'published',
    version: '1.1.0',
    icon: '💾',
    tags: ['backup', 'disaster-recovery', 'verification', 'data-integrity'],
    requirements: ['Backup storage access', 'Test environment'],
    integrations: ['AWS S3', 'Azure Blob', 'Restic', 'Velero'],
    stats: {
      downloads: 654,
      activeInstalls: 432,
      avgRating: 4.5,
      reviewCount: 65,
      lastUpdated: '2025-01-02'
    },
    createdAt: '2024-12-01',
    updatedAt: '2025-01-02'
  }
];

export const getCategoryIcon = (category: AgentCategory): string => {
  const icons: Record<AgentCategory, string> = {
    security: '🛡️',
    infrastructure: '🔧',
    automation: '⚡',
    analytics: '📊',
    integration: '🔗',
    custom: '🎨'
  };
  return icons[category];
};

export const getCategoryLabel = (category: AgentCategory): string => {
  const labels: Record<AgentCategory, string> = {
    security: 'Security',
    infrastructure: 'Infrastructure',
    automation: 'Automation',
    analytics: 'Analytics',
    integration: 'Integration',
    custom: 'Custom'
  };
  return labels[category];
};

export const getPricingLabel = (pricing: AgentTemplate['pricing']): string => {
  if (pricing.model === 'free') return 'Free';
  if (pricing.model === 'one-time') return `$${pricing.amount}`;
  if (pricing.model === 'subscription') {
    return `$${pricing.amount}/${pricing.interval === 'monthly' ? 'mo' : 'yr'}`;
  }
  if (pricing.model === 'usage-based') {
    return `$${pricing.amount}/use`;
  }
  return 'Contact';
};
