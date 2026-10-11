const baseline = require('./lighthouse-config.json');

// Share release budgets with desktop; use Lighthouse's mobile throttling defaults.
module.exports = {
  ci: {
    ...baseline.ci,
    collect: {
      ...baseline.ci.collect,
      settings: {
        throttlingMethod: 'simulate',
        formFactor: 'mobile',
        screenEmulation: {
          mobile: true,
          width: 390,
          height: 844,
          deviceScaleFactor: 2,
          disabled: false,
        },
      },
    },
  },
};
