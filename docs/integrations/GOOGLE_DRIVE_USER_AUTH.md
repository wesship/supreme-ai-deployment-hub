# Google Drive Per-User Authorization

## Goal

D3VONN.IO must let each user connect their own Google Drive account. The app should not rely on the founder account, a shared Drive connection, or any server-side personal credential for user file access.

## Current Error

If the browser or app shows:

```text
Unsupported provider: provider is not enabled
```

that means the Google OAuth provider has not been enabled/configured in Supabase Auth for this project, or the redirect URL does not match the configured OAuth application.

## Required Supabase Setup

In Supabase:

1. Go to **Authentication → Providers → Google**.
2. Enable Google.
3. Add the Google OAuth client ID and client secret.
4. Add site URL:

```text
https://d3vonn.io
```

5. Add redirect URLs:

```text
https://d3vonn.io/auth/callback
https://www.d3vonn.io/auth/callback
http://localhost:5173/auth/callback
```

## Required Google Cloud Setup

In Google Cloud Console:

1. Create or select the D3VONN.IO OAuth app.
2. Enable Google Drive API.
3. Add authorized JavaScript origins:

```text
https://d3vonn.io
https://www.d3vonn.io
http://localhost:5173
```

4. Add authorized redirect URIs:

```text
https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback
```

5. Request only the minimum scopes needed:

```text
openid
email
profile
https://www.googleapis.com/auth/drive.file
```

## Why `drive.file`

Use `drive.file`, not full-drive access. This gives D3VONN access only to files the user explicitly opens, creates, or authorizes through the app.

## Product Rule

Every Drive authorization must be user-owned:

- User signs in with their own Google account.
- User grants D3VONN permission.
- User-selected files are uploaded or processed for that user only.
- No founder-owned Google Drive account should be used as a shared provider.

## Follow-up Backend Work

The current UI starts the Google OAuth flow with Drive scope. The production backend should add:

1. A per-user Drive connection table.
2. Encrypted token storage if provider tokens are persisted.
3. A file import endpoint that associates selected Drive files with the authenticated user.
4. Row-level security so users only see their own imported files.
5. Token revocation/disconnect support.
