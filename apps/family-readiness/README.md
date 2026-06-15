# Family Financial Readiness Challenge

Educational lead-generation assessment for the DEVONN insurance CRM track.

## Included

- Responsive landing page
- Seven-step readiness assessment
- 0–14 score calculation
- Separate email and optional SMS permission
- Privacy and terms placeholders
- Runtime-safe public configuration
- POST handoff to `/api/leads/family-readiness`

## Local preview

Serve this directory with any static web server:

```bash
cd apps/family-readiness
python -m http.server 8080
```

Open `http://localhost:8080`.

## Required integration

The public page expects a same-origin endpoint:

```text
POST /api/leads/family-readiness
```

The endpoint must validate the payload, store only the approved fields, record consent version and timestamp, suppress opted-out contacts, and return a non-2xx status when storage fails. Never expose Supabase service-role credentials in this frontend.

## Production checklist

- Obtain company supervision/compliance approval
- Replace privacy and terms placeholders
- Add the licensed supervisor and approved identity
- Configure the appointment URL
- Connect the API route to the existing DEVONN CRM workspace
- Add authenticated staff-only lead access
- Implement unsubscribe and SMS STOP suppression
- Add rate limiting, bot protection, audit logs, and retention rules
- Test mobile, accessibility, form validation, and failure handling
- Configure approved analytics only after privacy review

## Public configuration

Edit `config.js`. It must contain public values only. Secrets belong in the server environment.

## Status

This branch provides the reviewable frontend module. The production API/database integration remains intentionally uncommitted until the existing CRM data model and compliance-approved retention policy are selected.
