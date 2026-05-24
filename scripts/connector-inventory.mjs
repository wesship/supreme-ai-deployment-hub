#!/usr/bin/env node

const connectors = [
  { name: 'GitHub', lane: 'production', purpose: 'repo, PR, workflow, issue, and release operations' },
  { name: 'Gmail', lane: 'staging', purpose: 'email memory ingestion and reply drafting' },
  { name: 'Google Drive', lane: 'staging', purpose: 'document ingestion and knowledge base sync' },
  { name: 'Google Calendar', lane: 'staging', purpose: 'schedule memory and automation context' },
  { name: 'Slack', lane: 'future', purpose: 'team messaging and alert ingestion' },
  { name: 'Notion', lane: 'future', purpose: 'workspace knowledge sync' },
  { name: 'Vercel', lane: 'production', purpose: 'frontend deployment and preview validation' },
  { name: 'AWS', lane: 'production', purpose: 'EKS, Route 53, ACM, ECR, and production infra' },
  { name: 'Supabase', lane: 'staging', purpose: 'auth, metadata, and app persistence' },
  { name: 'n8n', lane: 'staging', purpose: 'workflow automation and connector orchestration' },
  { name: 'Appsmith', lane: 'staging', purpose: 'admin dashboards and operator panels' }
];

console.log('| Connector | Lane | Purpose |');
console.log('|---|---|---|');
for (const connector of connectors) {
  console.log(`| ${connector.name} | ${connector.lane} | ${connector.purpose} |`);
}
