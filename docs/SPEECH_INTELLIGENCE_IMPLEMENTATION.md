# Devonn.AI Speech Intelligence Implementation

This branch wires the Speech Intelligence Module into the main Devonn.AI repo.

## What was implemented

### Backend

- `backend/app/routers/speech.py`
  - `GET /api/speech/health`
  - `POST /api/speech/transcribe`
- `backend/app/models/speech.py`
  - Transcript, chunk, topic, action item, and knowledge graph response models.
- `backend/app/config.py`
  - `SPEECH_INTELLIGENCE_BASE_URL`
  - `SPEECH_INTELLIGENCE_API_KEY`
  - `SPEECH_INTELLIGENCE_TIMEOUT_SECONDS`
  - `SPEECH_INTELLIGENCE_MAX_UPLOAD_MB`
- `backend/app/routers/__init__.py`
  - Registers the speech router under `/api`.

### Frontend

- `src/api/speech/speechApi.ts`
  - Upload/transcription API client.
- `src/pages/SpeechIntelligence.tsx`
  - Admin upload and review panel.
- `src/App.tsx`
  - Adds route: `/intelligence/speech`.

## Production environment variables

Set these on the Devonn backend service:

```bash
SPEECH_INTELLIGENCE_BASE_URL=https://speech-api.devonn.ai
SPEECH_INTELLIGENCE_API_KEY=<shared-service-token>
SPEECH_INTELLIGENCE_TIMEOUT_SECONDS=900
SPEECH_INTELLIGENCE_MAX_UPLOAD_MB=250
```

The Speech Intelligence microservice should expose:

```http
GET /health
POST /api/speech/transcribe
```

The backend proxy sends a multipart form with:

```text
file=<audio/video binary>
model=openai/whisper-large-v3 | distil-whisper/distil-medium.en
task=transcribe
language=english
include_graph=true
save_to_crm=false
crm_contact_id=<optional>
user_id=<authenticated user id>
```

## Expected response contract

```json
{
  "status": "completed",
  "job_id": "optional-job-id",
  "filename": "client-call.mp3",
  "model": "openai/whisper-large-v3",
  "transcript": "Full transcript text...",
  "chunks": [
    { "start": 0.0, "end": 5.12, "text": "Timestamped text..." }
  ],
  "summary": "Short summary...",
  "topics": ["insurance", "follow up"],
  "action_items": ["Call client tomorrow"],
  "knowledge_graph": {
    "nodes": [],
    "edges": []
  }
}
```

## Deployment flow

1. Deploy the separate Speech Intelligence microservice package.
2. Add the backend environment variables above.
3. Deploy this Devonn.AI branch.
4. Visit `/intelligence/speech`.
5. Confirm `Service status: ok`.
6. Upload a short WAV/MP3 first, then test MP4.

## Why it is separated

Whisper Large V3 and Distil-Whisper have different runtime needs than the normal Devonn backend. Keeping this as an external microservice lets Devonn scale GPU/CPU transcription separately from chat, RAG, admin, and agent orchestration.

## Downstream routing

This page prepares the data for:

- CRM call notes
- Insurance training notes
- Course transcripts
- Video summaries
- Knowledge graph memory
- Hermes DAG tasks
