/**
 * commitlint.config.js — Devonn.AI Commit Message Enforcement
 *
 * Enforces Conventional Commits format on every commit.
 * This is required for semantic-release to correctly determine version bumps.
 *
 * Valid commit types:
 *   feat     — A new feature (triggers minor version bump)
 *   fix      — A bug fix (triggers patch version bump)
 *   docs     — Documentation changes only
 *   style    — Code style changes (formatting, whitespace)
 *   refactor — Code change that neither fixes a bug nor adds a feature
 *   perf     — Performance improvement (triggers patch version bump)
 *   test     — Adding or updating tests
 *   build    — Changes to build system or dependencies
 *   ci       — Changes to CI/CD configuration
 *   chore    — Maintenance tasks (no production code change)
 *   revert   — Reverts a previous commit
 *
 * Breaking changes: add "!" after the type, e.g. "feat!: remove legacy API"
 * This triggers a major version bump.
 *
 * Examples:
 *   feat(auth): add OAuth2 login with GitHub
 *   fix(api): handle null response from OpenAI endpoint
 *   chore(deps): update @sentry/react to 8.0.0
 *   feat!: remove deprecated v1 API endpoints
 */

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Enforce lowercase type
    'type-case': [2, 'always', 'lower-case'],
    // Enforce known types only
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'],
    ],
    // Subject must not end with a period
    'subject-full-stop': [2, 'never', '.'],
    // Subject must not be empty
    'subject-empty': [2, 'never'],
    // Subject must be in sentence case (first letter lowercase)
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    // Header (type + scope + subject) must not exceed 100 characters
    'header-max-length': [2, 'always', 100],
    // Body lines must not exceed 200 characters
    'body-max-line-length': [1, 'always', 200],
  },
};
