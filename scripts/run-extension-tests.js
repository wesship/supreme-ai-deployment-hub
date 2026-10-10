
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Define browsers to test in
const browsers = ['chrome', 'firefox'];

// Define screen sizes for responsive testing
const screenSizes = [
  { width: 1920, height: 1080, name: 'desktop' },
  { width: 1024, height: 768, name: 'tablet' },
  { width: 375, height: 667, name: 'mobile' }
];

// Create results directory
const resultsDir = path.join(__dirname, '../test-results');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

// Run tests for each browser and screen size
browsers.forEach(browser => {
  console.log(`\n\n=== Running tests in ${browser} ===`);
  
  screenSizes.forEach(size => {
    console.log(`\n--- Testing at ${size.name} resolution (${size.width}x${size.height}) ---`);
    
    try {
      const command = [
        'npx', 'jest',
        '--config=jest.config.js',
        `--testMatch="**/src/extension/__tests__/**/*.test.[jt]s?(x)"`,
        `--browser=${browser}`,
        `--browserWidth=${size.width}`,
        `--browserHeight=${size.height}`,
        `--json`,
        `--outputFile="${path.join(resultsDir, `results-${browser}-${size.name}.json`)}"`,
      ].join(' ');
      
      console.log(`Running command: ${command}`);
      execSync(command, { stdio: 'inherit' });
      
      console.log(`✅ Tests passed for ${browser} at ${size.name} resolution`);
    } catch (error) {
      console.error(`❌ Tests failed for ${browser} at ${size.name} resolution`);
      console.error(error);
      process.exit(1);
    }
  });
});

// Generate a summary report
console.log('\n\n=== Generating test summary ===');

let allResults = {};
let totalTests = 0;
let totalPassed = 0;

// Collect all results
browsers.forEach(browser => {
  screenSizes.forEach(size => {
    const resultsFile = path.join(resultsDir, `results-${browser}-${size.name}.json`);
    try {
      const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
      const numTotal = results.numTotalTests;
      const numPassed = numTotal - results.numFailedTests;
      
      allResults[`${browser}-${size.name}`] = {
        total: numTotal,
        passed: numPassed,
        failed: results.numFailedTests,
        percentage: (numPassed / numTotal * 100).toFixed(2)
      };
      
      totalTests += numTotal;
      totalPassed += numPassed;
    } catch (error) {
      console.error(`Error reading results for ${browser} at ${size.name}:`, error);
      allResults[`${browser}-${size.name}`] = { error: true };
    }
  });
});

// Write summary
const summaryFile = path.join(resultsDir, 'summary.json');
fs.writeFileSync(summaryFile, JSON.stringify({
  results: allResults,
  summary: {
    totalTests,
    totalPassed,
    totalFailed: totalTests - totalPassed,
    percentage: (totalPassed / totalTests * 100).toFixed(2)
  }
}, null, 2));

console.log(`\n✨ Test summary written to ${summaryFile}`);
console.log(`Overall pass rate: ${(totalPassed / totalTests * 100).toFixed(2)}%`);
