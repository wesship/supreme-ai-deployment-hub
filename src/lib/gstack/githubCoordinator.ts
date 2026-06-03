export interface GitHubWorkItem {
 title: string;
 repository: string;
 type: 'issue' | 'pull_request' | 'release';
 status: 'open' | 'closed' | 'draft';
}

export function createPlanningPayload(objective: string): GitHubWorkItem {
 return {
  title: objective,
  repository: 'wesship/supreme-ai-deployment-hub',
  type: 'issue',
  status: 'open',
 };
}

export function createReleasePayload(version: string): GitHubWorkItem {
 return {
  title: `Release ${version}`,
  repository: 'wesship/supreme-ai-deployment-hub',
  type: 'release',
  status: 'draft',
 };
}
