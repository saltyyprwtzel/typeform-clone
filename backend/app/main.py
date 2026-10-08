from datetime import datetime, timezone
import math
import os
from typing import Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from . import database

app = FastAPI(title="Formcraft API", version="1.0.0")
origins = [origin.strip() for origin in os.getenv("FORMCRAFT_CORS_ORIGINS", "http://localhost:3000").split(",") if origin.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_origin_regex=r"https://[a-zA-Z0-9-]+\.vercel\.app", allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class FormRecord(BaseModel):
    id: str
    title: str
    updated: str
    status: str
    questions: list[dict[str, Any]] = []
    responses: list[dict[str, str]] = []

class SyncRequest(BaseModel):
    forms: list[FormRecord]

class Submission(BaseModel):
    answers: dict[str, str]

@app.on_event("startup")
def startup():
    database.init_db()

@app.get("/api/health")
def health():
    return {"ok": True}

@app.get("/api/forms")
def list_forms():
    return database.read_forms()

@app.post("/api/forms/sync")
def sync(request: SyncRequest):
    database.sync_forms([form.model_dump() for form in request.forms])
    return {"ok": True}

@app.delete("/api/forms/{form_id}")
def remove_form(form_id: str):
    if not database.delete_form(form_id):
        raise HTTPException(404, "Form not found")
    return {"ok": True}

@app.get("/api/public/{form_id}")
def public_form(form_id: str):
    form = next((item for item in database.read_forms() if item["id"] == form_id), None)
    if not form or form["status"] != "Published" or not form["questions"]:
        raise HTTPException(404, "This form is not available")
    return {key: form[key] for key in ("id", "title", "questions")}

@app.post("/api/public/{form_id}/responses", status_code=201)
def submit_response(form_id: str, submission: Submission):
    form = next((item for item in database.read_forms() if item["id"] == form_id), None)
    if not form or form["status"] != "Published" or not form["questions"]:
        raise HTTPException(404, "This form is not available")
    question_ids = {q["id"] for q in form["questions"]}
    if set(submission.answers) - question_ids:
        raise HTTPException(422, "The submission contains an unknown question")
    for q in form["questions"]:
        value = submission.answers.get(q["id"], "").strip()
        if q.get("required") and not value:
            raise HTTPException(422, f"{q.get('title','Question')} is required")
        if value and q.get("type") == "email" and ("@" not in value or "." not in value.rsplit("@",1)[-1]):
            raise HTTPException(422, "Enter a valid email address")
        if value and q.get("type") == "number":
            try:
                parsed = float(value)
                if not math.isfinite(parsed): raise ValueError
            except ValueError: raise HTTPException(422, "Enter a valid number")
        if value and q.get("type") in ("multiple_choice", "dropdown") and value not in q.get("options", []):
            raise HTTPException(422, "Choose one of the available options")
        if value and q.get("type") == "yes_no" and value not in ("Yes", "No"):
            raise HTTPException(422, "Choose Yes or No")
        if value and q.get("type") == "rating":
            try:
                rating = int(value)
                if str(rating) != value or not 1 <= rating <= 10: raise ValueError
            except ValueError: raise HTTPException(422, "Choose a rating from 1 to 10")
    database.add_response(form_id, submission.answers)
    return {"ok": True, "submittedAt": datetime.now(timezone.utc).isoformat()}
