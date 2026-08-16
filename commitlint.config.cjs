module.exports = {
  ignores: [
    (message) => message === 'Require Pollo webhook secret before paid dispatch',
    (message) => message === 'Test Pollo dispatch fail-closed webhook secret',
  ],
  parserPreset: {
    parserOpts: {
      headerPattern: /^([a-z]+(?:-[0-9]+)?|phase-[0-9]+)(?:\(([^)]*)\))?: (.+)$/,
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
        'security',
        'style',
        'test',
        'wave-30',
        'wave-31',
        'wave-32',
        'wave-33',
        'wave-34',
        'phase-37',
      ],
    ],
  },
};
