module.exports = {
  parserPreset: {
    parserOpts: {
      // Accept both conventional commits (feat: ...) and legacy format (Implement ...)
      headerPattern: /^([a-zA-Z]+(?:-[0-9]+)?|phase-[0-9]+)(?:\(([^)]*)\))?:?\s*(.+)$/,
      headerCorrespondence: ['type', 'scope', 'subject'],
    },
  },
  rules: {
    'header-max-length': [2, 'always', 200],
    'subject-empty': [2, 'never'],
    'type-empty': [2, 'never'],
    'type-enum': [
      2,
      'always',
      [
        'build',
        'chore',
        'ci',
        'docs',
        'feat',
        'fix',
        'merge',
        'perf',
        'refactor',
        'revert',
        'style',
        'test',
        'wave-30',
        'wave-31',
        'wave-32',
        'wave-33',
        'wave-34',
        'phase-37',
        // Legacy commit types from prior development phases
        'Implement',
        'Add',
      ],
    ],
  },
};
