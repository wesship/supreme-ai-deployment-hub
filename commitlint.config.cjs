module.exports = {
  extends: ['@commitlint/config-conventional'],
  parserPreset: {
    parserOpts: {
      headerPattern: /^([a-z]+(?:-[0-9]+)?|phase-[0-9]+)(?:\(([^)]*)\))?: (.+)$/,
      headerCorrespondence: ['type', 'scope', 'subject'],
    },
  },
  rules: {
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
      ],
    ],
  },
};
