/**
 * D3VONN Autonomous Operations
 *
 * Long-running goal management with recursive decomposition,
 * self-healing, cost-aware routing, and progress tracking.
 */

export {
  GoalEngine,
  createGoalEngine,
  type Goal,
  type Subtask,
  type GoalStatus,
  type GoalPriority,
  type SubtaskStrategy,
  type GoalConstraints,
  type GoalProgress,
  type RoutingDecision,
  type AgentAssignment,
  type SelfHealingAction,
  type CostModel,
} from "./goal-engine";
