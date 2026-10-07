"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { useEffect, useState } from "react";

type Question = { id: string; type: string; title: string; description?: string; required?: boolean; options?: string[] };
type PublicForm = { id: string; title: string; questions: Question[] };
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function PublicFormContent() {
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<PublicForm | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/api/public/${id}`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("This form is not available."); return response.json() as Promise<PublicForm>; })
      .then(setForm).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to load this form."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id]);

  const current = form?.questions[index];
  const setAnswer = (value: string, question = current) => { if (!question) return; setAnswers((previous) => ({ ...previous, [question.id]: value })); setError(""); };
  const back = () => { if (index > 0) { setDirection("backward"); setIndex((value) => value - 1); setError(""); } };
  const next = async () => {
    if (!form || !current || busy) return;
    const value = (answers[current.id] ?? "").trim();
    const validation = validate(current, value);
    if (validation) { setError(validation); return; }
    setError("");
    if (index < form.questions.length - 1) { setDirection("forward"); setIndex((value) => value + 1); return; }
    setBusy(true);
    try {
      const response = await fetch(`${API}/api/public/${id}/responses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }) });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : "Unable to submit your response.");
      setDone(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to submit your response."); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target instanceof HTMLButtonElement) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); back(); }
      if (event.key === "ArrowRight" || event.key === "Enter") { event.preventDefault(); void next(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  if (loading || !form) return <main className="respondent-shell"><div className="respondent-topline"><span className="respondent-brand"><span className="brand-mini">f</span>formcraft</span></div><section className="respondent-content"><h1>{loading ? "Loading your form…" : error}</h1></section><footer className="respondent-footer"><span>Powered by <b>formcraft</b></span></footer></main>;
  if (done) return <main className="respondent-shell thank-you"><div className="respondent-topline"><span className="respondent-brand"><span className="brand-mini">f</span>{form.title}</span></div><div className="thank-you-card"><span className="thank-you-mark">✳</span><span className="overline">RESPONSE COMPLETE</span><h1>Thank you for your time.</h1><p>Your answers have been submitted.</p></div><footer className="respondent-footer"><span>Powered by <b>formcraft</b></span></footer></main>;
  if (!current) return <main className="respondent-shell"><section className="respondent-content"><h1>This form has no questions yet.</h1></section></main>;

  const selected = answers[current.id] ?? "";
  const choose = (value: string, advance = false) => { setAnswer(value); if (advance) window.setTimeout(() => { setAnswers((previous) => ({ ...previous, [current.id]: value })); if (index < (form?.questions.length ?? 0) - 1) { setDirection("forward"); setIndex((step) => step + 1); } else void nextWithAnswer(value); }, 150); };
  const nextWithAnswer = async (value: string) => {
    if (!form || !current || busy) return;
    const validation = validate(current, value.trim()); if (validation) { setError(validation); return; }
    if (index < form.questions.length - 1) { setDirection("forward"); setIndex((step) => step + 1); return; }
    setBusy(true);
    try { const updated = { ...answers, [current.id]: value }; const response = await fetch(`${API}/api/public/${id}/responses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: updated }) }); const result = await response.json(); if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : "Unable to submit your response."); setDone(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to submit your response."); } finally { setBusy(false); }
  };
  const progress = Math.round(((index + 1) / form.questions.length) * 100);
  return <main className="respondent-shell">
    <div className="respondent-topline"><span className="respondent-brand"><span className="brand-mini">f</span><span>{form.title}</span></span><span className="respondent-step">{String(index + 1).padStart(2, "0")} <i>/</i> {String(form.questions.length).padStart(2, "0")}</span><span className="respondent-exit" /></div>
    <div className="respondent-progress" aria-label={`Question ${index + 1} of ${form.questions.length}`}><span style={{ width: `${progress}%` }} /></div>
    <section className={`respondent-content ${direction}`} key={current.id}>
      <div className="respondent-question-number">{String(index + 1).padStart(2, "0")} <span>→</span></div><h1>{current.title}<sup>{current.required ? "*" : ""}</sup></h1>
      {current.description && <p className="respondent-description">{current.description}</p>}
      <div className="respondent-answer">
        {current.type === "multiple_choice" && <div className="respondent-options">{(current.options ?? []).map((option, n) => <button key={n} className={`respondent-option ${selected === option ? "selected" : ""}`} onClick={() => choose(option, true)}><span>{String.fromCharCode(65 + n)}</span>{option}</button>)}</div>}
        {current.type === "dropdown" && <select className="respondent-select" value={selected} onChange={(event) => setAnswer(event.target.value)}><option value="" disabled>Select an option…</option>{(current.options ?? []).map((option, n) => <option key={n} value={option}>{option}</option>)}</select>}
        {current.type === "yes_no" && <div className="respondent-options horizontal">{["Yes", "No"].map((option, n) => <button key={option} className={`respondent-option ${selected === option ? "selected" : ""}`} onClick={() => choose(option, true)}><span>{n ? "B" : "A"}</span>{option}</button>)}</div>}
        {current.type === "rating" && <div className="rating-options" role="radiogroup" aria-label="Choose a rating">{Array.from({ length: 10 }, (_, n) => String(n + 1)).map((n) => <button key={n} role="radio" aria-checked={selected === n} className={selected === n ? "selected" : ""} onClick={() => setAnswer(n)}>{n}</button>)}</div>}
        {current.type === "long_text" && <textarea autoFocus className="respondent-textarea" placeholder="Type your answer here…" value={selected} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void next(); } }} />}
        {["short_text", "email", "number"].includes(current.type) && <input autoFocus className="respondent-input" type={current.type === "email" ? "email" : current.type === "number" ? "number" : "text"} placeholder={current.type === "email" ? "name@example.com" : "Type your answer here…"} value={selected} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void next(); } }} />}
      </div>
      {error && <p className="validation-error" role="alert">{error}</p>}
      <div className="respondent-controls"><button className="button primary respondent-continue" disabled={busy} onClick={() => void next()}>{busy ? "Submitting…" : index === form.questions.length - 1 ? "Submit" : "OK"}<span>↵</span></button><span className="enter-hint">press <kbd>Enter ↵</kbd></span><button className="back-question" disabled={index === 0} onClick={back}>← Back</button></div>
    </section><footer className="respondent-footer"><span>Powered by <b>formcraft</b></span><span>{progress}% completed</span></footer>
  </main>;
}

export default function PublicFormPage() {
  return <Suspense fallback={<main className="respondent-shell"><section className="respondent-content"><h1>Loading your form…</h1></section></main>}><PublicFormContent /></Suspense>;
}

function validate(question: Question, value: string): string {
  if (question.required && !value) return "Please answer this question before continuing.";
  if (!value) return "";
  if (question.type === "email" && !/^\S+@\S+\.\S+$/.test(value)) return "Enter a valid email address.";
  if (question.type === "number" && !Number.isFinite(Number(value))) return "Enter a valid number.";
  if (["multiple_choice", "dropdown"].includes(question.type) && !(question.options ?? []).includes(value)) return "Choose one of the available options.";
  if (question.type === "yes_no" && value !== "Yes" && value !== "No") return "Choose Yes or No.";
  if (question.type === "rating" && (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 10)) return "Choose a rating from 1 to 10.";
  return "";
}
