/**
 * D3VONN Customer Success — Onboarding Engine
 *
 * Guided onboarding flows with step tracking, progress persistence,
 * contextual help, and completion analytics.
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type OnboardingStatus = "not_started" | "in_progress" | "completed" | "skipped" | "abandoned";
export type StepType = "action" | "tutorial" | "verification" | "configuration" | "celebration";

export interface OnboardingFlow {
  id: string;
  name: string;
  description: string;
  targetRole: string;
  steps: OnboardingStep[];
  estimatedMinutes: number;
  requiredForActivation: boolean;
}

export interface OnboardingStep {
  id: string;
  flowId: string;
  title: string;
  description: string;
  type: StepType;
  order: number;
  action?: string;
  verificationFn?: string;
  helpContent: string;
  videoUrl?: string;
  skippable: boolean;
  dependencies: string[];
}

export interface UserOnboardingState {
  userId: string;
  tenantId: string;
  flowId: string;
  status: OnboardingStatus;
  currentStepId: string;
  completedSteps: string[];
  skippedSteps: string[];
  startedAt: string;
  completedAt?: string;
  lastActivityAt: string;
  metadata: Record<string, unknown>;
}

export interface OnboardingAnalytics {
  flowId: string;
  totalUsers: number;
  completionRate: number;
  avgCompletionTime: number; // minutes
  dropOffSteps: { stepId: string; dropOffRate: number }[];
  activeUsers: number;
}

// ─────────────────────────────────────────────────────────────────
// Onboarding Engine
// ─────────────────────────────────────────────────────────────────

export class OnboardingEngine {
  private flows: Map<string, OnboardingFlow> = new Map();
  private userStates: Map<string, UserOnboardingState> = new Map();

  // ─── Flow Management ────────────────────────────────────────

  registerFlow(flow: OnboardingFlow): void {
    this.flows.set(flow.id, flow);
  }

  getFlow(flowId: string): OnboardingFlow | undefined {
    return this.flows.get(flowId);
  }

  listFlows(): OnboardingFlow[] {
    return [...this.flows.values()];
  }

  // ─── User Progress ──────────────────────────────────────────

  startOnboarding(userId: string, tenantId: string, flowId: string): UserOnboardingState | null {
    const flow = this.flows.get(flowId);
    if (!flow) return null;

    const firstStep = flow.steps.sort((a, b) => a.order - b.order)[0];
    const state: UserOnboardingState = {
      userId,
      tenantId,
      flowId,
      status: "in_progress",
      currentStepId: firstStep?.id ?? "",
      completedSteps: [],
      skippedSteps: [],
      startedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      metadata: {},
    };

    this.userStates.set(`${userId}:${flowId}`, state);
    return state;
  }

  completeStep(userId: string, flowId: string, stepId: string): UserOnboardingState | null {
    const key = `${userId}:${flowId}`;
    const state = this.userStates.get(key);
    if (!state) return null;

    const flow = this.flows.get(flowId);
    if (!flow) return null;

    if (!state.completedSteps.includes(stepId)) {
      state.completedSteps.push(stepId);
    }
    state.lastActivityAt = new Date().toISOString();

    // Advance to next step
    const sortedSteps = flow.steps.sort((a, b) => a.order - b.order);
    const currentIdx = sortedSteps.findIndex((s) => s.id === stepId);
    const nextStep = sortedSteps[currentIdx + 1];

    if (nextStep) {
      state.currentStepId = nextStep.id;
    } else {
      state.status = "completed";
      state.completedAt = new Date().toISOString();
    }

    return state;
  }

  skipStep(userId: string, flowId: string, stepId: string): UserOnboardingState | null {
    const key = `${userId}:${flowId}`;
    const state = this.userStates.get(key);
    if (!state) return null;

    const flow = this.flows.get(flowId);
    if (!flow) return null;

    const step = flow.steps.find((s) => s.id === stepId);
    if (!step || !step.skippable) return null;

    state.skippedSteps.push(stepId);
    state.lastActivityAt = new Date().toISOString();

    // Advance to next step
    const sortedSteps = flow.steps.sort((a, b) => a.order - b.order);
    const currentIdx = sortedSteps.findIndex((s) => s.id === stepId);
    const nextStep = sortedSteps[currentIdx + 1];

    if (nextStep) {
      state.currentStepId = nextStep.id;
    } else {
      state.status = "completed";
      state.completedAt = new Date().toISOString();
    }

    return state;
  }

  getUserState(userId: string, flowId: string): UserOnboardingState | undefined {
    return this.userStates.get(`${userId}:${flowId}`);
  }

  getProgress(userId: string, flowId: string): { percent: number; completed: number; total: number; remaining: number } {
    const state = this.userStates.get(`${userId}:${flowId}`);
    const flow = this.flows.get(flowId);
    if (!state || !flow) return { percent: 0, completed: 0, total: 0, remaining: 0 };

    const total = flow.steps.length;
    const completed = state.completedSteps.length + state.skippedSteps.length;
    return {
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
      completed,
      total,
      remaining: total - completed,
    };
  }

  // ─── Analytics ──────────────────────────────────────────────

  getAnalytics(flowId: string): OnboardingAnalytics {
    const states = [...this.userStates.values()].filter((s) => s.flowId === flowId);
    const completed = states.filter((s) => s.status === "completed");
    const active = states.filter((s) => s.status === "in_progress");

    const completionTimes = completed
      .filter((s) => s.completedAt && s.startedAt)
      .map((s) => (new Date(s.completedAt!).getTime() - new Date(s.startedAt).getTime()) / 60000);

    const avgTime = completionTimes.length > 0
      ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
      : 0;

    // Calculate drop-off by step
    const flow = this.flows.get(flowId);
    const dropOffSteps = (flow?.steps ?? []).map((step) => {
      const reachedStep = states.filter((s) =>
        s.completedSteps.includes(step.id) || s.currentStepId === step.id || s.skippedSteps.includes(step.id)
      ).length;
      const dropOffRate = states.length > 0 ? 1 - (reachedStep / states.length) : 0;
      return { stepId: step.id, dropOffRate };
    });

    return {
      flowId,
      totalUsers: states.length,
      completionRate: states.length > 0 ? completed.length / states.length : 0,
      avgCompletionTime: Math.round(avgTime),
      dropOffSteps,
      activeUsers: active.length,
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// Pre-built Flows
// ─────────────────────────────────────────────────────────────────

export const DEFAULT_FLOWS: OnboardingFlow[] = [
  {
    id: "platform-quickstart",
    name: "Platform Quick Start",
    description: "Get up and running with D3VONN in 5 minutes",
    targetRole: "admin",
    estimatedMinutes: 5,
    requiredForActivation: true,
    steps: [
      { id: "qs-1", flowId: "platform-quickstart", title: "Create Your Workspace", description: "Set up your team workspace", type: "action", order: 1, helpContent: "A workspace is your team's home in D3VONN", skippable: false, dependencies: [] },
      { id: "qs-2", flowId: "platform-quickstart", title: "Invite Team Members", description: "Add your first team member", type: "action", order: 2, helpContent: "Team members can be assigned different roles", skippable: true, dependencies: ["qs-1"] },
      { id: "qs-3", flowId: "platform-quickstart", title: "Deploy Your First Agent", description: "Launch a pre-built agent from the marketplace", type: "tutorial", order: 3, helpContent: "Agents are AI-powered workers that automate tasks", skippable: false, dependencies: ["qs-1"] },
      { id: "qs-4", flowId: "platform-quickstart", title: "Create a Workflow", description: "Build your first automation workflow", type: "tutorial", order: 4, helpContent: "Workflows chain multiple agents together", skippable: true, dependencies: ["qs-3"] },
      { id: "qs-5", flowId: "platform-quickstart", title: "Review Dashboard", description: "Explore the platform dashboard", type: "verification", order: 5, helpContent: "The dashboard shows real-time agent activity", skippable: false, dependencies: ["qs-3"] },
    ],
  },
  {
    id: "developer-setup",
    name: "Developer Setup",
    description: "Set up your development environment for D3VONN",
    targetRole: "developer",
    estimatedMinutes: 15,
    requiredForActivation: false,
    steps: [
      { id: "dev-1", flowId: "developer-setup", title: "Install CLI", description: "Install the D3VONN CLI tool", type: "action", order: 1, helpContent: "The CLI provides local development capabilities", skippable: false, dependencies: [] },
      { id: "dev-2", flowId: "developer-setup", title: "Generate API Keys", description: "Create API keys for development", type: "action", order: 2, helpContent: "API keys authenticate your local environment", skippable: false, dependencies: ["dev-1"] },
      { id: "dev-3", flowId: "developer-setup", title: "Build Custom Plugin", description: "Create your first custom plugin", type: "tutorial", order: 3, helpContent: "Plugins extend agent capabilities", skippable: true, dependencies: ["dev-2"] },
      { id: "dev-4", flowId: "developer-setup", title: "Run Tests", description: "Execute the test suite", type: "verification", order: 4, helpContent: "Tests verify your plugin works correctly", skippable: true, dependencies: ["dev-3"] },
    ],
  },
];

export function createOnboardingEngine(): OnboardingEngine {
  const engine = new OnboardingEngine();
  DEFAULT_FLOWS.forEach((flow) => engine.registerFlow(flow));
  return engine;
}
