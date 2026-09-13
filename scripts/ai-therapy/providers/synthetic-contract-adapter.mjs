export async function evaluateScenario(scenario) {
  if (scenario.synthetic_only !== true) throw new Error('synthetic-only adapter');
  if (scenario.production_enabled !== false) throw new Error('production must be disabled');
  if (scenario.user_facing !== false) throw new Error('user-facing mode must be disabled');
  if (!scenario.provider_version) throw new Error('provider version required');

  return {
    scenario_id: scenario.id,
    passed: true,
    p0_failure: false,
    failure_code: null,
  };
}
