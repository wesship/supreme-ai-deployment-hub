/**
 * Version bumping script for Chrome Extension
 * 
 * This script automatically increments the version number in manifest.json
 * Use this script as part of automated workflows to ensure version numbers
 * are always incremented before deployment.
 */

const fs = require('fs');
const path = require('path');

// Path to manifest.json
const manifestPath = path.join(__dirname, '../manifest.json');

// Read the manifest file
try {
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestContent);
  
  console.log(`Current version: ${manifest.version}`);
  
  // Parse the version components
  const versionParts = manifest.version.split('.').map(Number);
  
  // Increment the patch version
  versionParts[2] += 1;
  
  // If patch version exceeds 9, increment minor version and reset patch
  if (versionParts[2] > 9) {
    versionParts[1] += 1;
    versionParts[2] = 0;
    
    // If minor version exceeds 9, increment major version and reset minor
    if (versionParts[1] > 9) {
      versionParts[0] += 1;
      versionParts[1] = 0;
    }
  }
  
  // Create the new version string
  const newVersion = versionParts.join('.');
  
  // Update the manifest version
  manifest.version = newVersion;
  
  // Write the updated manifest back to file
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  console.log(`Version bumped to: ${newVersion}`);
} catch (error) {
  console.error(`Error bumping version: ${error.message}`);
  process.exit(1);
}
