
# Devonn.AI Testing Guide

This document provides comprehensive guidance on testing the Devonn.AI Chrome Extension across various scenarios and environments.

## Table of Contents

- [Overview](#overview)
- [Testing Types](#testing-types)
- [Running Tests](#running-tests)
- [Edge Case Testing](#edge-case-testing)
- [Performance Testing](#performance-testing)
- [CI/CD Pipeline Tests](#cicd-pipeline-tests)
- [Writing New Tests](#writing-new-tests)

## Overview

Devonn.AI follows a comprehensive testing approach to ensure high quality and reliability:

- **Unit Tests**: Small, focused tests that verify individual pieces of functionality
- **Integration Tests**: Verify that different parts of the extension work together correctly
- **End-to-End Tests**: Test the extension as a whole in realistic browser environments
- **Edge Case Tests**: Target specific unusual or boundary conditions
- **Performance Tests**: Evaluate the extension's performance characteristics

## Testing Types

### Unit Tests

Located in `__tests__` directories throughout the codebase. Testing individual functions, classes, and components in isolation.

Example:
```typescript
// Example of a unit test
describe('calculateResult', () => {
  test('should add two numbers correctly', () => {
    expect(calculateResult(2, 3, 'add')).toBe(5);
  });
});
```

### Integration Tests

Located in `src/extension/__tests__`. Testing interactions between multiple components.

Example:
```typescript
// Example of an integration test
describe('API Client + Storage', () => {
  test('should store API responses correctly', async () => {
    const response = await apiClient.fetchData();
    const storedValue = await Storage.get('apiData');
    expect(storedValue).toEqual(response);
  });
});
```

### End-to-End Tests

Located in `src/extension/__tests__/e2e`. Testing the extension in a real browser environment.

Example:
```typescript
// Example of an E2E test
test('should open popup and display correct title', async ({ page }) => {
  await page.goto('chrome-extension://[id]/popup.html');
  await expect(page.locator('h1')).toContainText('Devonn.AI');
});
```

### Edge Case Tests

Located in `src/extension/__tests__/edgeCases.test.ts`. Testing unusual or boundary conditions.

Example:
```typescript
// Example of an edge case test
test('should handle corrupted storage data', async () => {
  await Storage.set('settings', { corrupted: true });
  const result = await initializeApp();
  expect(result.error).toBe(null);
});
```

### Performance Tests

Using Lighthouse CI and custom performance metrics.

## Running Tests

### Unit and Integration Tests

```bash
# Run all tests
npm test

# Run tests with watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run only extension tests
npm run test:extension

# Run edge case tests
npm run test:edge-cases
```

### End-to-End Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests in specific browser
npx playwright test --browser=chromium
```

### Performance Tests

```bash
# Run Lighthouse CI
npx lhci autorun
```

## Edge Case Testing

Edge case testing focuses on scenarios that might be rare but have high impact if unhandled. These tests are collected in `src/extension/__tests__/edgeCases.test.ts`.

Key edge case categories:

1. **Network Failures**
   - API timeouts
   - Intermittent connections
   - Corrupted responses

2. **Storage Issues**
   - Storage quota exceeded
   - Corrupt data
   - Concurrent access

3. **Browser Compatibility**
   - Different permission states
   - Tab context changes
   - Browser version differences

4. **Resource Limits**
   - Memory constraints
   - CPU intensive operations
   - Long-running operations

5. **User Input**
   - Malicious input (XSS)
   - Very long inputs
   - Special characters

6. **Internationalization**
   - RTL text
   - Multi-byte characters
   - Special language features

7. **Security**
   - Invalid tokens
   - CSRF attempts
   - Permission violations

8. **Multi-Instance**
   - Multiple extension instances running
   - Shared resource conflicts

## Performance Testing

Devonn.AI uses several tools to measure and ensure good performance:

1. **Lighthouse CI**
   - Measures page load performance
   - Accessibility scores
   - Best practices

2. **Bundle Analysis**
   - Analyzes bundle size and composition
   - Identifies opportunities for code splitting

3. **Memory Profiling**
   - Tracks memory usage patterns
   - Identifies potential leaks

4. **CPU Profiling**
   - Measures CPU-intensive operations
   - Identifies performance bottlenecks

## CI/CD Pipeline Tests

Our CI/CD pipeline runs the following test stages:

1. **Lint**: Static code analysis
2. **Security Scan**: pnpm audit, Dependency Review, Gitleaks, Grype SBOM vulnerability analysis, and CodeQL according to their workflow triggers
3. **Unit Test**: All Jest unit tests
4. **Extension Test**: Chrome extension specific tests
5. **E2E Test**: Playwright browser tests
6. **Performance Test**: Lighthouse CI and bundle analysis
7. **Integration Test**: Tests the built extension
8. **Smoke Test**: Basic post-deployment verification

## Writing New Tests

### Guidelines for writing effective tests:

1. **Test One Thing**: Each test should focus on one specific behavior or feature
2. **Independent**: Tests should not depend on other tests
3. **Deterministic**: Should provide the same result on each run
4. **Fast**: Should execute quickly to enable rapid development
5. **Readable**: Should clearly express what's being tested

### Test Structure:

Use the AAA pattern (Arrange, Act, Assert):

```typescript
test('should calculate discount correctly', () => {
  // Arrange: Set up the test conditions
  const product = { price: 100 };
  const discountPercent = 20;
  
  // Act: Perform the action to test
  const finalPrice = calculateDiscount(product, discountPercent);
  
  // Assert: Verify the result
  expect(finalPrice).toBe(80);
});
```

### Mocking:

Use Jest's mocking features to isolate the code under test:

```typescript
jest.mock('../api', () => ({
  fetchData: jest.fn().mockResolvedValue({ success: true })
}));

test('should handle API response', async () => {
  // The real API won't be called, the mock will be used instead
  const result = await processApiData();
  expect(result.processed).toBe(true);
});
```

### Test Coverage:

Aim for high test coverage, especially for critical paths:

```bash
# Generate and view coverage report
npm run test:coverage
```

Critical areas that must have high coverage:
- Authentication/Authorization logic
- Data processing functions
- Extension core functionality
- Error handling paths
