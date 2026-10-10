
#!/usr/bin/env node

/**
 * Release management script for Devonn.AI
 * 
 * This script helps manage the release process by:
 * 1. Bumping version numbers
 * 2. Generating changelogs from git commits
 * 3. Creating release tags
 * 
 * Usage: node scripts/release.js [major|minor|patch]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get release type from command line
const releaseType = process.argv[2] || 'patch';
if (!['major', 'minor', 'patch'].includes(releaseType)) {
  console.error('❌ Invalid release type. Use: major, minor, or patch');
  process.exit(1);
}

// Read the package.json
const packageJsonPath = path.join(__dirname, '../package.json');
const manifestJsonPath = path.join(__dirname, '../manifest.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const manifestJson = JSON.parse(fs.readFileSync(manifestJsonPath, 'utf8'));

// Parse current version
const currentVersion = packageJson.version;
const [major, minor, patch] = currentVersion.split('.').map(Number);

// Calculate new version
let newVersion;
switch (releaseType) {
  case 'major':
    newVersion = `${major + 1}.0.0`;
    break;
  case 'minor':
    newVersion = `${major}.${minor + 1}.0`;
    break;
  case 'patch':
    newVersion = `${major}.${minor}.${patch + 1}`;
    break;
}

console.log(`Preparing release: ${currentVersion} → ${newVersion}`);

// Get git log since last tag for changelog
const lastTag = execSync('git describe --tags --abbrev=0 2>/dev/null || echo "none"').toString().trim();
const gitLog = execSync(`git log ${lastTag === 'none' ? '' : `${lastTag}..HEAD`} --pretty=format:"* %s (%h)"`).toString();

// Generate changelog content
const date = new Date().toISOString().split('T')[0];
const changelogEntry = `# ${newVersion} (${date})\n\n${gitLog || '* No changes'}\n\n`;

// Update version in package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

// Update version in manifest.json
manifestJson.version = newVersion;
fs.writeFileSync(manifestJsonPath, JSON.stringify(manifestJson, null, 2) + '\n');

// Update CHANGELOG.md
const changelogPath = path.join(__dirname, '../CHANGELOG.md');
const existingChangelog = fs.existsSync(changelogPath) 
  ? fs.readFileSync(changelogPath, 'utf8') 
  : '# Changelog\n\n';
fs.writeFileSync(changelogPath, `${existingChangelog.split('# Changelog\n\n')[0]}# Changelog\n\n${changelogEntry}${existingChangelog.split('# Changelog\n\n')[1] || ''}`);

console.log('✅ Updated:');
console.log(`  - package.json: ${newVersion}`);
console.log(`  - manifest.json: ${newVersion}`);
console.log(`  - CHANGELOG.md: Added entry for ${newVersion}`);
console.log('\nNext steps:');
console.log(`  1. Review the changes: git diff`);
console.log(`  2. Commit the release: git commit -am "Release ${newVersion}"`);
console.log(`  3. Tag the release: git tag -a v${newVersion} -m "Version ${newVersion}"`);
console.log(`  4. Push changes: git push && git push --tags`);
