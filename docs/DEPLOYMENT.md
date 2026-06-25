
# D3VONN.IO Chrome Extension Deployment Guide

This document outlines the deployment process for the D3VONN.IO Chrome Extension across multiple environments.

## Deployment Environments

The D3VONN.IO Chrome Extension supports three deployment environments:

### Development
- **Purpose**: Local development and testing
- **API URL**: http://localhost:8000
- **Features**: All experimental features enabled
- **Audience**: Developers

### Staging
- **Purpose**: QA testing and pre-release verification
- **API URL**: https://staging-api.d3vonn.io
- **Features**: Beta features enabled for testing
- **Audience**: Internal testers and select beta users

### Production
- **Purpose**: Public release
- **API URL**: https://api.d3vonn.io
- **Features**: Only stable features enabled
- **Audience**: End users via Chrome Web Store

## Deployment Methods

### Manual Deployment

1. Build the extension for the desired environment:
   ```bash
   node scripts/build-env.js [environment]
   ```
   Where `[environment]` is one of: development, staging, production

2. The script will generate a ZIP file: `devonn-ai-[environment].zip`

3. For Chrome Web Store deployment:
   - Log in to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Upload the ZIP file for the production environment
   - Submit for review

### CI/CD Deployment

The project uses GitHub Actions for automated testing and deployment:

1. **Automated Testing**:
   - Runs on all pull requests to `main` and `develop` branches
   - Executes linting, unit tests, and end-to-end tests

2. **Automated Builds**:
   - Creates builds for all environments
   - Uploads build artifacts

3. **Automated Deployment**:
   - Production deployment occurs automatically when code is merged to the `main` branch
   - Manual deployments can be triggered through the GitHub Actions interface

## Release Process

### Creating a New Release

1. Run the release script to bump version and generate changelog:
   ```bash
   node scripts/release.js [major|minor|patch]
   ```

2. Review the generated changes in:
   - package.json
   - manifest.json
   - CHANGELOG.md

3. Commit and push the release:
   ```bash
   git commit -am "Release x.y.z"
   git tag -a vx.y.z -m "Version x.y.z"
   git push && git push --tags
   ```

4. The CI/CD pipeline will automatically:
   - Run tests
   - Build for all environments
   - Deploy to the Chrome Web Store (production only)
   - Create a GitHub release

### Hotfix Process

For urgent fixes to production:

1. Create a hotfix branch from the main branch:
   ```bash
   git checkout -b hotfix/issue-description main
   ```

2. Make necessary changes, commit them

3. Run the release script with 'patch':
   ```bash
   node scripts/release.js patch
   ```

4. Create a pull request to the main branch

5. After merging, the CI/CD pipeline will deploy automatically

## Chrome Web Store Publishing

The extension is published to the Chrome Web Store through:

1. **Manual Publishing**: Upload through the Chrome Developer Dashboard
2. **Automated Publishing**: Using the GitHub Actions workflow and Chrome Web Store API

### Requirements for Chrome Web Store Publishing

- Chrome Developer account
- Extension ID registered in the Chrome Web Store
- API access credentials configured as GitHub secrets:
  - CHROME_EXTENSION_ID
  - CHROME_CLIENT_ID
  - CHROME_CLIENT_SECRET
  - CHROME_REFRESH_TOKEN

## Monitoring and Rollback

### Monitoring Deployments

- Monitor user feedback and reviews in the Chrome Web Store
- Track performance metrics through extension analytics
- Monitor error reports through the D3VONN.IO backend

### Rollback Procedure

If issues are detected in a production release:

1. Revert to the previous version tag:
   ```bash
   git checkout v[previous-version]
   ```

2. Run the release script to create a new patch version:
   ```bash
   node scripts/release.js patch
   ```

3. Follow the regular release process to deploy the rollback
