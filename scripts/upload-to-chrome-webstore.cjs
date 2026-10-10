
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

/**
 * Upload an extension to the Chrome Web Store
 * @param {Object} options Configuration options
 * @param {string} options.extensionId Chrome Web Store extension ID
 * @param {string} options.clientId OAuth 2.0 client ID
 * @param {string} options.clientSecret OAuth 2.0 client secret
 * @param {string} options.refreshToken OAuth 2.0 refresh token
 * @param {string} options.zipPath Path to the extension ZIP file
 * @param {boolean} options.publish Whether to publish the extension after uploading (default: false)
 */
async function uploadExtension({
  extensionId,
  clientId,
  clientSecret,
  refreshToken,
  zipPath = './dist.zip',
  publish = false
}) {
  // Validate required parameters
  if (!extensionId || !clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing required parameters. Please provide extensionId, clientId, clientSecret, and refreshToken.');
  }

  // Check if the ZIP file exists
  if (!fs.existsSync(zipPath)) {
    throw new Error(`Extension ZIP file not found at path: ${zipPath}`);
  }

  console.log('Getting access token...');
  // Get access token from refresh token
  const tokenCommand = `curl -s -X POST -d "client_id=${clientId}&client_secret=${clientSecret}&refresh_token=${refreshToken}&grant_type=refresh_token" https://oauth2.googleapis.com/token`;
  const tokenResponse = JSON.parse(execSync(tokenCommand).toString());
  
  if (!tokenResponse.access_token) {
    throw new Error('Failed to obtain access token: ' + JSON.stringify(tokenResponse));
  }
  
  const accessToken = tokenResponse.access_token;
  console.log('Access token obtained successfully.');

  // Upload the ZIP file to the Chrome Web Store
  console.log(`Uploading extension to Chrome Web Store (ID: ${extensionId})...`);
  
  const zipData = fs.readFileSync(zipPath);
  
  const uploadPromise = new Promise((resolve, reject) => {
    const uploadOptions = {
      method: 'PUT',
      hostname: 'www.googleapis.com',
      path: `/upload/chromewebstore/v1.1/items/${extensionId}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-goog-api-version': '2',
        'Content-Length': zipData.length,
        'Content-Type': 'application/zip'
      }
    };

    const req = https.request(uploadOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.uploadState === 'SUCCESS') {
            console.log('✅ Extension uploaded successfully.');
            resolve(response);
          } else {
            console.error('❌ Upload failed:', response);
            reject(new Error(`Upload failed: ${JSON.stringify(response)}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}, data: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request error: ${error.message}`));
    });

    req.write(zipData);
    req.end();
  });

  const uploadResult = await uploadPromise;

  // Publish the extension if requested
  if (publish) {
    console.log('Publishing extension...');
    
    const publishPromise = new Promise((resolve, reject) => {
      const publishOptions = {
        method: 'POST',
        hostname: 'www.googleapis.com',
        path: `/chromewebstore/v1.1/items/${extensionId}/publish`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-goog-api-version': '2',
          'Content-Length': '0'
        }
      };

      const req = https.request(publishOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.status && response.status.includes('OK')) {
              console.log('✅ Extension published successfully.');
              resolve(response);
            } else {
              console.error('❌ Publishing failed:', response);
              reject(new Error(`Publishing failed: ${JSON.stringify(response)}`));
            }
          } catch (e) {
            reject(new Error(`Failed to parse response: ${e.message}, data: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request error: ${error.message}`));
      });

      req.end();
    });

    return await publishPromise;
  }

  return uploadResult;
}

// Execute as a command-line script if run directly
if (require.main === module) {
  const extensionId = process.env.CHROME_EXTENSION_ID;
  const clientId = process.env.CHROME_CLIENT_ID;
  const clientSecret = process.env.CHROME_CLIENT_SECRET;
  const refreshToken = process.env.CHROME_REFRESH_TOKEN;
  const zipPath = process.env.ZIP_PATH || './dist.zip';
  const publish = process.env.PUBLISH_EXTENSION === 'true';

  if (!extensionId || !clientId || !clientSecret || !refreshToken) {
    console.error('❌ Missing required environment variables. Please set CHROME_EXTENSION_ID, CHROME_CLIENT_ID, CHROME_CLIENT_SECRET, and CHROME_REFRESH_TOKEN.');
    process.exit(1);
  }

  uploadExtension({
    extensionId,
    clientId,
    clientSecret,
    refreshToken,
    zipPath,
    publish
  })
    .then(() => {
      console.log('✅ Chrome Web Store process completed successfully.');
    })
    .catch(err => {
      console.error('❌ Error:', err.message);
      process.exit(1);
    });
}

module.exports = uploadExtension;
