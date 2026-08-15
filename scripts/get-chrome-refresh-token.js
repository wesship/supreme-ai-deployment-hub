const crypto = require('crypto');
const http = require('http');
const open = require('open');
const { spawnSync } = require('child_process');

const CLIENT_ID = process.env.CHROME_CLIENT_ID;
const CLIENT_SECRET = process.env.CHROME_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Error: CHROME_CLIENT_ID and CHROME_CLIENT_SECRET environment variables are required.');
  process.exit(1);
}

const HOST = '127.0.0.1';
const PORT = 0;
let server;

async function exchangeAuthorizationCode({ code, redirectUri }) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    redirect: 'error',
  });

  const payload = await response.json();
  if (!response.ok) {
    const errorCode = typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`;
    throw new Error(`Google token exchange failed: ${errorCode}`);
  }

  return payload;
}

function storeRefreshTokenWithGitHubCli(refreshToken) {
  const result = spawnSync('gh', ['secret', 'set', 'CHROME_REFRESH_TOKEN'], {
    input: refreshToken,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (result.error || result.status !== 0) {
    return false;
  }

  return true;
}

async function getRefreshToken() {
  return new Promise((resolve, reject) => {
    const oauthState = crypto.randomBytes(32).toString('hex');
    let settled = false;

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      if (server?.listening) server.close();
      callback(value);
    };

    server = http.createServer(async (req, res) => {
      try {
        const requestUrl = new URL(req.url, `http://${HOST}`);
        if (requestUrl.pathname !== '/oauth2/callback') {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not Found');
          return;
        }

        const code = requestUrl.searchParams.get('code');
        const returnedState = requestUrl.searchParams.get('state');

        if (!code || returnedState !== oauthState) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<html><body><h1>Authorization Failed</h1><p>The OAuth response was invalid.</p></body></html>');
          finish(reject, new Error('Invalid OAuth callback: missing code or state mismatch.'));
          return;
        }

        const port = server.address().port;
        const redirectUri = `http://${HOST}:${port}/oauth2/callback`;
        const tokenResponse = await exchangeAuthorizationCode({ code, redirectUri });

        if (!tokenResponse.refresh_token) {
          throw new Error('No refresh token received from Google. Revoke the prior grant and retry with consent if needed.');
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body><h1>Authorization Successful</h1><p>You can close this window and return to the terminal.</p></body></html>');

        console.log('\n✅ Successfully obtained a Chrome Web Store refresh token.');
        if (storeRefreshTokenWithGitHubCli(tokenResponse.refresh_token)) {
          console.log('✅ Stored it as the GitHub Actions secret CHROME_REFRESH_TOKEN without printing the token.');
        } else {
          console.log('⚠️ The token was not printed. Install/authenticate GitHub CLI and rerun this helper to store CHROME_REFRESH_TOKEN securely.');
        }

        finish(resolve, tokenResponse.refresh_token);
      } catch (error) {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Internal Server Error');
        }
        console.error('❌ OAuth token exchange failed:', error instanceof Error ? error.message : 'Unknown error');
        finish(reject, error);
      }
    });

    server.listen(PORT, HOST, () => {
      const port = server.address().port;
      const redirectUri = `http://${HOST}:${port}/oauth2/callback`;
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', CLIENT_ID);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/chromewebstore');
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('state', oauthState);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');

      console.log(`OAuth callback listening on ${redirectUri}`);
      console.log('Opening browser for Google OAuth authentication...');

      open(authUrl.toString()).catch(error => {
        console.error('❌ Error opening browser:', error instanceof Error ? error.message : 'Unknown error');
        console.log('Open the Google authorization URL from this process manually; it is intentionally not echoed because it contains request state.');
      });
    });

    server.on('error', error => finish(reject, error));
  });
}

if (require.main === module) {
  getRefreshToken().catch(() => {
    process.exitCode = 1;
  });
}

module.exports = getRefreshToken;
