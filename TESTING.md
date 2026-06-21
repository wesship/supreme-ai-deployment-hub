
# DEVONN.AI Testing Documentation

This document outlines the testing strategy and procedures for the DEVONN.AI project, including the core application and Chrome extension.

## Table of Contents

- [Testing Overview](#testing-overview)
- [Testing Environments](#testing-environments)
- [Types of Tests](#types-of-tests)
- [Running Tests](#running-tests)
- [Test Coverage](#test-coverage)
- [Continuous Integration](#continuous-integration)
- [Browser Compatibility](#browser-compatibility)
- [Accessibility Testing](#accessibility-testing)
- [Performance Testing](#performance-testing)
- [Contributing Tests](#contributing-tests)

## Testing Overview

The DEVONN.AI testing strategy employs a comprehensive approach including:

- **Unit Tests**: Testing individual components and functions in isolation
- **Integration Tests**: Testing interactions between components
- **End-to-End Tests**: Testing complete user workflows
- **Browser Compatibility Tests**: Ensuring functionality across different browsers
- **Accessibility Tests**: Verifying WCAG 2.1 compliance
- **Performance Tests**: Measuring loading times and resource usage

## Testing Environments

| Environment | Purpose | Configuration |
|-------------|---------|--------------|
| Development | Local testing during development | `npm test` |
| CI Pipeline | Automated testing in CI | `npm run test:ci` |
| Staging | Pre-deployment testing | Kubernetes staging cluster |
| Production | Post-deployment smoke tests | Production environment |

## Types of Tests

### Unit Tests

Unit tests are written using Jest and React Testing Library. They focus on testing individual components, hooks, and utility functions in isolation.

**Key Test Files:**
- `src/extension/__tests__/settingsValidation.test.ts`: Tests for extension settings validation
- `src/extension/__tests__/settingsUI.test.ts`: Tests for extension settings UI components
- `src/extension/__tests__/settingsHandlers.test.ts`: Tests for extension settings event handlers
- `src/extension/__tests__/settingsDocumentation.test.ts`: Tests for extension settings documentation
- `src/components/api/__tests__/*.test.tsx`: Tests for API components

#### Example Unit Test:

```javascript
describe('Settings Validation', () => {
  it('validates API URL format', () => {
    expect(validateApiUrl('https://api.d3vonn.io')).toBe(true);
    expect(validateApiUrl('not-a-url')).toBe(false);
  });
});
```

### Integration Tests

Integration tests verify that different components work together correctly. These tests use Jest and React Testing Library to simulate user interactions across multiple components.

**Key Test Files:**
- `src/api/__tests__/integration/*.test.ts`: API integration tests
- `src/components/api/__tests__/APIPlaygroundFlow.test.tsx`: Tests API playground component interactions

#### Example Integration Test:

```javascript
describe('API Playground Flow', () => {
  it('handles successful API request and displays response', async () => {
    const { getByLabelText, getByText } = render(<APIPlaygroundTab />);
    
    // Fill in request details
    fireEvent.change(getByLabelText('Endpoint'), { target: { value: '/test' } });
    fireEvent.click(getByText('Send Request'));
    
    // Wait for response
    await waitFor(() => {
      expect(getByText('200 OK')).toBeInTheDocument();
    });
  });
});
```

### End-to-End Tests

End-to-end tests use Playwright to test complete user journeys through the application. These tests run in real browsers and simulate real user interactions.

**Key Test Files:**
- `src/extension/__tests__/e2e/settings.e2e.test.ts`: Extension settings E2E tests
- `e2e/*.test.ts`: Application E2E tests

#### Example E2E Test:

```javascript
test('user can log in and view dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name=email]', 'test@example.com');
  await page.fill('[name=password]', 'password123');
  await page.click('button[type=submit]');
  
  // Verify user is redirected to dashboard
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('h1')).toContainText('Dashboard');
});
```

## Running Tests

### Prerequisites

- Node.js 16 or later
- npm 7 or later
- Chrome browser for extension tests

### Commands

```bash
# Run all tests
npm test

# Run tests with watch mode
npm run test:watch

# Run only extension tests
npm run test:extension

# Run end-to-end tests
npm run test:e2e

# Run tests with coverage reports
npm run test:coverage

# Run tests in CI mode
npm run test:ci
```

## Test Coverage

We aim for at least 80% test coverage for critical paths including:

- Extension settings validation
- API request/response handling
- Authentication flows
- Core AI functionality

Coverage reports are generated using Jest's coverage tools. View the latest coverage report by running:

```bash
npm run test:coverage
```

The report will be available in the `coverage/` directory.

## Continuous Integration

All tests are run automatically as part of our CI/CD pipeline:

1. Commit to any branch: Unit tests run
2. Pull request: Unit tests + Integration tests run
3. Merge to main: Unit tests + Integration tests + E2E tests run
4. Release tag: Full test suite + Browser compatibility tests

## Browser Compatibility

We test DEVONN.AI across the following browsers and versions:

| Browser | Versions |
|---------|----------|
| Chrome  | Latest 3 versions |
| Firefox | Latest 3 versions |
| Safari  | Latest 2 versions |
| Edge    | Latest 3 versions |

Browser compatibility tests use Playwright to run end-to-end tests across multiple browsers.

## Accessibility Testing

We ensure DEVONN.AI meets WCAG 2.1 AA standards by:

- Running automated accessibility tests using axe-core
- Conducting manual keyboard navigation tests
- Testing screen reader compatibility

Accessibility tests are included in the E2E test suite.

## Performance Testing

Performance testing includes:

- Lighthouse CI for web performance metrics
- Custom timing for API response times
- Extension load time measurements

Performance tests run as part of the pre-release pipeline.

## Contributing Tests

When contributing to the project, please follow these testing guidelines:

1. Add unit tests for all new functions and components
2. Add integration tests for new feature flows
3. Update existing tests when modifying functionality
4. Ensure tests run without warnings or errors

For detailed contribution guidelines, see CONTRIBUTING.md.

## Testing Chrome Extension

### Setup Test Environment

1. Create a clean Chrome profile for testing:

```bash
mkdir -p ~/chrome-testing-profile
```

2. Launch Chrome with the testing profile:

```bash
google-chrome --user-data-dir=~/chrome-testing-profile
```

3. Load the extension in developer mode:
   - Go to chrome://extensions
   - Enable "Developer mode"
   - Click "Load unpacked" and select the extension directory

### Manual Testing Checklist

- [ ] Extension icon appears in toolbar
- [ ] Popup opens when clicking the icon
- [ ] Settings page opens
- [ ] Settings save correctly
- [ ] Notifications appear when enabled
- [ ] API connection works
- [ ] Agent list loads
- [ ] Tasks can be created and run

### Automated Extension Tests

The extension tests are split into unit tests and E2E tests:

```bash
# Run extension unit tests
npm run test:extension

# Run extension E2E tests (requires Chrome)
npm run test:extension:e2e
```

These tests verify the extension functionality, including settings validation, UI rendering, and API interactions.
