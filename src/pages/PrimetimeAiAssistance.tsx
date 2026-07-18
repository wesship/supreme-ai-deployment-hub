import { useEffect, useMemo, useState } from 'react';
import { primetimeRelease1Api, type PrimetimeRecord } from '@/lib/primetimeRelease1Api';

function value(record: PrimetimeRecord, key: string, fallback = ''): string {
  const raw = record[key];
  return raw === undefined || raw === null ? fallback : String(raw);
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function Row({ record, keys }: { record: PrimetimeRecord; keys: string[] }) {
  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-200">
      {keys.map((key) => (
        <div key={key}>
          <span className="text-slate-400">{key}: </span>
          <span>{value(record, key, '—')}</span>
        </div>
      ))}
    </li>
  );
}

const fallbackWorkspace = '00000000-0000-4000-8000-000000000001';
const fallbackUser = '00000000-0000-4000-8000-000000000002';
const fallbackAgent = '00000000-0000-4000-8000-000000000010';
const fallbackVersion = '00000000-0000-4000-8000-000000000011';
const fallbackRequest = '00000000-0000-4000-8000-000000000012';
const fallbackOutput = '00000000-0000-4000-8000-000000000013';
const fallbackAction = '00000000-0000-4000-8000-000000000014';
const fallbackApproval = '00000000-0000-4000-8000-000000000015';
const fallbackFinding = '00000000-0000-4000-8000-000000000016';

