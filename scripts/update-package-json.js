
const fs = require('fs');
const path = require('path');

// Read the package.json file
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Add or update deployment and release scripts
packageJson.scripts = {
  ...packageJson.scripts,
  "test": "jest",
  "test:watch": "jest --watch",
  "test:extension": "node scripts/run-extension-tests.js",
  "test:e2e": "playwright test",
  "test:ci": "jest --ci --coverage && playwright test",
  "test:coverage": "jest --coverage",
  "test:edge-cases": "jest src/extension/__tests__/edgeCases.test.ts",
  "build:dev": "node scripts/build-env.js development",
  "build:staging": "node scripts/build-env.js staging", 
  "build:prod": "node scripts/build-env.js production && node scripts/optimize-production-build.js",
  "release:patch": "node scripts/release.js patch",
  "release:minor": "node scripts/release.js minor",
  "release:major": "node scripts/release.js major",
  "deploy:chrome": "chrome-webstore-upload upload --source ./dist",
  "k8s:deploy": "kubectl apply -f kubernetes/",
  "k8s:validate": "kubeval kubernetes/*.yaml",
  "optimize": "node scripts/optimize-production-build.js"
};

// Write the updated package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

console.log('✅ Updated package.json with deployment, testing and release scripts');
