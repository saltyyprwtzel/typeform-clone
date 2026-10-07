# Formcraft

A Typeform-inspired form builder and conversational respondent experience built for the Scaler full-stack assessment.

## Stack

- `frontend/`: Next.js App Router, React, TypeScript, custom CSS
- `backend/`: FastAPI and Python
- Storage: SQLite, with normalized `forms` and `responses` tables

## Run locally

Start the API in one terminal:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Start the UI in another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. The frontend can run without the API using local browser storage, but published share links and cross-device submissions require the API. The first launch seeds example forms and answers in the browser and syncs them to SQLite.

## Architecture

The Next.js app contains the creator dashboard, visual question editor, results summaries, and public respondent route at `/f/[id]`. The browser keeps a local copy for quick editing and synchronizes the form definitions with FastAPI. Public forms are loaded from the API by ID; submitted answers are validated and stored server-side.

The FastAPI application exposes JSON endpoints under `/api`. CORS is configured for the local frontend at `http://localhost:3000`. Set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` if the API is hosted elsewhere. Set `FORMCRAFT_CORS_ORIGINS` to a comma-separated list of allowed frontend origins, and `FORMCRAFT_DB` to choose a SQLite file path.

## Schema

- `forms`: `id` (text primary key), `title`, `status`, `updated`, `questions_json`
- `responses`: integer primary key, `form_id` (foreign key with cascade delete), `submitted_at`, `answers_json`

Question definitions and answer maps are JSON so new question types can be added without schema migrations. Responses are separate rows so they can be queried and counted per form.

## API overview

- `GET /api/health` — health check
- `GET /api/forms` — list forms with stored responses
- `POST /api/forms/sync` — synchronize creator-side form definitions
- `DELETE /api/forms/{id}` — delete a form and its responses
- `GET /api/public/{id}` — retrieve a published form for respondents
- `POST /api/public/{id}/responses` — validate and save a public response

## Assumptions and current scope

- The creator is a default local user; authentication is not implemented.
- Drafts, question settings, form themes, integrations, and advanced branching are intentionally limited to the assessment's core flow.
- Local browser storage is a resilient fallback when the backend is not running.
- The UI is an original Typeform-inspired implementation and does not use Typeform's proprietary assets.