export default function PrimetimeAiAssistance() {
  const [workspaceId, setWorkspaceId] = useState(fallbackWorkspace);
  const [status, setStatus] = useState('Loading AI assistance workspace…');
  const [agents, setAgents] = useState<PrimetimeRecord[]>([]);
  const [versions, setVersions] = useState<PrimetimeRecord[]>([]);
  const [requests, setRequests] = useState<PrimetimeRecord[]>([]);
  const [outputs, setOutputs] = useState<PrimetimeRecord[]>([]);
  const [actions, setActions] = useState<PrimetimeRecord[]>([]);
  const [approvals, setApprovals] = useState<PrimetimeRecord[]>([]);
  const [findings, setFindings] = useState<PrimetimeRecord[]>([]);
  const [citations, setCitations] = useState<PrimetimeRecord[]>([]);

  const ids = useMemo(() => ({
    agentId: value(agents[0] || {}, 'id', fallbackAgent),
    versionId: value(versions[0] || {}, 'id', fallbackVersion),
    requestId: value(requests[0] || {}, 'id', fallbackRequest),
    outputId: value(outputs[0] || {}, 'id', fallbackOutput),
    actionId: value(actions[0] || {}, 'id', fallbackAction),
    approvalId: value(approvals[0] || {}, 'id', fallbackApproval),
    findingId: value(findings[0] || {}, 'id', fallbackFinding),
  }), [agents, versions, requests, outputs, actions, approvals, findings]);

  async function load() {
    try {
      const workspaces = await primetimeRelease1Api.listWorkspaces();
      const selectedWorkspace = value(workspaces[0] || {}, 'id', workspaceId);
      setWorkspaceId(selectedWorkspace);
      const [agentRows, versionRows, requestRows, outputRows, actionRows, approvalRows, findingRows, citationRows] = await Promise.all([
        primetimeRelease1Api.listAiAgents(selectedWorkspace),
        primetimeRelease1Api.listAiAgentVersions(selectedWorkspace),
        primetimeRelease1Api.listAiAssistanceRequests(selectedWorkspace),
        primetimeRelease1Api.listAiAssistanceOutputs(selectedWorkspace),
        primetimeRelease1Api.listAiActionLedger(selectedWorkspace),
        primetimeRelease1Api.listAiApprovalRequests(selectedWorkspace),
        primetimeRelease1Api.listAiComplianceFindings(selectedWorkspace),
        primetimeRelease1Api.listAiKnowledgeCitations(selectedWorkspace),
      ]);
      setAgents(agentRows);
      setVersions(versionRows);
      setRequests(requestRows);
      setOutputs(outputRows);
      setActions(actionRows);
      setApprovals(approvalRows);
      setFindings(findingRows);
      setCitations(citationRows);
      setStatus('Release 4 AI Assistance workspace ready.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load AI assistance workspace.');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createAgent() {
    const record = await primetimeRelease1Api.createAiAgent({
      workspace_id: workspaceId,
      key: 'intake_agent',
      name: 'Intake Agent',
      purpose: 'Draft-first intake support for contact context, notes, and next-step organization.',
      status: 'draft',
      allowed_actions: ['suggest_next_action', 'create_task'],
      blocked_actions: ['regulated_recommendation', 'quote_generation', 'policy_decision', 'submit_application', 'send_message', 'voice_call', 'delete_record'],
    });
    setAgents((rows) => [record, ...rows]);
  }

  async function createVersion() {
    const record = await primetimeRelease1Api.createAiAgentVersion({
      workspace_id: workspaceId,
      agent_id: ids.agentId,
      version: 1,
      model_policy: { mode: 'draft_only' },
      system_prompt: 'Provide educational, draft-first assistance. Do not recommend policies, quote coverage, submit applications, send messages, or call prospects.',
      tool_policy: { autonomous_execution: false, blocked_actions: ['send_message', 'voice_call', 'quote_generation'] },
      status: 'draft',
    });
    setVersions((rows) => [record, ...rows]);
  }

  async function createRequest() {
    const record = await primetimeRelease1Api.createAiAssistanceRequest({
      workspace_id: workspaceId,
      agent_key: 'meeting_prep_agent',
      request_type: 'meeting_prep',
      prompt: 'Prepare a neutral meeting brief with open tasks, consent reminders, and questions to ask. No product recommendation.',
      status: 'requested',
      context: { source: 'release_4_ui' },
    });
    setRequests((rows) => [record, ...rows]);
  }

  async function createOutput() {
    const record = await primetimeRelease1Api.createAiAssistanceOutput({
      workspace_id: workspaceId,
      request_id: ids.requestId,
      agent_id: ids.agentId,
      agent_version_id: ids.versionId,
      output_type: 'meeting_brief',
      content: { summary: 'Draft meeting brief. Confirm licensing and compliance before client-facing use.' },
      status: 'draft',
      requires_human_approval: true,
      requires_licensed_review: true,
      requires_compliance_review: false,
    });
    setOutputs((rows) => [record, ...rows]);
  }

  async function createSafeAction() {
    const record = await primetimeRelease1Api.createAiActionLedger({
      workspace_id: workspaceId,
      request_id: ids.requestId,
      output_id: ids.outputId,
      action_type: 'create_task',
      action_status: 'proposed',
      target_table: 'tasks',
      proposed_payload: { title: 'Follow up after AI-reviewed meeting prep', owner_id: fallbackUser },
      risk_flags: ['human_review_required'],
    });
    setActions((rows) => [record, ...rows]);
  }

  async function createBlockedAction() {
    const record = await primetimeRelease1Api.createAiActionLedger({
      workspace_id: workspaceId,
      request_id: ids.requestId,
      output_id: ids.outputId,
      action_type: 'regulated_recommendation',
      action_status: 'blocked',
      proposed_payload: { reason: 'Release 4 UI guard: regulated recommendation must be blocked.' },
      risk_flags: ['regulated_recommendation_blocked'],
    });
    setActions((rows) => [record, ...rows]);
  }

  async function createApproval() {
    const record = await primetimeRelease1Api.createAiApprovalRequest({
      workspace_id: workspaceId,
      action_id: ids.actionId,
      output_id: ids.outputId,
      review_type: 'licensed',
      status: 'pending',
      reason: 'Licensed review required before using AI output with a client.',
    });
    setApprovals((rows) => [record, ...rows]);
  }

  async function createFinding() {
    const record = await primetimeRelease1Api.createAiComplianceFinding({
      workspace_id: workspaceId,
      request_id: ids.requestId,
      output_id: ids.outputId,
      action_id: ids.actionId,
      severity: 'warning',
      rule_key: 'human_approval_required',
      finding: 'AI output must remain draft-first until reviewed by the correct human role.',
      recommendation: 'Route through approval inbox before any client-facing use.',
      status: 'open',
    });
    setFindings((rows) => [record, ...rows]);
  }

  async function createCitation() {
    const record = await primetimeRelease1Api.createAiKnowledgeCitation({
      workspace_id: workspaceId,
      output_id: ids.outputId,
      source_title: 'PRIMETIME Release 4 AI Assistance Plan',
      source_type: 'project_governance_doc',
      source_version: 'release-4',
      excerpt: 'AI assistance is draft-first and cannot autonomously execute regulated actions.',
      confidence: 0.95,
    });
    setCitations((rows) => [record, ...rows]);
  }

  async function approveOutput() {
    const updated = await primetimeRelease1Api.updateAiAssistanceOutput(ids.outputId, { status: 'approved' });
    setOutputs((rows) => rows.map((row) => value(row, 'id') === ids.outputId ? updated : row));
  }

  async function approveRequest() {
    const updated = await primetimeRelease1Api.updateAiApprovalRequest(ids.approvalId, { status: 'approved', decision_reason: 'Reviewed in Release 4 UI.' });
    setApprovals((rows) => rows.map((row) => value(row, 'id') === ids.approvalId ? updated : row));
  }

  async function resolveFinding() {
    const updated = await primetimeRelease1Api.updateAiComplianceFinding(ids.findingId, { status: 'resolved', resolution_note: 'Human review workflow confirmed.' });
    setFindings((rows) => rows.map((row) => value(row, 'id') === ids.findingId ? updated : row));
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-3xl border border-blue-400/20 bg-gradient-to-br from-blue-950/70 to-slate-950 p-8 shadow-2xl shadow-blue-950/30">
          <p className="text-sm uppercase tracking-[0.3em] text-blue-200">PRIMETIME Release 4</p>
          <h1 className="mt-3 text-4xl font-bold text-white">AI Assistance Control Plane</h1>
          <p className="mt-3 max-w-3xl text-slate-300">
            Draft-first AI support for intake, follow-up, scheduling, meeting prep, and compliance review. This workspace records AI actions, approvals, findings, and citations without autonomous sending, quoting, product recommendations, application submission, or hard deletes.
          </p>
          <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-950/30 p-4 text-sm text-amber-100" data-testid="ai-governance-boundary">
            Governance boundary: no send, no delete, no quote, no recommend-policy, no submit-application, and no autonomous regulated recommendations.
          </div>
          <p className="mt-4 text-sm text-slate-400" role="status">{status}</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Agent registry">
            <button className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white" onClick={() => void createAgent()}>Create Intake Agent</button>
            <button className="ml-2 rounded-lg border border-white/10 px-4 py-2 text-sm" onClick={() => void createVersion()}>Create Agent Version</button>
            <ul className="space-y-2" data-testid="agent-registry">
              {agents.map((agent, index) => <Row key={`${value(agent, 'id', 'agent')}-${index}`} record={agent} keys={['name', 'key', 'status']} />)}
            </ul>
          </Card>

          <Card title="Assistance request console">
            <button className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white" onClick={() => void createRequest()}>Create Meeting Prep Request</button>
            <ul className="space-y-2" data-testid="assistance-requests">
              {requests.map((request, index) => <Row key={`${value(request, 'id', 'request')}-${index}`} record={request} keys={['agent_key', 'request_type', 'status']} />)}
            </ul>
          </Card>

          <Card title="Output review queue">
            <button className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white" onClick={() => void createOutput()}>Create Draft Output</button>
            <button className="ml-2 rounded-lg border border-white/10 px-4 py-2 text-sm" onClick={() => void approveOutput()}>Approve Output</button>
            <ul className="space-y-2" data-testid="output-review-queue">
              {outputs.map((output, index) => <Row key={`${value(output, 'id', 'output')}-${index}`} record={output} keys={['output_type', 'status', 'requires_licensed_review']} />)}
            </ul>
          </Card>

          <Card title="AI action ledger">
            <button className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white" onClick={() => void createSafeAction()}>Propose Safe Task</button>
            <button className="ml-2 rounded-lg border border-red-300/40 px-4 py-2 text-sm text-red-100" onClick={() => void createBlockedAction()}>Record Blocked Recommendation</button>
            <ul className="space-y-2" data-testid="ai-action-ledger">
              {actions.map((action, index) => <Row key={`${value(action, 'id', 'action')}-${index}`} record={action} keys={['action_type', 'action_status', 'target_table']} />)}
            </ul>
          </Card>

          <Card title="Human approval inbox">
            <button className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white" onClick={() => void createApproval()}>Create Licensed Approval</button>
            <button className="ml-2 rounded-lg border border-white/10 px-4 py-2 text-sm" onClick={() => void approveRequest()}>Approve Selected</button>
            <ul className="space-y-2" data-testid="approval-inbox">
              {approvals.map((approval, index) => <Row key={`${value(approval, 'id', 'approval')}-${index}`} record={approval} keys={['review_type', 'status', 'reason']} />)}
            </ul>
          </Card>

          <Card title="Compliance findings panel">
            <button className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white" onClick={() => void createFinding()}>Record Finding</button>
            <button className="ml-2 rounded-lg border border-white/10 px-4 py-2 text-sm" onClick={() => void resolveFinding()}>Resolve Finding</button>
            <ul className="space-y-2" data-testid="compliance-findings">
              {findings.map((finding, index) => <Row key={`${value(finding, 'id', 'finding')}-${index}`} record={finding} keys={['severity', 'rule_key', 'status']} />)}
            </ul>
          </Card>

          <Card title="Knowledge citation viewer">
            <button className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white" onClick={() => void createCitation()}>Add Citation</button>
            <ul className="space-y-2" data-testid="knowledge-citations">
              {citations.map((citation, index) => <Row key={`${value(citation, 'id', 'citation')}-${index}`} record={citation} keys={['source_title', 'source_type', 'confidence']} />)}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
