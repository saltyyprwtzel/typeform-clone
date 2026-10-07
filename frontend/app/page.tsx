"use client";

import { useEffect, useMemo, useState } from "react";

type QuestionType = "short_text" | "long_text" | "multiple_choice" | "dropdown" | "email" | "number" | "yes_no" | "rating";
type Question = { id: string; type: QuestionType; title: string; required: boolean; description: string; options: string[] };
type FormData = { id: string; title: string; updated: string; status: "Draft" | "Published"; questions: Question[]; responses: Record<string, string>[]; responseDates?: string[] };
type View = "dashboard" | "builder" | "results";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const questionTypes: { type: QuestionType; label: string; icon: string; placeholder: string }[] = [
  { type: "short_text", label: "Short text", icon: "T", placeholder: "Type your answer here" },
  { type: "long_text", label: "Long text", icon: "¶", placeholder: "Type a longer answer here" },
  { type: "multiple_choice", label: "Multiple choice", icon: "☷", placeholder: "Choose one option" },
  { type: "dropdown", label: "Dropdown", icon: "⌄", placeholder: "Select an option" },
  { type: "email", label: "Email", icon: "@", placeholder: "name@example.com" },
  { type: "number", label: "Number", icon: "#", placeholder: "Enter a number" },
  { type: "yes_no", label: "Yes / No", icon: "◉", placeholder: "Choose yes or no" },
  { type: "rating", label: "Rating", icon: "☆", placeholder: "Rate from 1 to 10" },
];
const typeLabel = (type: QuestionType) => questionTypes.find((item) => item.type === type)?.label ?? "Question";
const makeQuestion = (type: QuestionType, order: number): Question => ({
  id: crypto.randomUUID(), type, title: `Question ${order}`, required: true, description: "",
  options: type === "multiple_choice" || type === "dropdown" ? ["Option 1", "Option 2", "Option 3"] : [],
});
const starterForms: FormData[] = [
  {
    id: "welcome", title: "Customer satisfaction survey", updated: new Date().toISOString(), status: "Published",
    questions: [
      { id: "q1", type: "short_text", title: "What should we call you?", required: true, description: "", options: [] },
      { id: "q2", type: "multiple_choice", title: "How was your experience?", required: true, description: "", options: ["Great", "Pretty good", "It was okay", "Not great"] },
      { id: "q3", type: "rating", title: "How likely are you to recommend us?", required: true, description: "", options: [] },
    ], responses: [{ q1: "Taylor", q2: "Great", q3: "9" }, { q1: "Jordan", q2: "Pretty good", q3: "8" }],
  },
  {
    id: "event", title: "Event registration", updated: new Date().toISOString(), status: "Draft",
    questions: [
      { id: "q4", type: "short_text", title: "What's your name?", required: true, description: "", options: [] },
      { id: "q5", type: "email", title: "What's your email?", required: true, description: "We'll send your ticket here.", options: [] },
    ], responses: [],
  },
];

