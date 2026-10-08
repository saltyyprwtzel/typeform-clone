"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { useEffect, useRef, useState } from "react";

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
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [finalConfirmed, setFinalConfirmed] = useState(false);
  const submissionStarted = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/api/public/${id}`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("This form is not available."); return response.json() as Promise<PublicForm>; })
      .then(setForm).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to load this form."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, loadAttempt]);

  const current = form?.questions[index];
  const setAnswer = (value: string, question = current) => { if (!question) return; setAnswers((previous) => ({ ...previous, [question.id]: value })); setError(""); if (index === (form?.questions.length ?? 0) - 1 && question.id === current?.id) setFinalConfirmed(false); };
  const back = () => { if (index > 0) { setDirection("backward"); setIndex((value) => value - 1); setError(""); } };
  const confirmAnswer = (currentAnswers = answers) => {
    if (!form || !current) return;
    const value = (currentAnswers[current.id] ?? "").trim();
    const validation = validate(current, value);
    if (validation) { setError(validation); return; }
    setError("");
    if (index < form.questions.length - 1) { setDirection("forward"); setIndex((value) => value + 1); return; }
    setFinalConfirmed(true);
  };
  const submitResponse = async () => {
    if (!form || !current || index !== form.questions.length - 1 || !finalConfirmed || busy || submissionStarted.current) return;
    const validation = form.questions.map((question) => validate(question, (answers[question.id] ?? "").trim())).find(Boolean);
    if (validation) { setError(validation); return; }
    submissionStarted.current = true;
    setBusy(true);
    let submitted = false;
    try {
      const response = await fetch(`${API}/api/public/${id}/responses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }) });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : "Unable to submit your response.");
      submitted = true;
      setDone(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to submit your response."); }
    finally { setBusy(false); if (!submitted) submissionStarted.current = false; }
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.key === "Enter" && target instanceof HTMLElement && target.closest("[data-submit-response]")) return;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      if (target instanceof HTMLSelectElement || target instanceof HTMLButtonElement) { if (event.key === "Enter") { event.preventDefault(); confirmAnswer(); } return; }
      if (current?.type === "multiple_choice" && /^[a-z]$/i.test(event.key)) {
        const choiceIndex = event.key.toUpperCase().charCodeAt(0) - 65;
        const option = (current.options ?? [])[choiceIndex];
        if (option) { event.preventDefault(); setAnswer(option, current); return; }
      }
      if (current?.type === "yes_no" && /^[yn]$/i.test(event.key)) {
        const value = event.key.toLowerCase() === "y" ? "Yes" : "No";
        event.preventDefault(); setAnswer(value, current); return;
      }
      if (event.key === "ArrowLeft") { event.preventDefault(); back(); }
      if (event.key === "ArrowRight" || event.key === "Enter") { event.preventDefault(); confirmAnswer(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  if (loading || !form) return <main className="respondent-shell"><div className="respondent-topline"><span className="respondent-brand"><span className="brand-mini">f</span>formcraft</span></div><section className="respondent-content" aria-live="polite"><h1>{loading ? "Loading your form…" : error}</h1>{!loading && <button className="button quiet" onClick={() => { setForm(null); setError(""); setLoading(true); setLoadAttempt((attempt) => attempt + 1); }}>Try again</button>}</section><footer className="respondent-footer"><span>Powered by <b>formcraft</b></span></footer></main>;
  if (done) return <main className="respondent-shell thank-you"><div className="respondent-topline"><span className="respondent-brand"><span className="brand-mini">f</span>{form.title}</span></div><div className="thank-you-card"><span className="thank-you-mark">✳</span><span className="overline">RESPONSE COMPLETE</span><h1>Thank you for your time.</h1><p>Your answers have been submitted.</p></div><footer className="respondent-footer"><span>Powered by <b>formcraft</b></span></footer></main>;
  if (!current) return <main className="respondent-shell"><section className="respondent-content"><h1>This form has no questions yet.</h1></section></main>;

  const selected = answers[current.id] ?? "";
  const choose = (value: string) => setAnswer(value);
  const progress = Math.round(((index + 1) / form.questions.length) * 100);
  return <main className="respondent-shell">
    <div className="respondent-topline"><span className="respondent-brand"><span className="brand-mini">f</span><span>{form.title}</span></span><span className="respondent-step">{String(index + 1).padStart(2, "0")} <i>/</i> {String(form.questions.length).padStart(2, "0")}</span><span className="respondent-exit" /></div>
    <div className="respondent-progress" role="progressbar" aria-label="Form progress" aria-valuemin={0} aria-valuemax={form.questions.length} aria-valuenow={index + 1}><span style={{ width: `${progress}%` }} /></div>
    <section className={`respondent-content ${direction}`} key={current.id}>
      <div className="respondent-question-number">{String(index + 1).padStart(2, "0")} <span>→</span></div><h1>{current.title}<sup>{current.required ? "*" : ""}</sup></h1>
      {current.description && <p className="respondent-description">{current.description}</p>}
      <div className="respondent-answer">
        {current.type === "multiple_choice" && <div className="respondent-options" role="group" aria-label="Answer choices">{(current.options ?? []).map((option, n) => <button key={n} className={`respondent-option ${selected === option ? "selected" : ""}`} onClick={() => choose(option)}><span>{String.fromCharCode(65 + n)}</span>{option}</button>)}</div>}
        {current.type === "dropdown" && <select className="respondent-select" value={selected} onChange={(event) => setAnswer(event.target.value)}><option value="" disabled>Select an option…</option>{(current.options ?? []).map((option, n) => <option key={n} value={option}>{option}</option>)}</select>}
        {current.type === "yes_no" && <div className="respondent-options horizontal">{["Yes", "No"].map((option, n) => <button key={option} className={`respondent-option ${selected === option ? "selected" : ""}`} onClick={() => choose(option)}><span>{n ? "B" : "A"}</span>{option}</button>)}</div>}
        {current.type === "rating" && <div className="rating-options" role="radiogroup" aria-label="Choose a rating">{Array.from({ length: 10 }, (_, n) => String(n + 1)).map((n) => <button key={n} role="radio" aria-checked={selected === n} className={selected === n ? "selected" : ""} onClick={() => setAnswer(n)}>{n}</button>)}</div>}
        {current.type === "long_text" && <textarea autoFocus className="respondent-textarea" placeholder="Type your answer here…" value={selected} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); confirmAnswer(); } }} />}
        {["short_text", "email", "number"].includes(current.type) && <input autoFocus className="respondent-input" type={current.type === "email" ? "email" : current.type === "number" ? "number" : "text"} placeholder={current.type === "email" ? "name@example.com" : "Type your answer here…"} value={selected} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); confirmAnswer(); } }} />}
      </div>
      {error && <p className="validation-error" role="alert">{error}</p>}
      <div className="respondent-controls"><button className="button primary respondent-continue" onClick={() => confirmAnswer()} disabled={index === form.questions.length - 1 && finalConfirmed}>{index === form.questions.length - 1 && finalConfirmed ? "Answer confirmed" : "OK"}<span>↵</span></button>{index === form.questions.length - 1 && <button className="button quiet respondent-submit" data-submit-response disabled={!finalConfirmed || busy} onClick={() => void submitResponse()}>{busy ? "Submitting…" : "Submit form"}</button>}<span className="enter-hint">press <kbd>Enter ↵</kbd></span><button className="back-question" disabled={index === 0} onClick={back}>← Back</button></div>
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
