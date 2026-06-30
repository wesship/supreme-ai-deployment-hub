/**
 * D3VONN Customer Success Layer
 *
 * Complete customer success toolkit with guided onboarding,
 * health scoring, churn prediction, and feature flags.
 */

export {
  OnboardingEngine,
  createOnboardingEngine,
  DEFAULT_FLOWS,
  type OnboardingFlow,
  type OnboardingStep,
  type UserOnboardingState,
  type OnboardingStatus,
  type StepType,
  type OnboardingAnalytics,
} from "./onboarding";

export {
  HealthScoreEngine,
  createHealthScoreEngine,
  type HealthScore,
  type HealthSignal,
  type HealthStatus,
  type SignalCategory,
  type EngagementMetrics,
  type HealthAlert,
} from "./health-scores";

export {
  FeatureFlagEngine,
  createFeatureFlagEngine,
  type FeatureFlag,
  type FlagStatus,
  type RolloutStrategy,
  type RolloutConfig,
  type TargetingRule,
  type FlagVariant,
  type FlagEvaluation,
  type FlagAnalytics,
} from "./feature-flags";
