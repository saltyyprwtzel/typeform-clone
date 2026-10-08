# FormMaker

FormMaker is a Typeform-inspired form builder and one-question-at-a-time respondent experience built for the Scaler full-stack assessment. It supports creating and publishing forms, collecting public responses, and reviewing results.

## Technology

- **Frontend:** Next.js App Router, React, TypeScript, CSS
- **Backend:** FastAPI, Python, Pydantic
- **Persistence:** SQLite (`forms` and `responses` tables)

## Run locally

Prerequisites: Node.js/npm and Python 3.10+.

Start the API in PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Start the frontend in a second terminal:

```powershell
cd frontend
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Open `http://localhost:3000`. The API is available at `http://localhost:8000`; interactive API documentation is at `http://localhost:8000/docs`.

The frontend reads `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`). The backend reads `FORMCRAFT_CORS_ORIGINS` (comma-separated allowed origins) and `FORMCRAFT_DB` (SQLite file path). See `frontend/.env.example` and `backend/.env.example`. The backend's default database is `backend/formcraft.sqlite3` when run from the repository's `backend` directory.

## Project structure

```text
frontend/app/page.tsx       Creator dashboard, builder, preview, settings, and results
frontend/app/f/[id]/page.tsx Public respondent form
frontend/app/theme-system.tsx Six-theme state and switcher
frontend/app/globals.css    Application styling and theme tokens
backend/app/main.py         FastAPI app, routes, and submission validation
backend/app/database.py     SQLite schema, seed data, and persistence functions
```

## Architecture and data

The creator dashboard, builder, results, and settings are client-side views managed by the Next.js page at `/` (the selected view and form ID are reflected in query parameters). Public respondents use `/f/{form_id}`. The browser calls the FastAPI JSON API using `NEXT_PUBLIC_API_URL`.

SQLite contains:

- `forms`: text `id` primary key, `title`, `status` (`Draft` or `Published`), `updated`, and `questions_json`.
- `responses`: integer `id` primary key, `form_id` foreign key (cascade delete), `submitted_at`, and `answers_json`.

Question definitions are JSON objects with stable question IDs. Each response's `answers_json` maps those IDs to answer strings. Forms are synchronized with an upsert-only endpoint; explicit form deletion uses `DELETE /api/forms/{form_id}` and cascades to its responses.

On a fresh database, backend startup idempotently seeds two published evaluator forms (`welcome` and `event`), each with all eight question types and two sample responses. Existing forms with those IDs are left as-is. The frontend uses these same starter forms as display/offline demos if the API is empty or unavailable; displaying fallback data alone does not sync it back to SQLite. If the API is unavailable, browser `localStorage` can provide the creator's local forms.

## API

All routes are served by the FastAPI backend:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check. |
| `GET` | `/api/forms` | List creator forms and their stored responses. |
| `POST` | `/api/forms/sync` | Upsert submitted form definitions and append newly supplied responses; omitted forms are not deleted. |
| `DELETE` | `/api/forms/{form_id}` | Explicitly delete a form and its responses. |
| `GET` | `/api/public/{form_id}` | Return a published form's public definition. |
| `POST` | `/api/public/{form_id}/responses` | Validate and persist a completed public response. |

## Implemented capabilities

- Create, edit, rename, duplicate, delete, publish, and preview forms.
- Eight question types: short text, long text, multiple choice, dropdown, email, number, yes/no, and rating.
- Reorder builder questions by drag-and-drop or keyboard controls; edit question text, options, descriptions, and required state.
- Public, sequential respondent experience with progress, Back/OK navigation, keyboard shortcuts, answer confirmation, and an explicit final Submit action. Respondents do not need an account. Builder preview is simulated and does not create a stored response.
- Client- and server-side validation for required answers, email format, finite numbers, allowed choice values, yes/no values, and rating range.
- Results summary with response counts, per-question choice distributions, number summaries (average, median, range), free-text answers, searchable individual responses, and CSV export.
- Six workspace themes (Light, Dark, Spring, Summer, Fall, Winter), including dark mode. The selected theme is stored in browser `localStorage` and is not a per-form theme.

## Deployment and assumptions

The known production API is `https://typeform-clone-api-332f.onrender.com`. The frontend is deployed separately on Vercel. Set `NEXT_PUBLIC_API_URL` in Vercel to the API URL, and configure `FORMCRAFT_CORS_ORIGINS` on Render with the frontend's origin. Deployment settings are managed in the hosting dashboards; this repository contains no Render or Vercel deployment manifest.

SQLite is a file database. For persistence across Render restarts/redeploys, attach a persistent disk and set `FORMCRAFT_DB` to a path on its mount (for example, `/var/data/formcraft.sqlite3` when the disk is mounted at `/var/data`). Without a persistent disk, Render's filesystem may be ephemeral.

Creator authentication is intentionally simplified: the app presents a single default workspace/creator and does not implement login, accounts, or access control. Public respondent forms require no login.

## Not implemented / out of scope

Conditional branching, file uploads, partial-response saving/resume, creator authentication, multi-user collaboration, and third-party integrations are not implemented. Navigation entries for some future workspace areas are placeholders. Results provide basic summaries, not advanced analytics.
