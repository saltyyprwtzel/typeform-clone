"""SQLite storage for forms and their submitted responses."""
import json
import os
import sqlite3
from pathlib import Path

DB_PATH = Path(os.getenv("FORMCRAFT_DB", Path(__file__).resolve().parents[1] / "formcraft.sqlite3"))

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
