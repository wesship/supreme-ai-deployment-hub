# Skyvern browser worker — Secret Energy migration gate

This directory is the first migration gate from TinyFish to a self-hosted browser worker.

## Scope

The first acceptance workflow is **read-only**. It may navigate Secret Energy and extract visible account context, but it must not:

- purchase or subscribe to anything
- send messages or publish posts
- change profile, privacy, billing, membership, or notification settings
- create/edit/delete journal entries
- invoke any action whose primary purpose is mutation

TinyFish stays available as fallback until this gate passes.

## Target runtime

Initial host: **Mac mini M4** on the private LAN.

Skyvern's current self-hosted Docker Compose deployment exposes the API on `localhost:8000` and UI on `localhost:8080`. The browser worker should remain LAN/private-only until authentication and network controls are in place.

## Install Skyvern on the Mac mini

```bash
git clone https://github.com/Skyvern-AI/skyvern.git ~/skyvern
cd ~/skyvern
cp .env.example .env
cp skyvern-frontend/.env.example skyvern-frontend/.env
```

Configure exactly one LLM provider in `~/skyvern/.env`, then start the stack:

```bash
docker compose up -d
docker compose ps
```

Expected local endpoints:

- UI: `http://localhost:8080`
- API: `http://localhost:8000`

Once healthy, retrieve the locally generated API credential from:

```bash
cat .skyvern/credentials.toml
```

Do **not** commit that credential.

## Reuse the signed-in Chrome context

On macOS the preferred first gate is a real Chrome session rather than a disposable cloud browser.

Skyvern supports CDP connection to Chrome. Configure:

```dotenv
BROWSER_TYPE=cdp-connect
CHROME_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

Or connect to an already-running Chrome debugging endpoint:

```dotenv
BROWSER_TYPE=cdp-connect
BROWSER_REMOTE_DEBUGGING_URL=http://host.docker.internal:9222/
BROWSER_CDP_CONNECT_TIMEOUT_MS=120000
```

Use a dedicated Chrome profile for D3VONN browser automation. Sign in to Secret Energy manually in that profile. Never place the Secret Energy password in this repository or in application logs.

## D3VONN environment

Copy the example values into the Mac mini's secret/environment manager:

```dotenv
SKYVERN_BASE_URL=http://localhost:8000
SKYVERN_API_KEY=<local Skyvern API key>
SKYVERN_CDP_URL=http://127.0.0.1:9222
SECRET_ENERGY_URL=https://secretenergy.com
```

## Acceptance test

Install the lightweight client and run:

```bash
python -m pip install 'skyvern>=0'
python ops/skyvern/secret_energy_readonly.py
```

The gate passes only when all of the following are true:

1. Chrome is already authenticated to Secret Energy.
2. The script confirms the member area is reachable without entering credentials.
3. The extracted result contains only normalized read-only fields.
4. No purchase, post, message, profile mutation, journal mutation, billing action, or settings mutation occurs.
5. The run can be repeated after restarting the worker while retaining the authorized browser session.

## Normalized output contract

The worker returns a JSON object shaped like:

```json
{
  "authenticated": true,
  "awakening": {
    "day": null,
    "total_days": 7,
    "streak_days": null
  },
  "sanctuary_prompts": [],
  "available_instruments": [],
  "locked_instruments": [],
  "latest_reading_title": null,
  "latest_reading_summary": null,
  "source": "secretenergy.com",
  "mode": "read_only"
}
```

Missing values stay `null` or empty; the worker must not invent them.

## Hermes handoff

Do not route production Hermes traffic to Skyvern yet. After the read-only acceptance test passes, the next gate is a small internal adapter that lets Hermes request `secret_energy.snapshot.read` and receive the normalized contract above. Keep all mutation capabilities disabled by default.
