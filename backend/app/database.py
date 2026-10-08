"""SQLite storage for forms and their submitted responses."""
import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(os.getenv("FORMCRAFT_DB", Path(__file__).resolve().parents[1] / "formcraft.sqlite3"))

SEED_FORMS = (
    {
        "id": "welcome",
        "title": "Customer satisfaction survey",
        "questions": [
            {"id": "q1", "type": "short_text", "title": "What should we call you?", "required": True, "description": "", "options": []},
            {"id": "q2", "type": "multiple_choice", "title": "How was your experience?", "required": True, "description": "", "options": ["Great", "Pretty good", "It was okay", "Not great"]},
            {"id": "q3", "type": "rating", "title": "How likely are you to recommend us?", "required": True, "description": "", "options": [], "ratingMax": 10},
            {"id": "q4", "type": "long_text", "title": "What could we improve?", "required": True, "description": "Share any details that would help us do better.", "options": []},
            {"id": "q5", "type": "dropdown", "title": "How did you hear about us?", "required": True, "description": "", "options": ["Search engine", "Social media", "A friend", "Other"]},
            {"id": "q6", "type": "email", "title": "What's your email?", "required": True, "description": "", "options": []},
            {"id": "q7", "type": "number", "title": "How many times have you used our product?", "required": True, "description": "", "options": []},
            {"id": "q8", "type": "yes_no", "title": "Would you recommend us?", "required": True, "description": "", "options": []},
        ],
        "responses": [
            {"q1": "Taylor", "q2": "Great", "q3": "9", "q4": "The onboarding was clear and easy.", "q5": "A friend", "q6": "taylor@example.com", "q7": "4", "q8": "Yes"},
            {"q1": "Jordan", "q2": "Pretty good", "q3": "8", "q4": "I would love more reporting options.", "q5": "Search engine", "q6": "jordan@example.com", "q7": "2", "q8": "Yes"},
        ],
    },
    {
        "id": "event",
        "title": "Event registration",
        "questions": [
            {"id": "q4", "type": "short_text", "title": "What's your name?", "required": True, "description": "", "options": []},
            {"id": "q5", "type": "email", "title": "What's your email?", "required": True, "description": "We'll send your ticket here.", "options": []},
            {"id": "q6", "type": "long_text", "title": "Do you have any accessibility needs?", "required": True, "description": "Let us know how we can make the event comfortable for you.", "options": []},
            {"id": "q7", "type": "multiple_choice", "title": "Which session are you attending?", "required": True, "description": "", "options": ["Morning", "Afternoon", "Both"]},
            {"id": "q8", "type": "dropdown", "title": "How did you hear about this event?", "required": True, "description": "", "options": ["Email", "Website", "Social media", "Friend or colleague"]},
            {"id": "q9", "type": "number", "title": "How many guests are in your group?", "required": True, "description": "", "options": []},
            {"id": "q10", "type": "yes_no", "title": "Will you need parking?", "required": True, "description": "", "options": []},
            {"id": "q11", "type": "rating", "title": "How excited are you about the event?", "required": True, "description": "", "options": [], "ratingMax": 10},
        ],
        "responses": [
            {"q4": "Alex Morgan", "q5": "alex.morgan@example.com", "q6": "I need step-free access.", "q7": "Morning", "q8": "Email", "q9": "2", "q10": "Yes", "q11": "9"},
            {"q4": "Jamie Lee", "q5": "jamie.lee@example.com", "q6": "No special requirements.", "q7": "Both", "q8": "Website", "q9": "1", "q10": "No", "q11": "8"},
        ],
    },
)

def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db

def init_db() -> None:
    with connect() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS forms (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('Draft','Published')),
          updated TEXT NOT NULL,
          questions_json TEXT NOT NULL DEFAULT '[]'
        );
        CREATE TABLE IF NOT EXISTS responses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
          submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          answers_json TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_responses_form ON responses(form_id);
        """)

        seed_time = datetime.now(timezone.utc).isoformat(timespec="seconds")
        for form in SEED_FORMS:
            exists = db.execute("SELECT 1 FROM forms WHERE id=?", (form["id"],)).fetchone()
            if exists:
                continue

            db.execute(
                "INSERT INTO forms(id,title,status,updated,questions_json) VALUES(?,?,?,?,?)",
                (form["id"], form["title"], "Published", seed_time, json.dumps(form["questions"])),
            )
            db.executemany(
                "INSERT INTO responses(form_id,answers_json) VALUES(?,?)",
                [(form["id"], json.dumps(answer)) for answer in form["responses"]],
            )

def read_forms():
    with connect() as db:
        forms = []
        for row in db.execute("SELECT * FROM forms ORDER BY updated DESC"):
            item = dict(row)
            item["questions"] = json.loads(item.pop("questions_json"))
            response_rows = list(db.execute("SELECT answers_json, submitted_at FROM responses WHERE form_id=? ORDER BY id", (item["id"],)))
            item["responses"] = [json.loads(response["answers_json"]) for response in response_rows]
            item["responseDates"] = [response["submitted_at"] for response in response_rows]
            forms.append(item)
        return forms

def sync_forms(forms):
    with connect() as db:
        for form in forms:
            db.execute("""INSERT INTO forms(id,title,status,updated,questions_json) VALUES(?,?,?,?,?)
              ON CONFLICT(id) DO UPDATE SET title=excluded.title,status=excluded.status,updated=excluded.updated,questions_json=excluded.questions_json""",
              (form["id"], form["title"], form["status"], form["updated"], json.dumps(form.get("questions", []))))
            # Seed responses for a new form and append local preview answers. Never
            # replace server-submitted answers when another creator tab syncs.
            existing = db.execute("SELECT COUNT(*) FROM responses WHERE form_id=?", (form["id"],)).fetchone()[0]
            answers = form.get("responses", [])
            if len(answers) > existing:
                db.executemany("INSERT INTO responses(form_id,answers_json) VALUES(?,?)",
                    [(form["id"], json.dumps(answer)) for answer in answers[existing:]])

def delete_form(form_id: str) -> bool:
    with connect() as db:
        cur = db.execute("DELETE FROM forms WHERE id=?", (form_id,))
        return cur.rowcount > 0

def add_response(form_id: str, answers: dict):
    with connect() as db:
        if not db.execute("SELECT 1 FROM forms WHERE id=? AND status='Published'", (form_id,)).fetchone():
            return False
        db.execute("INSERT INTO responses(form_id,answers_json) VALUES(?,?)", (form_id, json.dumps(answers)))
        db.execute("UPDATE forms SET updated=CURRENT_TIMESTAMP WHERE id=?", (form_id,))
        return True