const dateLabel = (value?: string) => {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

export default function Home() {
  const [forms, setForms] = useState<FormData[]>(starterForms);
  const [view, setView] = useState<View>("dashboard");
  const [activeId, setActiveId] = useState("");
  const [selectedQuestion, setSelectedQuestion] = useState("");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "local">("saved");
  const [apiReady, setApiReady] = useState(false);
  const [preview, setPreview] = useState(false);
  const [responseIndex, setResponseIndex] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    let localForms: FormData[] = [];
    try {
      const stored = localStorage.getItem("formcraft-data");
      if (stored) localForms = JSON.parse(stored) as FormData[];
    } catch { /* Ignore corrupt local data and continue with the seed forms. */ }
    fetch(`${API}/api/forms`, { signal: AbortSignal.timeout(1800) })
      .then(async (response) => {
        if (!response.ok) throw new Error("The forms API is unavailable.");
        return response.json() as Promise<FormData[]>;
      })
      .then((data) => { if (mounted) setForms(data.length ? data : localForms.length ? localForms : starterForms); })
      .catch(() => { if (mounted && localForms.length) setForms(localForms); })
      .finally(() => { if (mounted) setApiReady(true); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    localStorage.setItem("formcraft-data", JSON.stringify(forms));
    if (!apiReady) return;
    const snapshot = JSON.stringify({ forms });
    const timer = window.setTimeout(() => {
      setSaveState("saving");
      fetch(`${API}/api/forms/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: snapshot })
        .then((response) => { if (!response.ok) throw new Error("Save failed"); setSaveState("saved"); })
        .catch(() => setSaveState("local"));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [forms, apiReady]);

  const active = forms.find((form) => form.id === activeId) ?? forms[0];
  const currentQuestion = active?.questions.find((question) => question.id === selectedQuestion) ?? active?.questions[0];
  const filteredForms = forms.filter((form) => form.title.toLowerCase().includes(query.toLowerCase()));
  const summaries = useMemo(() => active?.questions.map((question) => ({
    question,
    answers: active.responses.map((response) => response[question.id]).filter((answer): answer is string => Boolean(answer)),
  })) ?? [], [active]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };
  const updateForm = (patch: Partial<FormData>) => {
    if (!active) return;
    setForms((items) => items.map((form) => form.id === active.id ? { ...form, ...patch, updated: new Date().toISOString() } : form));
  };
  const updateQuestion = (questionId: string, patch: Partial<Question>) => {
    if (!active) return;
    updateForm({ questions: active.questions.map((question) => question.id === questionId ? { ...question, ...patch } : question) });
  };
  const createForm = () => {
    const form: FormData = { id: crypto.randomUUID(), title: "Untitled form", updated: new Date().toISOString(), status: "Draft", questions: [makeQuestion("short_text", 1)], responses: [] };
    setForms((items) => [form, ...items]);
    setActiveId(form.id);
    setSelectedQuestion(form.questions[0].id);
    setView("builder");
  };
  const openForm = (form: FormData, destination: View = "builder") => {
    setActiveId(form.id);
    setSelectedQuestion(form.questions[0]?.id ?? "");
    setView(destination);
    setPreview(false);
  };
  const duplicateForm = (form: FormData) => {
    const duplicate = { ...form, id: crypto.randomUUID(), title: `${form.title} copy`, status: "Draft" as const, updated: new Date().toISOString(), responses: [], responseDates: [] };
    setForms((items) => [duplicate, ...items]);
    notify("Form duplicated");
  };
  const deleteForm = (formId: string) => {
    setForms((items) => items.filter((form) => form.id !== formId));
    notify("Form deleted");
  };
  const addQuestion = (type: QuestionType) => {
    if (!active) return;
    const question = makeQuestion(type, active.questions.length + 1);
    updateForm({ questions: [...active.questions, question] });
    setSelectedQuestion(question.id);
    notify(`${typeLabel(type)} added`);
  };
  const moveQuestion = (fromId: string, toId: string) => {
    if (!active || fromId === toId) return;
    const questions = [...active.questions];
    const from = questions.findIndex((question) => question.id === fromId);
    const to = questions.findIndex((question) => question.id === toId);
    if (from < 0 || to < 0) return;
    const [moved] = questions.splice(from, 1);
    questions.splice(to, 0, moved);
    updateForm({ questions });
  };
  const moveByKeyboard = (questionId: string, offset: -1 | 1) => {
    if (!active) return;
    const index = active.questions.findIndex((question) => question.id === questionId);
    const target = active.questions[index + offset];
    if (target) moveQuestion(questionId, target.id);
  };
  const togglePublish = async () => {
    if (!active) return;
    if (active.status === "Draft" && !active.questions.length) { notify("Add a question before publishing"); return; }
    const publishing = active.status === "Draft";
    updateForm({ status: publishing ? "Published" : "Draft" });
    if (!publishing) { notify("Form unpublished"); return; }
    const url = `${window.location.origin}/f/${active.id}`;
    try { await navigator.clipboard.writeText(url); notify("Published — share link copied"); }
    catch { notify("Published — copy the link from the form list"); }
  };
  const shareForm = async (form: FormData) => {
    const url = `${window.location.origin}/f/${form.id}`;
    try { await navigator.clipboard.writeText(url); notify("Share link copied"); }
    catch { notify(url); }
  };
  const removeQuestion = (questionId: string) => {
    if (!active) return;
    const remaining = active.questions.filter((question) => question.id !== questionId);
    updateForm({ questions: remaining });
    setSelectedQuestion(remaining[0]?.id ?? "");
    notify("Question removed");
  };
  const startPreview = () => {
    if (!active?.questions.length) { notify("Add a question to preview this form"); return; }
    setPreview(true);
  };
  const savePreviewResponse = (answers: Record<string, string>) => {
    if (!active) return;
    updateForm({ responses: [...active.responses, answers], responseDates: [...(active.responseDates ?? []), new Date().toISOString()] });
    setPreview(false);
    notify("Preview response saved");
  };

  if (preview && active) return <PreviewFlow form={active} onExit={() => setPreview(false)} onComplete={savePreviewResponse} />;
  if (view === "builder" && active) return <><Builder
    form={active} question={currentQuestion} saveState={saveState} toast={toast}
    onBack={() => setView("dashboard")} onTitle={(title) => updateForm({ title })}
    onType={(type) => currentQuestion && updateQuestion(currentQuestion.id, { type, options: type === "multiple_choice" || type === "dropdown" ? ["Option 1", "Option 2", "Option 3"] : [] })}
    onQuestionTitle={(title) => currentQuestion && updateQuestion(currentQuestion.id, { title })}
    onDescription={(description) => currentQuestion && updateQuestion(currentQuestion.id, { description })}
    onRequired={(required) => currentQuestion && updateQuestion(currentQuestion.id, { required })}
    onOption={(index, value) => currentQuestion && updateQuestion(currentQuestion.id, { options: currentQuestion.options.map((option, i) => i === index ? value : option) })}
    onAddOption={() => currentQuestion && updateQuestion(currentQuestion.id, { options: [...currentQuestion.options, `Option ${currentQuestion.options.length + 1}`] })}
    onRemoveOption={(index) => currentQuestion && updateQuestion(currentQuestion.id, { options: currentQuestion.options.filter((_, i) => i !== index) })}
    onSelectQuestion={setSelectedQuestion} onAddQuestion={addQuestion} onMove={moveQuestion} onMoveByKeyboard={moveByKeyboard}
    onDeleteQuestion={removeQuestion} onPreview={startPreview} onPublish={togglePublish} onShare={() => void shareForm(active)} onResults={() => setView("results")}
    notify={notify}
  />{toast && <Toast message={toast} />}</>;
  if (view === "results" && active) return <><Results
    form={active} summaries={summaries} responseIndex={responseIndex}
    onBack={() => setView("dashboard")} onEdit={() => openForm(active, "builder")}
    onResponse={setResponseIndex} onCloseResponse={() => setResponseIndex(null)}
  />{toast && <Toast message={toast} />}</>;

  return <><Dashboard forms={filteredForms} query={query} onQuery={setQuery} onCreate={createForm} onOpen={openForm} onDuplicate={duplicateForm} onDelete={deleteForm} onShare={(form) => void shareForm(form)} onResults={(form) => openForm(form, "results")} />{toast && <Toast message={toast} />}</>;
}

function Toast({ message }: { message: string }) { return <div className="toast-message" role="status">{message}</div>; }

function Dashboard({ forms, query, onQuery, onCreate, onOpen, onDuplicate, onDelete, onShare, onResults }: {
  forms: FormData[]; query: string; onQuery: (value: string) => void; onCreate: () => void;
  onOpen: (form: FormData) => void; onDuplicate: (form: FormData) => void; onDelete: (id: string) => void;
  onShare: (form: FormData) => void; onResults: (form: FormData) => void;
}) {
  return <div className="workspace-shell">
    <aside className="workspace-rail"><a className="wordmark" href="#home"><span className="wordmark-symbol">f</span>formcraft</a><div className="workspace-name"><span className="workspace-avatar">S</span><span><b>Studio workspace</b><small>Free plan</small></span><span className="workspace-caret">⌄</span></div><nav className="workspace-nav"><span className="nav-caption">WORKSPACE</span><a className="workspace-nav-item selected" href="#forms"><span>▤</span> All forms <b>{forms.length}</b></a></nav><div className="workspace-user"><span className="user-avatar">A</span><span><b>Alex Morgan</b><small>Personal workspace</small></span><span className="workspace-caret">•••</span></div></aside>
    <main className="workspace-main"><header className="workspace-top"><span>Studio workspace <i>/</i> Forms</span><button className="avatar-button" aria-label="Account">A</button></header>
      <div className="dashboard-content"><div className="dashboard-heading"><div><span className="overline">YOUR WORKSPACE</span><h1>Forms</h1><p>Build something worth answering.</p></div><button className="button primary" onClick={onCreate}><span>＋</span> Create a form</button></div>
        <div className="form-library"><div className="library-toolbar"><div><h2>All forms <span>{forms.length}</span></h2><p>Your forms, all in one place.</p></div><label className="search-field"><span>⌕</span><input aria-label="Search forms" placeholder="Search forms" value={query} onChange={(event) => onQuery(event.target.value)} /></label></div>
          <div className="form-table-head"><span>NAME</span><span>STATUS</span><span>RESPONSES</span><span>LAST EDITED</span><span /></div>
          {forms.length ? forms.map((form, index) => <article className="form-entry" key={form.id}>
            <button className={`form-cover cover-${index % 4}`} onClick={() => onOpen(form)} aria-label={`Edit ${form.title}`}><span>{index % 2 ? "✳" : "✦"}</span></button>
            <button className="form-name" onClick={() => onOpen(form)}><b>{form.title}</b><small>Open editor</small></button>
            <span className={`form-status ${form.status.toLowerCase()}`}><i />{form.status}</span>
            <button className="response-link" onClick={() => onResults(form)}>{form.responses.length}<small> responses</small></button>
            <span className="form-edited">{new Date(form.updated).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</span>
            <div className="entry-actions"><button aria-label="Edit form" title="Edit" onClick={() => onOpen(form)}>↗</button><button aria-label="View results" title="Results" onClick={() => onResults(form)}>▥</button>{form.status === "Published" && <button aria-label="Copy share link" title="Share" onClick={() => onShare(form)}>⌁</button>}<button aria-label="Duplicate form" title="Duplicate" onClick={() => onDuplicate(form)}>⧉</button><button aria-label="Delete form" title="Delete" onClick={() => onDelete(form.id)}>×</button></div>
          </article>) : <div className="empty-library">{query ? "No forms match that search." : <>Your workspace is ready. <button onClick={onCreate}>Create your first form</button></>}</div>}
        </div>
      </div>
    </main>
  </div>;
}

function Builder({ form, question, saveState, toast, onBack, onTitle, onType, onQuestionTitle, onDescription, onRequired, onOption, onAddOption, onRemoveOption, onSelectQuestion, onAddQuestion, onMove, onMoveByKeyboard, onDeleteQuestion, onPreview, onPublish, onShare, onResults, notify }: {
  form: FormData; question?: Question; saveState: "saved" | "saving" | "local"; toast: string;
  onBack: () => void; onTitle: (title: string) => void; onType: (type: QuestionType) => void;
  onQuestionTitle: (title: string) => void; onDescription: (value: string) => void; onRequired: (value: boolean) => void;
  onOption: (index: number, value: string) => void; onAddOption: () => void; onRemoveOption: (index: number) => void;
  onSelectQuestion: (id: string) => void; onAddQuestion: (type: QuestionType) => void; onMove: (from: string, to: string) => void;
  onMoveByKeyboard: (id: string, offset: -1 | 1) => void; onDeleteQuestion: (id: string) => void;
  onPreview: () => void; onPublish: () => void; onShare: () => void; onResults: () => void; notify: (message: string) => void;
}) {
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [draggedId, setDraggedId] = useState("");
  const [dropId, setDropId] = useState("");
  const questionIndex = question ? form.questions.findIndex((item) => item.id === question.id) : -1;
  const isChoice = question?.type === "multiple_choice" || question?.type === "dropdown";
  const saveLabel = saveState === "saving" ? "Saving…" : saveState === "local" ? "Saved on this device" : "All changes saved";
  const moveDrop = (targetId: string) => {
    if (draggedId && targetId) onMove(draggedId, targetId);
    setDraggedId(""); setDropId("");
  };

  return <main className="builder-app">
    <header className="builder-header"><button className="back-button" onClick={onBack} aria-label="Back to forms">←</button><span className="brand-mini">f</span><span className="header-divider" /><input className="form-title-input" aria-label="Form title" value={form.title} onChange={(event) => onTitle(event.target.value)} /><span className={`save-label ${saveState}`}><i />{saveLabel}</span><div className="header-spacer" /><button className="button quiet" onClick={onResults}>Results <span className="button-count">{form.responses.length}</span></button><button className="button quiet" onClick={onPreview}>▷ Preview</button>{form.status === "Published" && <button className="button quiet share-action" onClick={onShare}>⌁ Share</button>}<button className="button primary" onClick={onPublish}>{form.status === "Published" ? "Unpublish" : "Publish"}<span>↗</span></button></header>
    <div className="editor-layout">
      <aside className="content-panel"><div className="panel-title"><span>CONTENT</span><button aria-label="Content options" onClick={() => notify("Content options are coming soon")}>•••</button></div>
        <button className="welcome-row" onClick={() => notify("Welcome screen settings are coming soon")}><span className="welcome-symbol">✳</span><span><b>Welcome screen</b><small>Introduction</small></span><span className="row-arrow">›</span></button>
        <div className="question-nav-label">QUESTIONS <span>{form.questions.length}</span></div>
        <div className="question-nav" aria-label="Form questions">{form.questions.map((item, index) => <button key={item.id}
          className={`question-nav-item ${question?.id === item.id ? "active" : ""} ${draggedId === item.id ? "dragging" : ""} ${dropId === item.id ? "drop-target" : ""}`}
          draggable onDragStart={(event) => { setDraggedId(item.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", item.id); }}
          onDragEnd={() => { setDraggedId(""); setDropId(""); }} onDragOver={(event) => { event.preventDefault(); setDropId(item.id); }}
          onDrop={(event) => { event.preventDefault(); moveDrop(event.dataTransfer.getData("text/plain") || draggedId); }} onClick={() => onSelectQuestion(item.id)}>
          <span className="drag-grip" aria-hidden="true">⠿</span><span className="question-order">{String(index + 1).padStart(2, "0")}</span><span className="question-nav-copy"><b>{item.title || "Untitled question"}</b><small>{typeLabel(item.type)}</small></span><span className="required-mark">{item.required ? "*" : ""}</span><span className="reorder-actions"><span role="button" tabIndex={0} aria-label={`Move question ${index + 1} up`} onClick={(event) => { event.stopPropagation(); onMoveByKeyboard(item.id, -1); }} onKeyDown={(event) => { if (event.key === "Enter") { event.stopPropagation(); onMoveByKeyboard(item.id, -1); } }}>↑</span><span role="button" tabIndex={0} aria-label={`Move question ${index + 1} down`} onClick={(event) => { event.stopPropagation(); onMoveByKeyboard(item.id, 1); }} onKeyDown={(event) => { if (event.key === "Enter") { event.stopPropagation(); onMoveByKeyboard(item.id, 1); } }}>↓</span></span>
        </button>)}</div>
        <button className={`add-content-button ${typePickerOpen ? "open" : ""}`} onClick={() => setTypePickerOpen((open) => !open)}><span>＋</span><span>Add content</span><span className="add-chevron">{typePickerOpen ? "−" : "⌄"}</span></button>
        {typePickerOpen && <div className="type-picker"><p>Choose a question type</p><div>{questionTypes.map((item) => <button key={item.type} onClick={() => { onAddQuestion(item.type); setTypePickerOpen(false); }}><span>{item.icon}</span>{item.label}</button>)}</div></div>}
      </aside>

      <section className="editor-stage"><div className="stage-meta"><span>FORM EDITOR</span><span>{String(Math.max(questionIndex + 1, 0)).padStart(2, "0")} / {String(form.questions.length).padStart(2, "0")}</span></div>
        <div className="editor-card" key={question?.id ?? "welcome"}>
          {question ? <>
            <div className="question-counter">{String(questionIndex + 1).padStart(2, "0")} <span>→</span></div>
            <textarea className="question-title-editor" aria-label="Question text" value={question.title} rows={Math.max(1, Math.min(3, Math.ceil(question.title.length / 45)))} onChange={(event) => onQuestionTitle(event.target.value)} placeholder="Ask a question…" />
            <textarea className="question-description-editor" aria-label="Description or help text" value={question.description} onChange={(event) => onDescription(event.target.value)} placeholder="Add a description or help text (optional)" rows={1} />
            <div className="answer-preview">
              {question.type === "multiple_choice" && <div className="preview-options">{question.options.map((option, index) => <div className="option-editor" key={`${question.id}-${index}`}><span className="option-key">{String.fromCharCode(65 + index)}</span><input aria-label={`Choice ${index + 1}`} value={option} onChange={(event) => onOption(index, event.target.value)} /><button onClick={() => onRemoveOption(index)} aria-label={`Remove choice ${index + 1}`}>×</button></div>)}<button className="add-option" onClick={onAddOption}>＋ Add an option</button></div>}
              {question.type === "dropdown" && <div className="preview-dropdown"><label>Dropdown options</label>{question.options.map((option, index) => <div className="option-editor" key={`${question.id}-${index}`}><span className="option-key">{index + 1}</span><input aria-label={`Dropdown option ${index + 1}`} value={option} onChange={(event) => onOption(index, event.target.value)} /><button onClick={() => onRemoveOption(index)} aria-label={`Remove dropdown option ${index + 1}`}>×</button></div>)}<button className="add-option" onClick={onAddOption}>＋ Add an option</button><select aria-label="Dropdown preview" defaultValue=""><option value="" disabled>{question.title || "Select an option"}</option>{question.options.map((option, index) => <option key={index}>{option}</option>)}</select></div>}
              {question.type === "yes_no" && <div className="preview-yes-no"><button>Yes</button><button>No</button></div>}
              {question.type === "rating" && <div className="preview-rating">{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((number) => <button key={number}>{number}</button>)}</div>}
              {!isChoice && question.type !== "yes_no" && question.type !== "rating" && <div className={`preview-input ${question.type === "long_text" ? "multiline" : ""}`}><span>{questionTypes.find((item) => item.type === question.type)?.placeholder}</span>{question.type === "email" && <b>@</b>}</div>}
            </div>
            <div className="editor-card-footer"><span>{question.required ? "* Required" : "Optional"}</span><div><button onClick={() => onMoveByKeyboard(question.id, -1)} aria-label="Move question up">↑</button><button onClick={() => onMoveByKeyboard(question.id, 1)} aria-label="Move question down">↓</button><button className="delete-question" onClick={() => onDeleteQuestion(question.id)} aria-label="Delete question">⌫</button></div></div>
          </> : <div className="empty-question"><span>✳</span><h2>Start with a welcome</h2><p>Set the scene for your questions, then add your first question.</p><button className="button primary" onClick={() => setTypePickerOpen(true)}>＋ Add your first question</button></div>}
        </div><div className="stage-caption">Press <kbd>Enter ↵</kbd> to continue in preview</div>
      </section>

      <aside className="question-settings"><div className="settings-heading"><span>QUESTION</span><button aria-label="Question settings" onClick={() => notify("More question settings are coming soon")}>•••</button></div>{question ? <>
        <label className="setting-label" htmlFor="question-type">QUESTION TYPE</label><select id="question-type" className="type-select" value={question.type} onChange={(event) => onType(event.target.value as QuestionType)}>{questionTypes.map((item) => <option value={item.type} key={item.type}>{item.label}</option>)}</select>
        <div className="settings-rule" /><div className="required-setting"><span><b>Required</b><small>Respondents must answer this question</small></span><button className={`switch ${question.required ? "checked" : ""}`} aria-label="Toggle required" aria-pressed={question.required} onClick={() => onRequired(!question.required)}><i /></button></div>
        <div className="settings-note"><span>↳</span> Your question and description are edited directly on the canvas.</div>
      </> : <p className="no-question-settings">Select a question to edit its settings.</p>}</aside>
    </div>{toast && <Toast message={toast} />}
  </main>;
}

function PreviewFlow({ form, onExit, onComplete }: { form: FormData; onExit: () => void; onComplete: (answers: Record<string, string>) => void }) {
  return <ConversationalFlow form={form} onBack={onExit} onComplete={onComplete} preview />;
}

function ConversationalFlow({ form, onBack, onComplete, preview = false }: { form: FormData; onBack: () => void; onComplete: (answers: Record<string, string>) => void; preview?: boolean }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [complete, setComplete] = useState(false);
  const question = form.questions[index];
  const previous = () => { if (index > 0) { setError(""); setDirection("backward"); setIndex((value) => value - 1); } else if (preview) onBack(); };
  const next = (nextAnswers = answers) => {
    if (!question) return;
    const value = (nextAnswers[question.id] ?? "").trim();
    const invalid = validateAnswer(question, value);
    if (invalid) { setError(invalid); return; }
    setError("");
    if (index < form.questions.length - 1) { setDirection("forward"); setIndex((value) => value + 1); }
    else { onComplete(nextAnswers); setComplete(true); }
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); previous(); }
      if (event.key === "ArrowRight" || event.key === "Enter") { event.preventDefault(); next(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (complete) return <ThankYouScreen form={form} preview={preview} onExit={onBack} />;
  if (!question) return <main className="respondent-shell"><button className="respondent-exit" onClick={onBack}>← Exit</button><p className="respondent-message">This form has no questions yet.</p></main>;
  const type = question.type;
  const choose = (value: string, advance = false) => {
    const updated = { ...answers, [question.id]: value };
    setAnswers(updated); setError("");
    if (advance) window.setTimeout(() => next(updated), 190);
  };
  return <main className="respondent-shell">
    <div className="respondent-topline"><button className="respondent-brand" onClick={onBack}><span className="brand-mini">f</span><span>{form.title}</span></button><span className="respondent-step">{String(index + 1).padStart(2, "0")} <i>/</i> {String(form.questions.length).padStart(2, "0")}</span><button className="respondent-exit" onClick={onBack}>{preview ? "Exit preview" : "Exit"}</button></div>
    <div className="respondent-progress" aria-label={`Question ${index + 1} of ${form.questions.length}`}><span style={{ width: `${((index + 1) / form.questions.length) * 100}%` }} /></div>
    <section className={`respondent-content ${direction}`} key={question.id}>
      <div className="respondent-question-number">{String(index + 1).padStart(2, "0")} <span>→</span></div>
      <h1>{question.title}<sup>{question.required ? "*" : ""}</sup></h1>
      {question.description && <p className="respondent-description">{question.description}</p>}
      <div className="respondent-answer">
        {type === "multiple_choice" && <div className="respondent-options">{question.options.map((option, optionIndex) => <button key={optionIndex} className={`respondent-option ${answers[question.id] === option ? "selected" : ""}`} onClick={() => choose(option, true)}><span>{String.fromCharCode(65 + optionIndex)}</span>{option}</button>)}</div>}
        {type === "dropdown" && <select className="respondent-select" value={answers[question.id] ?? ""} onChange={(event) => choose(event.target.value)}><option value="" disabled>Select an option…</option>{question.options.map((option, optionIndex) => <option value={option} key={optionIndex}>{option}</option>)}</select>}
        {type === "yes_no" && <div className="respondent-options horizontal">{["Yes", "No"].map((option, optionIndex) => <button key={option} className={`respondent-option ${answers[question.id] === option ? "selected" : ""}`} onClick={() => choose(option, true)}><span>{optionIndex ? "B" : "A"}</span>{option}</button>)}</div>}
        {type === "rating" && <div className="rating-options" role="radiogroup" aria-label="Choose a rating">{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((number) => <button role="radio" aria-checked={answers[question.id] === String(number)} className={answers[question.id] === String(number) ? "selected" : ""} key={number} onClick={() => choose(String(number))}>{number}</button>)}</div>}
        {type === "long_text" && <textarea autoFocus className="respondent-textarea" placeholder="Type your answer here…" value={answers[question.id] ?? ""} onChange={(event) => choose(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); next(); } }} />}
        {(type === "short_text" || type === "email" || type === "number") && <input autoFocus className="respondent-input" type={type === "email" ? "email" : type === "number" ? "number" : "text"} placeholder={questionTypes.find((item) => item.type === type)?.placeholder} value={answers[question.id] ?? ""} onChange={(event) => choose(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); next(); } }} />}
      </div>
      {error && <p className="validation-error" role="alert">{error}</p>}
      <div className="respondent-controls"><button className="button primary respondent-continue" onClick={() => next()}>{index === form.questions.length - 1 ? "Submit" : "OK"}<span>↵</span></button><span className="enter-hint">press <kbd>Enter ↵</kbd></span><button className="back-question" disabled={index === 0 && !preview} onClick={previous}>← Back</button></div>
    </section>
    <footer className="respondent-footer"><span>Powered by <b>formcraft</b></span><span>{Math.round(((index + 1) / form.questions.length) * 100)}% completed</span></footer>
  </main>;
}

function validateAnswer(question: Question, value: string): string {
  if (question.required && !value) return "Please answer this question before continuing.";
  if (!value) return "";
  if (question.type === "email" && !/^\S+@\S+\.\S+$/.test(value)) return "Enter a valid email address.";
  if (question.type === "number" && !Number.isFinite(Number(value))) return "Enter a valid number.";
  if ((question.type === "multiple_choice" || question.type === "dropdown") && !question.options.includes(value)) return "Choose one of the available options.";
  if (question.type === "yes_no" && value !== "Yes" && value !== "No") return "Choose Yes or No.";
  if (question.type === "rating" && (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 10)) return "Choose a rating from 1 to 10.";
  return "";
}

function ThankYouScreen({ form, preview, onExit }: { form: FormData; preview: boolean; onExit: () => void }) {
  return <main className="respondent-shell thank-you"><div className="respondent-topline"><span className="respondent-brand"><span className="brand-mini">f</span>{form.title}</span><button className="respondent-exit" onClick={onExit}>{preview ? "Exit preview" : "Close"}</button></div><div className="thank-you-card"><span className="thank-you-mark">✳</span><span className="overline">RESPONSE COMPLETE</span><h1>Thank you for your time.</h1><p>Your answers have been submitted.</p><button className="button primary" onClick={onExit}>{preview ? "Back to editor" : "Done"}<span>→</span></button></div><footer className="respondent-footer"><span>Powered by <b>formcraft</b></span></footer></main>;
}

function Results({ form, summaries, responseIndex, onBack, onEdit, onResponse, onCloseResponse }: {
  form: FormData; summaries: { question: Question; answers: string[] }[]; responseIndex: number | null;
  onBack: () => void; onEdit: () => void; onResponse: (index: number) => void; onCloseResponse: () => void;
}) {
  const exportCsv = () => {
    const rows = [form.questions.map((question) => question.title), ...form.responses.map((response) => form.questions.map((question) => response[question.id] ?? ""))];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); link.download = `${form.title}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };
  return <div className="workspace-shell"><aside className="workspace-rail"><a className="wordmark" href="#home"><span className="wordmark-symbol">f</span>formcraft</a><div className="workspace-name"><span className="workspace-avatar">S</span><span><b>Studio workspace</b><small>Free plan</small></span></div><nav className="workspace-nav"><span className="nav-caption">WORKSPACE</span><button className="workspace-nav-item selected" onClick={onBack}><span>▤</span> All forms</button></nav></aside>
    <main className="workspace-main"><header className="workspace-top"><button className="back-to-forms" onClick={onBack}>← Forms</button><span className="header-spacer" /><button className="button quiet" onClick={onEdit}>Edit form</button></header><div className="results-content"><div className="results-heading"><div><span className="overline">RESULTS</span><h1>{form.title}</h1><p>Responses from your form</p></div><button className="button quiet" onClick={exportCsv}>↓ Export CSV</button></div><div className="results-overview"><div><span>RESPONSES</span><b>{form.responses.length}</b></div><div><span>QUESTIONS</span><b>{form.questions.length}</b></div><div><span>STATUS</span><b className={`form-status ${form.status.toLowerCase()}`}><i />{form.status}</b></div></div>
      <section className="result-section"><div className="result-section-heading"><div><h2>Question summary</h2><p>Answers grouped by question</p></div></div>{summaries.map(({ question, answers }, questionIndex) => <article className="summary-item" key={question.id}><header><span>{String(questionIndex + 1).padStart(2, "0")}</span><b>{question.title}</b><small>{answers.length} answers</small></header>{question.type === "multiple_choice" || question.type === "dropdown" ? question.options.map((option) => { const count = answers.filter((answer) => answer === option).length; const percentage = answers.length ? Math.round(count / answers.length * 100) : 0; return <div className="summary-bar" key={option}><span>{option}</span><div><i style={{ width: `${percentage}%` }} /></div><b>{count}</b></div>; }) : <div className="answer-cloud">{answers.length ? answers.map((answer, index) => <span key={`${index}-${answer}`}>{answer}</span>) : <em>No answers yet</em>}</div>}</article>)}</section>
      <section className="result-section"><div className="result-section-heading"><div><h2>Responses</h2><p>Individual submissions</p></div></div>{form.responses.length === 0 ? <div className="empty-results">No responses yet. Share your form to start collecting answers.</div> : <div className="response-table"><div className="response-table-head"><span>RESPONSE</span><span>SUBMITTED</span><span>ANSWERS</span><span /></div>{form.responses.map((response, index) => <article className="response-row" key={index}><b>Response {String(index + 1).padStart(3, "0")}</b><span>{dateLabel(form.responseDates?.[index])}</span><span>{Object.values(response).filter(Boolean).length} answers</span><button onClick={() => onResponse(index)}>View response →</button></article>)}</div>}</section>
    </div></main>
    {responseIndex !== null && form.responses[responseIndex] && <div className="modal-scrim" onClick={onCloseResponse}><section className="response-detail" onClick={(event) => event.stopPropagation()}><header><div><span className="overline">SUBMISSION DETAIL</span><h2>Response {String(responseIndex + 1).padStart(3, "0")}</h2><small>{dateLabel(form.responseDates?.[responseIndex])}</small></div><button onClick={onCloseResponse} aria-label="Close response">×</button></header><div className="detail-answers">{form.questions.map((question, index) => <article key={question.id}><span>QUESTION {String(index + 1).padStart(2, "0")}</span><b>{question.title}</b><p>{form.responses[responseIndex][question.id] || "No answer"}</p></article>)}</div></section></div>}
  </div>;
}
