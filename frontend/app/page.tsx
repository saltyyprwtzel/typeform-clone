"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { setTheme, ThemeSwitcher, themes, useTheme, type Theme } from "./theme-system";

type QuestionType = "short_text" | "long_text" | "multiple_choice" | "dropdown" | "email" | "number" | "yes_no" | "rating";
type Question = { id: string; type: QuestionType; title: string; required: boolean; description: string; options: string[]; ratingMax?: number };
type FormData = { id: string; title: string; updated: string; status: "Draft" | "Published"; questions: Question[]; responses: Record<string, string>[]; responseDates?: string[] };
type View = "dashboard" | "builder" | "results" | "settings";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WORKSPACE_NAME_KEY = "formcraft-workspace-name";
const DEFAULT_WORKSPACE_NAME = "My workspace";
let workspaceNameSnapshot: string | undefined;
const getWorkspaceNameSnapshot = () => {
  if (workspaceNameSnapshot !== undefined) return workspaceNameSnapshot;
  try {
    workspaceNameSnapshot = window.localStorage.getItem(WORKSPACE_NAME_KEY)?.trim() || DEFAULT_WORKSPACE_NAME;
  } catch {
    workspaceNameSnapshot = DEFAULT_WORKSPACE_NAME;
  }
  return workspaceNameSnapshot;
};
const getWorkspaceNameServerSnapshot = () => DEFAULT_WORKSPACE_NAME;
const subscribeWorkspaceName = (onChange: () => void) => {
  const onStorage = () => { workspaceNameSnapshot = undefined; onChange(); };
  window.addEventListener("storage", onStorage);
  window.addEventListener("workspace-name-change", onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("workspace-name-change", onChange);
  };
};
const questionTypes: { type: QuestionType; label: string; icon: string; placeholder: string }[] = [
  { type: "short_text", label: "Short text", icon: "T", placeholder: "Type your answer here" },
  { type: "long_text", label: "Long text", icon: "¶", placeholder: "Type a longer answer here" },
  { type: "multiple_choice", label: "Multiple choice", icon: "☷", placeholder: "Choose one option" },
  { type: "dropdown", label: "Dropdown", icon: "⌄", placeholder: "Select an option" },
  { type: "email", label: "Email", icon: "@", placeholder: "name@example.com" },
  { type: "number", label: "Number", icon: "#", placeholder: "Enter a number" },
  { type: "yes_no", label: "Yes / No", icon: "◉", placeholder: "Choose yes or no" },
  { type: "rating", label: "Rating", icon: "☆", placeholder: "Choose a rating" },
];
const typeLabel = (type: QuestionType) => questionTypes.find((item) => item.type === type)?.label ?? "Question";
const typeDescription: Record<QuestionType, string> = {
  short_text: "A short written answer", long_text: "A longer written answer", multiple_choice: "Choose one from a list",
  dropdown: "Choose from a dropdown list", email: "Collect an email address", number: "Enter a number",
  yes_no: "Answer yes or no", rating: "Rate on a scale",
};
const makeQuestion = (type: QuestionType, order: number): Question => ({
  id: crypto.randomUUID(), type, title: `Question ${order}`, required: true, description: "", ...(type === "rating" ? { ratingMax: 10 } : {}),
  options: type === "multiple_choice" || type === "dropdown" ? ["Option 1", "Option 2", "Option 3"] : [],
});
const starterForms: FormData[] = [
  {
    id: "welcome", title: "Customer satisfaction survey", updated: new Date().toISOString(), status: "Published",
    questions: [
      { id: "q1", type: "short_text", title: "What should we call you?", required: true, description: "", options: [] },
      { id: "q2", type: "multiple_choice", title: "How was your experience?", required: true, description: "", options: ["Great", "Pretty good", "It was okay", "Not great"] },
      { id: "q3", type: "rating", title: "How likely are you to recommend us?", required: true, description: "", options: [], ratingMax: 10 },
      { id: "q4", type: "long_text", title: "What could we improve?", required: true, description: "Share any details that would help us do better.", options: [] },
      { id: "q5", type: "dropdown", title: "How did you hear about us?", required: true, description: "", options: ["Search engine", "Social media", "A friend", "Other"] },
      { id: "q6", type: "email", title: "What's your email?", required: true, description: "", options: [] },
      { id: "q7", type: "number", title: "How many times have you used our product?", required: true, description: "", options: [] },
      { id: "q8", type: "yes_no", title: "Would you recommend us?", required: true, description: "", options: [] },
    ], responses: [
      { q1: "Taylor", q2: "Great", q3: "9", q4: "The onboarding was clear and easy.", q5: "A friend", q6: "taylor@example.com", q7: "4", q8: "Yes" },
      { q1: "Jordan", q2: "Pretty good", q3: "8", q4: "I would love more reporting options.", q5: "Search engine", q6: "jordan@example.com", q7: "2", q8: "Yes" },
    ],
  },
  {
    id: "event", title: "Event registration", updated: new Date().toISOString(), status: "Published",
    questions: [
      { id: "q4", type: "short_text", title: "What's your name?", required: true, description: "", options: [] },
      { id: "q5", type: "email", title: "What's your email?", required: true, description: "We'll send your ticket here.", options: [] },
      { id: "q6", type: "long_text", title: "Do you have any accessibility needs?", required: true, description: "Let us know how we can make the event comfortable for you.", options: [] },
      { id: "q7", type: "multiple_choice", title: "Which session are you attending?", required: true, description: "", options: ["Morning", "Afternoon", "Both"] },
      { id: "q8", type: "dropdown", title: "How did you hear about this event?", required: true, description: "", options: ["Email", "Website", "Social media", "Friend or colleague"] },
      { id: "q9", type: "number", title: "How many guests are in your group?", required: true, description: "", options: [] },
      { id: "q10", type: "yes_no", title: "Will you need parking?", required: true, description: "", options: [] },
      { id: "q11", type: "rating", title: "How excited are you about the event?", required: true, description: "", options: [], ratingMax: 10 },
    ], responses: [
      { q4: "Alex Morgan", q5: "alex.morgan@example.com", q6: "I need step-free access.", q7: "Morning", q8: "Email", q9: "2", q10: "Yes", q11: "9" },
      { q4: "Jamie Lee", q5: "jamie.lee@example.com", q6: "No special requirements.", q7: "Both", q8: "Website", q9: "1", q10: "No", q11: "8" },
    ],
  },
];

const dateLabel = (value?: string) => {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

export default function Home() {
  // Keep persisted/offline forms separate from display-only demo fallback data.
  const [forms, setForms] = useState<FormData[]>([]);
  const [view, setView] = useState<View>("dashboard");
  const workspaceName = useSyncExternalStore(subscribeWorkspaceName, getWorkspaceNameSnapshot, getWorkspaceNameServerSnapshot);
  const theme = useTheme();
  const [activeId, setActiveId] = useState("");
  const [selectedQuestion, setSelectedQuestion] = useState("");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "local">("saved");
  const [apiReady, setApiReady] = useState(false);
  const [canonicalApiLoaded, setCanonicalApiLoaded] = useState(false);
  const apiQueue = useRef<Promise<void>>(Promise.resolve());
  const [preview, setPreview] = useState(false);
  const [responseIndex, setResponseIndex] = useState<number | null>(null);
  const [shareFormId, setShareFormId] = useState("");

  const chooseTheme = (nextTheme: Theme) => setTheme(nextTheme);

  const renameWorkspace = (name: string) => {
    const nextName = name.trim();
    if (!nextName) return;
    workspaceNameSnapshot = nextName;
    try {
      window.localStorage.setItem(WORKSPACE_NAME_KEY, nextName);
    } catch {
      // The in-memory name still updates if storage is unavailable.
    }
    window.dispatchEvent(new Event("workspace-name-change"));
  };

  const navigateToView = (nextView: View, formId = activeId, replace = false) => {
    setView(nextView);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (nextView === "dashboard") {
      url.searchParams.delete("view");
      url.searchParams.delete("formId");
    } else {
      url.searchParams.set("view", nextView);
      if ((nextView === "builder" || nextView === "results") && formId) url.searchParams.set("formId", formId);
      else url.searchParams.delete("formId");
    }
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    if (replace) window.history.replaceState(null, "", nextUrl);
    else window.history.pushState(null, "", nextUrl);
  };

  useEffect(() => {
    const syncViewFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const requestedView = params.get("view");
      const formId = params.get("formId") ?? "";
      if (requestedView === "settings") {
        setView("settings");
      } else if ((requestedView === "builder" || requestedView === "results") && formId) {
        setActiveId(formId);
        setView(requestedView);
      } else {
        setView("dashboard");
      }
    };
    syncViewFromUrl();
    window.addEventListener("popstate", syncViewFromUrl);
    return () => window.removeEventListener("popstate", syncViewFromUrl);
  }, []);

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
      .then((data) => {
        if (mounted) {
          setForms(data);
          setCanonicalApiLoaded(true);
        }
      })
      .catch(() => { if (mounted && localForms.length) setForms(localForms); })
      .finally(() => { if (mounted) setApiReady(true); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (apiReady) localStorage.setItem("formcraft-data", JSON.stringify(forms));
    if (!apiReady || !canonicalApiLoaded || forms.length === 0) return;
    const snapshot = JSON.stringify({ forms });
    const timer = window.setTimeout(() => {
      setSaveState("saving");
      const request = apiQueue.current.catch(() => {}).then(async () => {
        const response = await fetch(`${API}/api/forms/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: snapshot });
        if (!response.ok) throw new Error("Save failed");
      });
      apiQueue.current = request;
      request.then(() => setSaveState("saved")).catch(() => setSaveState("local"));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [forms, apiReady, canonicalApiLoaded]);

  const displayForms = forms.length ? forms : starterForms;
  const active = displayForms.find((form) => form.id === activeId) ?? displayForms[0];
  const currentQuestion = active?.questions.find((question) => question.id === selectedQuestion) ?? active?.questions[0];
  const filteredForms = displayForms.filter((form) => form.title.toLowerCase().includes(query.toLowerCase()));
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
    const updatedForm = { ...active, ...patch, updated: new Date().toISOString() };
    setForms((items) => items.some((form) => form.id === active.id)
      ? items.map((form) => form.id === active.id ? updatedForm : form)
      : [updatedForm, ...items]);
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
    navigateToView("builder", form.id);
  };
  const openForm = (form: FormData, destination: View = "builder") => {
    setActiveId(form.id);
    setSelectedQuestion(form.questions[0]?.id ?? "");
    navigateToView(destination, form.id);
    setPreview(false);
  };
  const duplicateForm = (form: FormData) => {
    const duplicate = { ...form, id: crypto.randomUUID(), title: `${form.title} copy`, status: "Draft" as const, updated: new Date().toISOString(), responses: [], responseDates: [] };
    setForms((items) => [duplicate, ...items]);
    notify("Form duplicated");
  };
  const renameForm = (formId: string, nextTitle: string) => {
    const form = displayForms.find((item) => item.id === formId);
    if (!form) return;
    const title = nextTitle.trim();
    if (!title || title === form.title) return;
    const updatedForm = { ...form, title, updated: new Date().toISOString() };
    setForms((items) => items.some((item) => item.id === formId)
      ? items.map((item) => item.id === formId ? updatedForm : item)
      : [updatedForm, ...items]);
    notify("Form renamed");
  };
  const setFormPublished = (formId: string) => {
    const form = displayForms.find((item) => item.id === formId);
    if (!form) return;
    const nextStatus: FormData["status"] = form.status === "Published" ? "Draft" : "Published";
    const updatedForm = { ...form, status: nextStatus, updated: new Date().toISOString() };
    setForms((items) => items.some((item) => item.id === formId)
      ? items.map((item) => item.id === formId ? updatedForm : item)
      : [updatedForm, ...items]);
    notify(nextStatus === "Published" ? "Form published" : "Form unpublished");
  };
  const previewForm = (form: FormData) => {
    if (!form.questions.length) { notify("Add a question before previewing this form"); return; }
    setActiveId(form.id);
    setSelectedQuestion(form.questions[0].id);
    setPreview(true);
  };
  const duplicateQuestion = (questionId: string) => {
    if (!active) return;
    const index = active.questions.findIndex((question) => question.id === questionId);
    if (index < 0) return;
    const original = active.questions[index];
    const duplicate = { ...original, id: crypto.randomUUID(), title: `${original.title} copy`, options: [...original.options] };
    const questions = [...active.questions];
    questions.splice(index + 1, 0, duplicate);
    updateForm({ questions });
    setSelectedQuestion(duplicate.id);
    notify("Question duplicated");
  };
  const deleteForm = (formId: string) => {
    setForms((items) => items.filter((form) => form.id !== formId));
    if (canonicalApiLoaded) {
      const request = apiQueue.current.catch(() => {}).then(async () => {
        const response = await fetch(`${API}/api/forms/${encodeURIComponent(formId)}`, { method: "DELETE" });
        if (!response.ok && response.status !== 404) throw new Error("Delete failed");
      });
      apiQueue.current = request;
      request.catch(() => setSaveState("local"));
    }
    notify("Form deleted");
  };
  const addQuestion = (type: QuestionType) => {
    if (!active) return;
    const question = makeQuestion(type, active.questions.length + 1);
    updateForm({ questions: [...active.questions, question] });
    setSelectedQuestion(question.id);
    notify(`${typeLabel(type)} added`);
  };
  const moveQuestion = (fromId: string, toId: string, position: "before" | "after" = "before") => {
    if (!active || fromId === toId) return;
    const questions = [...active.questions];
    const from = questions.findIndex((question) => question.id === fromId);
    const to = questions.findIndex((question) => question.id === toId);
    if (from < 0 || to < 0) return;
    const [moved] = questions.splice(from, 1);
    const targetPosition = to + (position === "after" ? 1 : 0);
    const insertionIndex = targetPosition - (from < targetPosition ? 1 : 0);
    if (insertionIndex === from) return;
    questions.splice(insertionIndex, 0, moved);
    updateForm({ questions });
  };
  const moveByKeyboard = (questionId: string, offset: -1 | 1) => {
    if (!active) return;
    const index = active.questions.findIndex((question) => question.id === questionId);
    const target = active.questions[index + offset];
    if (target) moveQuestion(questionId, target.id, offset === -1 ? "before" : "after");
  };
  const togglePublish = () => {
    if (!active) return;
    if (active.status === "Draft" && !active.questions.length) { notify("Add a question before publishing"); return; }
    const publishing = active.status === "Draft";
    updateForm({ status: publishing ? "Published" : "Draft" });
    if (publishing) { setShareFormId(active.id); notify("Form published"); }
    else { setShareFormId(""); notify("Form unpublished"); }
  };
  const shareForm = (form: FormData) => setShareFormId(form.id);
  const copyShareLink = async (form: FormData) => {
    const url = `${window.location.origin}/f/${form.id}`;
    try { await navigator.clipboard.writeText(url); notify("Link copied"); }
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
  if (preview && active) return <PreviewFlow form={active} onExit={() => setPreview(false)} onComplete={() => undefined} />;
  if (view === "builder" && active) return <><Builder
    form={active} question={currentQuestion} saveState={saveState} toast={toast}
    onBack={() => navigateToView("dashboard", active.id, true)} onTitle={(title) => updateForm({ title })}
    onType={(type) => currentQuestion && updateQuestion(currentQuestion.id, { type, options: type === "multiple_choice" || type === "dropdown" ? ["Option 1", "Option 2", "Option 3"] : [], ...(type === "rating" ? { ratingMax: currentQuestion.ratingMax ?? 10 } : {}) })}
    onRatingMax={(ratingMax) => currentQuestion && updateQuestion(currentQuestion.id, { ratingMax })}
    onQuestionTitle={(title) => currentQuestion && updateQuestion(currentQuestion.id, { title })}
    onDescription={(description) => currentQuestion && updateQuestion(currentQuestion.id, { description })}
    onRequired={(required) => currentQuestion && updateQuestion(currentQuestion.id, { required })}
    onOption={(index, value) => currentQuestion && updateQuestion(currentQuestion.id, { options: currentQuestion.options.map((option, i) => i === index ? value : option) })}
    onAddOption={() => currentQuestion && updateQuestion(currentQuestion.id, { options: [...currentQuestion.options, `Option ${currentQuestion.options.length + 1}`] })}
    onRemoveOption={(index) => currentQuestion && updateQuestion(currentQuestion.id, { options: currentQuestion.options.filter((_, i) => i !== index) })}
    onSelectQuestion={setSelectedQuestion} onAddQuestion={addQuestion} onMove={moveQuestion} onMoveByKeyboard={moveByKeyboard}
    onDeleteQuestion={removeQuestion} onDuplicateQuestion={duplicateQuestion} onPreview={startPreview} onPublish={togglePublish} onShare={() => shareForm(active)} onResults={() => navigateToView("results", active.id)}
  />{toast && <Toast message={toast} />}{shareFormId && displayForms.find((form) => form.id === shareFormId) && <SharePanel form={displayForms.find((form) => form.id === shareFormId)!} onClose={() => setShareFormId("")} onCopy={() => void copyShareLink(displayForms.find((form) => form.id === shareFormId)!)} />}</>;
  if (view === "results" && active) return <><Results
    form={active} summaries={summaries} responseIndex={responseIndex}
    onBack={() => navigateToView("dashboard", active.id, true)} onEdit={() => openForm(active, "builder")}
    onResponse={setResponseIndex} onCloseResponse={() => setResponseIndex(null)} workspaceName={workspaceName}
  />{toast && <Toast message={toast} />}{shareFormId && displayForms.find((form) => form.id === shareFormId) && <SharePanel form={displayForms.find((form) => form.id === shareFormId)!} onClose={() => setShareFormId("")} onCopy={() => void copyShareLink(displayForms.find((form) => form.id === shareFormId)!)} />}</>;

  if (view === "settings") return <SettingsPage
    theme={theme} toast={toast} workspaceName={workspaceName} onTheme={chooseTheme}
    onForms={() => navigateToView("dashboard", activeId, true)}
    onSettings={() => navigateToView("settings")}
    onComingSoon={(feature) => notify(`${feature} coming soon`)}
  />;

  return <><Dashboard forms={filteredForms} totalForms={displayForms.length} responseTotal={displayForms.reduce((sum, form) => sum + form.responses.length, 0)} query={query} onQuery={setQuery} onCreate={createForm} onOpen={openForm} onDuplicate={duplicateForm} onDelete={deleteForm} onShare={shareForm} onResults={(form) => openForm(form, "results")} onPreview={previewForm} onRename={renameForm} onPublish={setFormPublished} onComingSoon={(feature) => notify(`${feature} coming soon`)} onSettings={() => navigateToView("settings")} workspaceName={workspaceName} onRenameWorkspace={renameWorkspace} />{toast && <Toast message={toast} />}{shareFormId && displayForms.find((form) => form.id === shareFormId) && <SharePanel form={displayForms.find((form) => form.id === shareFormId)!} onClose={() => setShareFormId("")} onCopy={() => void copyShareLink(displayForms.find((form) => form.id === shareFormId)!)} />}</>;
}

function Toast({ message }: { message: string }) { return <div className="toast-message" role="status">{message}</div>; }

function SharePanel({ form, onClose, onCopy }: { form: FormData; onClose: () => void; onCopy: () => void }) {
  const url = typeof window === "undefined" ? `/f/${form.id}` : `${window.location.origin}/f/${form.id}`;
  return <div className="modal-scrim share-scrim" onClick={onClose}><section className="share-panel" role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={(event) => event.stopPropagation()}>
    <header><div><span className="overline">YOUR FORM IS LIVE</span><h2 id="share-title">Share your form</h2></div><button className="share-close" aria-label="Close share panel" onClick={onClose}>×</button></header>
    <p>Anyone with this link can respond to <b>{form.title}</b>.</p><label htmlFor="share-link">FORM LINK</label><div className="share-link-row"><input id="share-link" readOnly value={url} onFocus={(event) => event.currentTarget.select()} /><button className="button primary" onClick={onCopy}>Copy link</button></div>
    <div className="share-panel-footer"><a href={url} target="_blank" rel="noreferrer">Open live form ↗</a><button className="button quiet" onClick={onClose}>Done</button></div>
  </section></div>;
}

function ProductNavigation({ active, onForms, onSettings, onComingSoon, workspaceName }: {
  active: "Forms" | "Settings"; onForms: () => void; onSettings: () => void; onComingSoon: (feature: string) => void;
  workspaceName: string;
}) {
  return <header className="product-nav"><a className="wordmark" href="#forms" onClick={(event) => { event.preventDefault(); onForms(); }}><span className="wordmark-symbol">M</span>FormMaker</a><nav className="product-sections" aria-label="Product navigation"><button className={`product-section ${active === "Forms" ? "active" : ""}`} aria-current={active === "Forms" ? "page" : undefined} onClick={onForms}>Forms</button>{["Contacts", "Automations", "Insights", "Pages"].map((feature) => <button className="product-section" key={feature} onClick={() => onComingSoon(feature)}>{feature}</button>)}</nav><ThemeSwitcher /><button className={`settings-nav-action ${active === "Settings" ? "active" : ""}`} aria-current={active === "Settings" ? "page" : undefined} onClick={() => { if (active !== "Settings") onSettings(); }}><svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M8.5 2.5h3l.45 1.75a6.2 6.2 0 0 1 1.25.72l1.7-.58 1.5 2.6-1.25 1.3c.1.48.1.98 0 1.46l1.25 1.3-1.5 2.6-1.7-.58a6.2 6.2 0 0 1-1.25.72l-.45 1.75h-3l-.45-1.75a6.2 6.2 0 0 1-1.25-.72l-1.7.58-1.5-2.6 1.25-1.3a5.7 5.7 0 0 1 0-1.46L3.6 7l1.5-2.6 1.7.58a6.2 6.2 0 0 1 1.25-.72L8.5 2.5Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round"/><circle cx="10" cy="9" r="2.15" stroke="currentColor" strokeWidth="1.35"/></svg><span>Settings</span></button><div className="workspace-user profile-control" role="group" aria-label={`Signed in as Alex Morgan, ${workspaceName}`}><span className="user-avatar" aria-hidden="true">A</span><span><b>Alex Morgan</b><small>{workspaceName}</small></span></div></header>;
}

function SettingsPage({ theme, toast, workspaceName, onTheme, onForms, onSettings, onComingSoon }: {
  theme: Theme; toast: string; workspaceName: string; onTheme: (theme: Theme) => void; onForms: () => void; onSettings: () => void; onComingSoon: (feature: string) => void;
}) {
  return <><div className="workspace-shell settings-shell">
    <ProductNavigation active="Settings" onForms={onForms} onSettings={onSettings} onComingSoon={onComingSoon} workspaceName={workspaceName} />
    <aside className="workspace-rail"><a className="wordmark" href="#forms" onClick={(event) => { event.preventDefault(); onForms(); }}><span className="wordmark-symbol">M</span>FormMaker</a><div className="workspace-name"><span className="workspace-avatar">S</span><span><b>{workspaceName}</b><small>Free plan</small></span></div><nav className="workspace-nav" aria-label="Workspaces"><span className="nav-caption">WORKSPACE</span><button className="workspace-nav-item" onClick={onForms}><span>▤</span> All forms</button><span className="workspace-nav-item selected" aria-current="page"><span>⚙</span> Settings</span></nav></aside>
    <main className="workspace-main"><header className="workspace-top settings-top"><div><span className="overline">SETTINGS</span><h1>Settings</h1><p>Make FormMaker feel like yours.</p></div></header><div className="settings-content"><section className="settings-card"><div className="settings-section-heading"><div><h2>Appearance</h2><p>Choose a color theme for your workspace.</p></div></div><div className="theme-options" role="group" aria-label="Theme"><span className="theme-label">THEME</span><div className="theme-grid">{themes.map((option) => <button key={option.id} type="button" className={`theme-option ${theme === option.id ? "selected" : ""}`} aria-pressed={theme === option.id} onClick={() => onTheme(option.id)}><span className="theme-preview" data-theme={option.id} aria-hidden="true"><span /><span /><span /></span><span className="theme-option-copy"><b>{option.name}</b><small>{option.colors}</small></span><span className="theme-selected-mark" aria-hidden="true">✓</span></button>)}</div></div></section></div></main>
  </div>{toast && <Toast message={toast} />}</>;
}

function Dashboard({ forms, totalForms, responseTotal, query, onQuery, onCreate, onOpen, onDuplicate, onDelete, onShare, onResults, onPreview, onRename, onPublish, onComingSoon, onSettings, workspaceName, onRenameWorkspace }: {
  forms: FormData[]; totalForms: number; responseTotal: number; query: string; onQuery: (value: string) => void; onCreate: () => void;
  onOpen: (form: FormData) => void; onDuplicate: (form: FormData) => void; onDelete: (id: string) => void;
  onShare: (form: FormData) => void; onResults: (form: FormData) => void;
  onPreview: (form: FormData) => void; onRename: (id: string, title: string) => void; onPublish: (id: string) => void; onComingSoon: (feature: string) => void; onSettings: () => void;
  workspaceName: string; onRenameWorkspace: (name: string) => void;
}) {
  const theme = useTheme();
  const [statusFilter, setStatusFilter] = useState<"All" | "Draft" | "Published">("All");
  const [displayMode, setDisplayMode] = useState<"list" | "grid">("list");
  const [sortBy, setSortBy] = useState<"updated" | "name">("updated");
  const [openMenu, setOpenMenu] = useState("");
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState(workspaceName);
  const [renameFormId, setRenameFormId] = useState("");
  const [renameFormDraft, setRenameFormDraft] = useState("");
  const workspaceMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu("");
        setWorkspaceMenuOpen(false);
        setRenameDialogOpen(false);
        setRenameFormId("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  useEffect(() => {
    if (!renameDialogOpen && !renameFormId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [renameDialogOpen, renameFormId]);
  useEffect(() => {
    if (!workspaceMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !workspaceMenuRef.current?.contains(event.target)) setWorkspaceMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [workspaceMenuOpen]);
  const visibleForms = forms
    .filter((form) => statusFilter === "All" || form.status === statusFilter)
    .sort((a, b) => sortBy === "name" ? a.title.localeCompare(b.title) : new Date(b.updated).getTime() - new Date(a.updated).getTime());
  const performAction = (action: () => void) => { setOpenMenu(""); action(); };

  return <div className="workspace-shell">
    <ProductNavigation active="Forms" onForms={() => window.scrollTo({ top: 0, behavior: "smooth" })} onSettings={onSettings} onComingSoon={onComingSoon} workspaceName={workspaceName} />
    <aside className="workspace-rail"><button className="button primary create-form-button" onClick={onCreate}><span>＋</span> Create form</button><label className="search-field sidebar-search"><span>⌕</span><input aria-label="Search forms" placeholder="Search forms" value={query} onChange={(event) => onQuery(event.target.value)} /></label><nav className="workspace-nav" aria-label="Workspaces"><span className="nav-caption">WORKSPACES</span><div className="workspace-group-label">Private</div><button className="workspace-nav-item selected" aria-current="page" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><span>▦</span> {workspaceName} <b>{totalForms}</b></button></nav><div className="workspace-quota"><span className="nav-caption">RESPONSE QUOTA</span><b>{responseTotal} responses collected</b><small>No response limit is configured.</small></div></aside>
    <main className="workspace-main"><header className="workspace-top"><div className="workspace-heading"><div><h1>{workspaceName}</h1><p>Forms and responses in your workspace</p></div><div className="workspace-menu-wrap" ref={workspaceMenuRef}><button className="workspace-overflow" aria-label="Workspace actions" aria-haspopup="menu" aria-expanded={workspaceMenuOpen} onClick={() => setWorkspaceMenuOpen((open) => !open)}>•••</button>{workspaceMenuOpen && <div className="form-actions-menu workspace-actions-menu" role="menu"><button role="menuitem" onClick={() => { setWorkspaceMenuOpen(false); setWorkspaceNameDraft(workspaceName); setRenameDialogOpen(true); }}>Rename workspace</button></div>}</div></div><div className="workspace-header-actions"><div className="form-view-controls"><label>Sort <select aria-label="Sort forms" value={sortBy} onChange={(event) => setSortBy(event.target.value as "updated" | "name")}><option value="updated">Date updated</option><option value="name">Name A–Z</option></select></label><div className="view-toggle" role="group" aria-label="Form display"><button aria-label="List view" aria-pressed={displayMode === "list"} className={displayMode === "list" ? "active" : ""} onClick={() => setDisplayMode("list")}>☰</button><button aria-label="Grid view" aria-pressed={displayMode === "grid"} className={displayMode === "grid" ? "active" : ""} onClick={() => setDisplayMode("grid")}>▦</button></div></div></div></header>
      <div className="dashboard-content">
        <div className="form-library"><div className="library-toolbar"><div><h2>Forms <span>{visibleForms.length}</span></h2></div><div className="form-filters" role="tablist" aria-label="Filter forms">{(["All", "Draft", "Published"] as const).map((filter) => <button key={filter} role="tab" aria-selected={statusFilter === filter} className={statusFilter === filter ? "active" : ""} onClick={() => setStatusFilter(filter)}>{filter === "All" ? "All forms" : filter}</button>)}</div></div>
          {displayMode === "list" && <div className="form-table-head"><span>FORM</span><span>RESPONSES</span><span>COMPLETED</span><span>UPDATED</span><span>FORM LINK</span><span /></div>}
          <div className={`form-collection ${displayMode}`}>
            {visibleForms.map((form, index) => <article className="form-row" key={form.id}>
              <div className="form-identity"><button className={`form-cover cover-${index % 4}`} onClick={() => onOpen(form)} aria-label={`Edit ${form.title}`}><FormThemeIcon theme={theme} /></button><button className="form-name" onClick={() => onOpen(form)}><b>{form.title}</b><small><span className={`inline-form-status ${form.status.toLowerCase()}`}>{form.status}</span> · Updated {new Date(form.updated).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</small></button></div>
              <button className="response-link" onClick={() => onResults(form)}>{form.responses.length}</button><span className="form-completed" title="Only completed submissions are stored; partial responses are not tracked.">{form.responses.length}</span><span className="form-edited">{new Date(form.updated).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</span>{form.status === "Published" ? <button className="form-integrations form-link-button" aria-label={`Open share link for ${form.title}`} title={`Open share link for ${form.title}`} onClick={() => onShare(form)}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13.5a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"/><path d="M14 10.5a5 5 0 0 0-7.07 0l-3 3A5 5 0 0 0 11 20.57l1.72-1.72"/></svg></button> : <span className="form-integrations" aria-label="No public form link">—</span>}
              <div className="form-menu-wrap"><button className="form-menu-trigger" aria-label={`Actions for ${form.title}`} aria-haspopup="menu" aria-expanded={openMenu === form.id} onClick={() => setOpenMenu(openMenu === form.id ? "" : form.id)}>•••</button>{openMenu === form.id && <div className="form-actions-menu" role="menu"><button role="menuitem" onClick={() => performAction(() => onOpen(form))}>Edit</button><button role="menuitem" onClick={() => performAction(() => onPreview(form))}>Preview</button><button role="menuitem" onClick={() => performAction(() => onResults(form))}>Results</button><button role="menuitem" onClick={() => performAction(() => { setRenameFormId(form.id); setRenameFormDraft(form.title); })}>Rename</button><button role="menuitem" onClick={() => performAction(() => onPublish(form.id))}>{form.status === "Published" ? "Unpublish" : "Publish"}</button><button role="menuitem" onClick={() => performAction(() => onDuplicate(form))}>Duplicate</button><span /><button className="danger-action" role="menuitem" onClick={() => performAction(() => onDelete(form.id))}>Delete</button></div>}</div>
            </article>)}
          </div>
          {!visibleForms.length && <div className="empty-library">{query || statusFilter !== "All" ? "No forms match these filters." : <>Your workspace is ready. <button onClick={onCreate}>Create your first form</button></>}</div>}
        </div>
      </div>
    </main>
    {renameDialogOpen && <div className="modal-scrim" onClick={() => setRenameDialogOpen(false)}><section className="share-panel workspace-rename-dialog" role="dialog" aria-modal="true" aria-labelledby="workspace-rename-title" onClick={(event) => event.stopPropagation()}><header><div><span className="overline">WORKSPACE</span><h2 id="workspace-rename-title">Rename workspace</h2></div><button className="share-close" aria-label="Close rename dialog" onClick={() => setRenameDialogOpen(false)}>×</button></header><form className="workspace-rename-form" onSubmit={(event) => { event.preventDefault(); if (!workspaceNameDraft.trim()) return; onRenameWorkspace(workspaceNameDraft); setRenameDialogOpen(false); }}><label htmlFor="workspace-name-input">WORKSPACE NAME</label><input id="workspace-name-input" autoFocus value={workspaceNameDraft} onChange={(event) => setWorkspaceNameDraft(event.target.value)} /><div className="workspace-rename-actions"><button className="button quiet" type="button" onClick={() => setRenameDialogOpen(false)}>Cancel</button><button className="button primary" type="submit" disabled={!workspaceNameDraft.trim()}>Rename</button></div></form></section></div>}
    {renameFormId && <div className="modal-scrim" onClick={() => setRenameFormId("")}><section className="share-panel workspace-rename-dialog" role="dialog" aria-modal="true" aria-labelledby="form-rename-title" onClick={(event) => event.stopPropagation()}><header><div><span className="overline">FORM</span><h2 id="form-rename-title">Rename form</h2></div><button className="share-close" aria-label="Close rename form dialog" onClick={() => setRenameFormId("")}>×</button></header><form className="workspace-rename-form" onSubmit={(event) => { event.preventDefault(); if (!renameFormDraft.trim()) return; onRename(renameFormId, renameFormDraft); setRenameFormId(""); }}><label htmlFor="form-name-input">FORM NAME</label><input id="form-name-input" autoFocus value={renameFormDraft} onChange={(event) => setRenameFormDraft(event.target.value)} /><div className="workspace-rename-actions"><button className="button quiet" type="button" onClick={() => setRenameFormId("")}>Cancel</button><button className="button primary" type="submit" disabled={!renameFormDraft.trim()}>Rename</button></div></form></section></div>}
  </div>;
}

function FormThemeIcon({ theme }: { theme: Theme }) {
  return <svg className={`form-cover-icon icon-${theme}`} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    {theme === "light" && <><circle cx="12" cy="12" r="7.7" fill="currentColor" stroke="none" /><circle cx="9.1" cy="9.5" r="1.1" className="moon-crater" /><circle cx="14.8" cy="13.8" r="1.5" className="moon-crater" /><circle cx="10.4" cy="15.2" r=".65" className="moon-crater" /></>}
    {theme === "dark" && <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.463.402.807a6.5 6.5 0 0 0 8.268 8.268c.344-.215.829-.003.803.397Z" />}
    {theme === "spring" && <><ellipse cx="12" cy="6.5" rx="2.25" ry="3.1" className="flower-petal" /><ellipse cx="12" cy="6.5" rx="2.25" ry="3.1" className="flower-petal" transform="rotate(72 12 12)" /><ellipse cx="12" cy="6.5" rx="2.25" ry="3.1" className="flower-petal" transform="rotate(144 12 12)" /><ellipse cx="12" cy="6.5" rx="2.25" ry="3.1" className="flower-petal" transform="rotate(216 12 12)" /><ellipse cx="12" cy="6.5" rx="2.25" ry="3.1" className="flower-petal" transform="rotate(288 12 12)" /><circle cx="12" cy="12" r="1.8" className="flower-center" /></>}
    {theme === "summer" && <><circle cx="12" cy="12" r="4.1" className="sun-core" /><path d="M12 2.6v2.1m0 14.6v2.1M2.6 12h2.1m14.6 0h2.1M5.35 5.35l1.5 1.5m10.3 10.3 1.5 1.5m0-13.3-1.5 1.5m-10.3 10.3-1.5 1.5" /></>}
    {theme === "fall" && <><path d="M11.7 20.5c-.3-4.7 1.5-8.1 6.4-11.3.2 4.9-1.8 8.9-6.4 11.3Z" className="fall-leaf" /><path d="M11.8 16.9c-4.5-.5-7.2-3.1-8.1-7.8 4.5.6 7.5 3.2 8.1 7.8Z" className="fall-leaf-secondary" /><path d="M11.6 21c0-4.1 1.6-7.2 4.7-10.1M11.4 17.2 6 11.8" /></>}
    {theme === "winter" && <><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.4 4.5 12 7l2.6-2.5M9.4 19.5 12 17l2.6 2.5M4.5 10.3l3.4-.2-.1-3.4M19.5 13.7l-3.4.2.1 3.4M4.5 13.7l3.4.2-.1 3.4M19.5 10.3l-3.4-.2.1-3.4" /></>}
  </svg>;
}

function Builder({ form, question, saveState, toast, onBack, onTitle, onType, onRatingMax, onQuestionTitle, onDescription, onRequired, onOption, onAddOption, onRemoveOption, onSelectQuestion, onAddQuestion, onMove, onMoveByKeyboard, onDeleteQuestion, onDuplicateQuestion, onPreview, onPublish, onShare, onResults }: {
  form: FormData; question?: Question; saveState: "saved" | "saving" | "local"; toast: string;
  onBack: () => void; onTitle: (title: string) => void; onType: (type: QuestionType) => void; onRatingMax: (ratingMax: number) => void;
  onQuestionTitle: (title: string) => void; onDescription: (value: string) => void; onRequired: (value: boolean) => void;
  onOption: (index: number, value: string) => void; onAddOption: () => void; onRemoveOption: (index: number) => void;
  onSelectQuestion: (id: string) => void; onAddQuestion: (type: QuestionType) => void; onMove: (from: string, to: string, position?: "before" | "after") => void;
  onMoveByKeyboard: (id: string, offset: -1 | 1) => void; onDeleteQuestion: (id: string) => void; onDuplicateQuestion: (id: string) => void;
  onPreview: () => void; onPublish: () => void; onShare: () => void; onResults: () => void;
}) {
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [typeSearch, setTypeSearch] = useState("");
  const [draggedId, setDraggedId] = useState("");
  const [dropTarget, setDropTarget] = useState<{ id: string; position: "before" | "after" } | null>(null);
  const draggedIdRef = useRef("");
  const suppressQuestionClick = useRef(false);
  const [questionMenu, setQuestionMenu] = useState("");
  const titleEditor = useRef<HTMLTextAreaElement>(null);
  const questionIndex = question ? form.questions.findIndex((item) => item.id === question.id) : -1;
  const ratingMax = question?.ratingMax ?? 10;
  const isChoice = question?.type === "multiple_choice" || question?.type === "dropdown";
  const availableTypes = questionTypes.filter((item) => item.label.toLowerCase().includes(typeSearch.toLowerCase()));
  const saveLabel = saveState === "saving" ? "Saving…" : saveState === "local" ? "Saved on this device" : "All changes saved";
  const clearDragState = () => {
    draggedIdRef.current = "";
    setDraggedId("");
    setDropTarget(null);
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { setTypePickerOpen(false); setQuestionMenu(""); } };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  useLayoutEffect(() => {
    const editor = titleEditor.current;
    if (!editor) return;
    const resizeEditor = () => {
      editor.style.height = "auto";
      editor.style.height = `${editor.scrollHeight}px`;
    };
    resizeEditor();
    window.addEventListener("resize", resizeEditor);
    return () => window.removeEventListener("resize", resizeEditor);
  }, [question?.id, question?.title]);

  return <main className="builder-app">
    <header className="builder-header"><button className="back-button" onClick={onBack} aria-label="Back to forms">←</button><span className="brand-mini">M</span><span className="header-divider" /><input className="form-title-input" aria-label="Form title" value={form.title} onChange={(event) => onTitle(event.target.value)} /><span className={`save-label ${saveState}`}><i />{saveLabel}</span><ThemeSwitcher /><div className="header-spacer" /><button className="button quiet" onClick={onResults}>Results <span className="button-count">{form.responses.length}</span></button><button className="button quiet" onClick={onPreview}>▷ Preview</button>{form.status === "Published" ? <><button className="button quiet share-action" onClick={onShare}>Share ↗</button><button className="button quiet unpublish-action" onClick={onPublish}>Unpublish</button></> : <button className="button primary" onClick={onPublish}>Publish <span>↗</span></button>}</header>
    <div className="editor-layout">
      <aside className="content-panel"><div className="panel-title"><span>CONTENT</span><span className="content-panel-caption">Questions</span></div>
        <div className="welcome-row"><span className="welcome-symbol">✳</span><span><b>Welcome screen</b><small>Introduction</small></span></div>
        <div className="question-nav-label">QUESTIONS <span>{form.questions.length}</span></div>
        <div className="question-nav" aria-label="Form questions">{form.questions.map((item, index) => <div key={item.id}
          className={`question-nav-item ${question?.id === item.id ? "active" : ""} ${draggedId === item.id ? "dragging" : ""} ${dropTarget?.id === item.id && dropTarget.position === "before" ? "drop-before" : ""} ${dropTarget?.id === item.id && dropTarget.position === "after" ? "drop-after" : ""}`}
          draggable onDragStart={(event) => { draggedIdRef.current = item.id; suppressQuestionClick.current = true; setDraggedId(item.id); setDropTarget(null); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", item.id); }}
          onDragEnd={() => { clearDragState(); window.setTimeout(() => { suppressQuestionClick.current = false; }, 100); }}
          onDragOver={(event) => {
            if (!draggedIdRef.current || draggedIdRef.current === item.id) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            const position = event.clientY < event.currentTarget.getBoundingClientRect().top + event.currentTarget.offsetHeight / 2 ? "before" : "after";
            setDropTarget((current) => current?.id === item.id && current.position === position ? current : { id: item.id, position });
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const sourceId = event.dataTransfer.getData("text/plain") || draggedIdRef.current;
            if (sourceId && sourceId !== item.id) {
              const position = event.clientY < event.currentTarget.getBoundingClientRect().top + event.currentTarget.offsetHeight / 2 ? "before" : "after";
              onMove(sourceId, item.id, position);
            }
            clearDragState();
          }}>
          <button className="question-nav-select" onClick={(event) => { if (suppressQuestionClick.current) { event.preventDefault(); event.stopPropagation(); suppressQuestionClick.current = false; return; } onSelectQuestion(item.id); }}><span className="drag-grip" aria-hidden="true">⠿</span><span className="question-order">{String(index + 1).padStart(2, "0")}</span><span className="question-nav-copy"><b>{item.title || "Untitled question"}</b><small>{typeLabel(item.type)}</small></span><span className="required-mark">{item.required ? "*" : ""}</span></button>
          <button className="question-menu-trigger" aria-label={`Actions for question ${index + 1}`} aria-haspopup="menu" aria-expanded={questionMenu === item.id} onClick={() => setQuestionMenu(questionMenu === item.id ? "" : item.id)}>•••</button>
          {questionMenu === item.id && <div className="question-actions-menu" role="menu"><button role="menuitem" onClick={() => { onMoveByKeyboard(item.id, -1); setQuestionMenu(""); }}>Move up</button><button role="menuitem" onClick={() => { onMoveByKeyboard(item.id, 1); setQuestionMenu(""); }}>Move down</button><button role="menuitem" onClick={() => { onDuplicateQuestion(item.id); setQuestionMenu(""); }}>Duplicate</button><span /><button className="danger-action" role="menuitem" onClick={() => { onDeleteQuestion(item.id); setQuestionMenu(""); }}>Delete</button></div>}
        </div>)}</div>
        <button className={`add-content-button ${typePickerOpen ? "open" : ""}`} onClick={() => setTypePickerOpen((open) => !open)}><span>＋</span><span>Add content</span><span className="add-chevron">{typePickerOpen ? "−" : "⌄"}</span></button>
        {typePickerOpen && <div className="type-picker" role="dialog" aria-label="Add a question"><div className="type-picker-heading"><div><b>Add content</b><p>Choose a question type</p></div><button aria-label="Close question types" onClick={() => setTypePickerOpen(false)}>×</button></div><label className="type-search"><span>⌕</span><input aria-label="Search question types" placeholder="Search question types" value={typeSearch} onChange={(event) => setTypeSearch(event.target.value)} /></label><div className="type-picker-list">{availableTypes.map((item) => <button key={item.type} onClick={() => { onAddQuestion(item.type); setTypePickerOpen(false); setTypeSearch(""); }}><span className="type-picker-icon">{item.icon}</span><span><b>{item.label}</b><small>{typeDescription[item.type]}</small></span></button>)}</div>{!availableTypes.length && <p className="type-empty">No matching question types.</p>}</div>}
      </aside>

      <section className="editor-stage"><div className="stage-meta"><span>FORM EDITOR</span><span>{String(Math.max(questionIndex + 1, 0)).padStart(2, "0")} / {String(form.questions.length).padStart(2, "0")}</span></div>
        <div className="editor-card" key={question?.id ?? "welcome"}>
          {question ? <>
            <div className="question-counter">{String(questionIndex + 1).padStart(2, "0")} <span>→</span></div>
            <textarea ref={titleEditor} className="question-title-editor" aria-label="Question text" value={question.title} rows={1} onChange={(event) => onQuestionTitle(event.target.value)} placeholder="Ask a question…" />
            <textarea className="question-description-editor" aria-label="Description or help text" value={question.description} onChange={(event) => onDescription(event.target.value)} placeholder="Add a description or help text (optional)" rows={1} />
            <div className="answer-preview">
              {question.type === "multiple_choice" && <div className="preview-options">{question.options.map((option, index) => <div className="option-editor" key={`${question.id}-${index}`}><span className="option-key">{String.fromCharCode(65 + index)}</span><input aria-label={`Choice ${index + 1}`} value={option} onChange={(event) => onOption(index, event.target.value)} /><button onClick={() => onRemoveOption(index)} aria-label={`Remove choice ${index + 1}`}>×</button></div>)}<button className="add-option" onClick={onAddOption}>＋ Add an option</button></div>}
              {question.type === "dropdown" && <div className="preview-dropdown"><label>Dropdown options</label>{question.options.map((option, index) => <div className="option-editor" key={`${question.id}-${index}`}><span className="option-key">{index + 1}</span><input aria-label={`Dropdown option ${index + 1}`} value={option} onChange={(event) => onOption(index, event.target.value)} /><button onClick={() => onRemoveOption(index)} aria-label={`Remove dropdown option ${index + 1}`}>×</button></div>)}<button className="add-option" onClick={onAddOption}>＋ Add an option</button><select aria-label="Dropdown preview" defaultValue=""><option value="" disabled>{question.title || "Select an option"}</option>{question.options.map((option, index) => <option key={index}>{option}</option>)}</select></div>}
              {question.type === "yes_no" && <div className="preview-yes-no"><button>Yes</button><button>No</button></div>}
              {question.type === "rating" && <div className="preview-rating">{Array.from({ length: ratingMax }, (_, index) => index + 1).map((number) => <button key={number}>{number}</button>)}</div>}
              {!isChoice && question.type !== "yes_no" && question.type !== "rating" && <div className={`preview-input ${question.type === "long_text" ? "multiline" : ""}`}><span>{questionTypes.find((item) => item.type === question.type)?.placeholder}</span>{question.type === "email" && <b>@</b>}</div>}
            </div>
            <div className="editor-card-footer"><span>{question.required ? "* Required" : "Optional"}</span><span className="editor-question-type">{typeLabel(question.type)}</span></div>
          </> : <div className="empty-question"><span>✳</span><h2>Start with a welcome</h2><p>Set the scene for your questions, then add your first question.</p><button className="button primary" onClick={() => setTypePickerOpen(true)}>＋ Add your first question</button></div>}
        </div><div className="stage-caption">Press <kbd>Enter ↵</kbd> to continue in preview</div>
      </section>

      <aside className="question-settings"><div className="settings-heading"><span>QUESTION SETTINGS</span><span className="settings-question-number">{question ? String(questionIndex + 1).padStart(2, "0") : "—"}</span></div>{question ? <>
        <section className="settings-section"><span className="settings-section-title">QUESTION TYPE</span><select id="question-type" className="type-select" value={question.type} onChange={(event) => onType(event.target.value as QuestionType)}>{questionTypes.map((item) => <option value={item.type} key={item.type}>{item.label}</option>)}</select><small className="settings-help">Choose how respondents will answer.</small></section>
        {question.type === "rating" && <section className="settings-section"><label className="settings-section-title" htmlFor="rating-scale">RATING SCALE</label><div className="rating-scale-control"><input id="rating-scale" aria-label="Rating scale maximum" type="range" min={3} max={10} step={1} value={ratingMax} onChange={(event) => onRatingMax(Number(event.target.value))} /><div><span>3</span><output htmlFor="rating-scale" aria-live="polite">1 – {ratingMax}</output><span>10</span></div></div></section>}
        <section className="settings-section"><span className="settings-section-title">ANSWER BEHAVIOR</span><div className="required-setting"><span><b>Required</b><small>Respondents must answer this question</small></span><button className={`switch ${question.required ? "checked" : ""}`} aria-label="Toggle required" aria-pressed={question.required} onClick={() => onRequired(!question.required)}><i /></button></div></section>
        {isChoice && <section className="settings-section settings-choice-note"><span className="settings-section-title">CHOICES</span><p>Edit answer choices on the question canvas.</p></section>}
        <div className="settings-note"><span>↳</span> Edit question text and description directly on the canvas.</div>
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
  const [finalConfirmed, setFinalConfirmed] = useState(false);
  const submissionStarted = useRef(false);
  const question = form.questions[index];
  const choose = (value: string) => {
    if (!question) return;
    const updated = { ...answers, [question.id]: value };
    setAnswers(updated); setError("");
    if (index === form.questions.length - 1) setFinalConfirmed(false);
  };
  const previous = () => { if (index > 0) { setError(""); setDirection("backward"); setIndex((value) => value - 1); } else if (preview) onBack(); };
  const confirmAnswer = (nextAnswers = answers) => {
    if (!question) return;
    const value = (nextAnswers[question.id] ?? "").trim();
    const invalid = validateAnswer(question, value);
    if (invalid) { setError(invalid); return; }
    setError("");
    if (index < form.questions.length - 1) { setDirection("forward"); setIndex((value) => value + 1); }
    else setFinalConfirmed(true);
  };
  const submitResponse = () => {
    if (!question || index !== form.questions.length - 1 || !finalConfirmed || submissionStarted.current) return;
    const invalid = form.questions.map((item) => validateAnswer(item, (answers[item.id] ?? "").trim())).find(Boolean);
    if (invalid) { setError(invalid); return; }
    submissionStarted.current = true;
    onComplete(answers);
    setComplete(true);
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.key === "Enter" && target instanceof HTMLElement && target.closest("[data-submit-response]")) return;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLElement && target.isContentEditable) return;
      if (target instanceof HTMLSelectElement || target instanceof HTMLButtonElement) {
        if (event.key === "Enter") { event.preventDefault(); confirmAnswer(); }
        return;
      }
      if (question?.type === "multiple_choice" && /^[a-z]$/i.test(event.key)) {
        const choiceIndex = event.key.toUpperCase().charCodeAt(0) - 65;
        const option = question.options[choiceIndex];
        if (option) { event.preventDefault(); choose(option); return; }
      }
      if (question?.type === "yes_no" && /^[yn]$/i.test(event.key)) {
        const value = event.key.toLowerCase() === "y" ? "Yes" : "No";
        event.preventDefault(); choose(value); return;
      }
      if (event.key === "ArrowLeft") { event.preventDefault(); previous(); }
      if (event.key === "ArrowRight" || event.key === "Enter") { event.preventDefault(); confirmAnswer(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (complete) return <ThankYouScreen form={form} preview={preview} onExit={onBack} />;
  if (!question) return <main className="respondent-shell"><button className="respondent-exit" onClick={onBack}>← Exit</button><p className="respondent-message">This form has no questions yet.</p></main>;
  const type = question.type;
  return <main className="respondent-shell">
    <div className="respondent-topline"><button className="respondent-brand" onClick={onBack}><span className="brand-mini">M</span><span>{form.title}</span></button><span className="respondent-step">{String(index + 1).padStart(2, "0")} <i>/</i> {String(form.questions.length).padStart(2, "0")}</span><button className="respondent-exit" onClick={onBack}>{preview ? "Exit preview" : "Exit"}</button></div>
    <div className="respondent-progress" role="progressbar" aria-label="Form progress" aria-valuemin={0} aria-valuemax={form.questions.length} aria-valuenow={index + 1}><span style={{ width: `${((index + 1) / form.questions.length) * 100}%` }} /></div>
    <section className={`respondent-content ${direction}`} key={question.id}>
      <div className="respondent-question-number">{String(index + 1).padStart(2, "0")} <span>→</span></div>
      <h1>{question.title}<sup>{question.required ? "*" : ""}</sup></h1>
      {question.description && <p className="respondent-description">{question.description}</p>}
      <div className="respondent-answer">
        {type === "multiple_choice" && <div className="respondent-options" role="group" aria-label="Answer choices">{question.options.map((option, optionIndex) => <button key={optionIndex} className={`respondent-option ${answers[question.id] === option ? "selected" : ""}`} onClick={() => choose(option)}><span>{String.fromCharCode(65 + optionIndex)}</span>{option}</button>)}</div>}
        {type === "dropdown" && <select className="respondent-select" value={answers[question.id] ?? ""} onChange={(event) => choose(event.target.value)}><option value="" disabled>Select an option…</option>{question.options.map((option, optionIndex) => <option value={option} key={optionIndex}>{option}</option>)}</select>}
        {type === "yes_no" && <div className="respondent-options horizontal">{["Yes", "No"].map((option, optionIndex) => <button key={option} className={`respondent-option ${answers[question.id] === option ? "selected" : ""}`} onClick={() => choose(option)}><span>{optionIndex ? "B" : "A"}</span>{option}</button>)}</div>}
        {type === "rating" && <div className="rating-options" role="radiogroup" aria-label="Choose a rating">{Array.from({ length: question.ratingMax ?? 10 }, (_, index) => index + 1).map((number) => <button role="radio" aria-checked={answers[question.id] === String(number)} className={answers[question.id] === String(number) ? "selected" : ""} key={number} onClick={() => choose(String(number))}>{number}</button>)}</div>}
        {type === "long_text" && <textarea autoFocus className="respondent-textarea" placeholder="Type your answer here…" value={answers[question.id] ?? ""} onChange={(event) => choose(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); confirmAnswer(); } }} />}
        {(type === "short_text" || type === "email" || type === "number") && <input autoFocus className="respondent-input" type={type === "email" ? "email" : type === "number" ? "number" : "text"} placeholder={questionTypes.find((item) => item.type === type)?.placeholder} value={answers[question.id] ?? ""} onChange={(event) => choose(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); confirmAnswer(); } }} />}
      </div>
      {error && <p className="validation-error" role="alert">{error}</p>}
      <div className="respondent-controls"><button className="button primary respondent-continue" onClick={() => confirmAnswer()} disabled={index === form.questions.length - 1 && finalConfirmed}>{index === form.questions.length - 1 && finalConfirmed ? "Answer confirmed" : "OK"}<span>↵</span></button>{index === form.questions.length - 1 && <button className="button quiet respondent-submit" data-submit-response onClick={submitResponse} disabled={!finalConfirmed}>Submit form</button>}<span className="enter-hint">press <kbd>Enter ↵</kbd></span><button className="back-question" disabled={index === 0 && !preview} onClick={previous}>← Back</button></div>
    </section>
    <footer className="respondent-footer"><span>Powered by <b>FormMaker</b></span><span>{Math.round(((index + 1) / form.questions.length) * 100)}% completed</span></footer>
  </main>;
}

function validateAnswer(question: Question, value: string): string {
  if (question.required && !value) return "Please answer this question before continuing.";
  if (!value) return "";
  if (question.type === "email" && !/^\S+@\S+\.\S+$/.test(value)) return "Enter a valid email address.";
  if (question.type === "number" && !Number.isFinite(Number(value))) return "Enter a valid number.";
  if ((question.type === "multiple_choice" || question.type === "dropdown") && !question.options.includes(value)) return "Choose one of the available options.";
  if (question.type === "yes_no" && value !== "Yes" && value !== "No") return "Choose Yes or No.";
  if (question.type === "rating" && (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > (question.ratingMax ?? 10))) return `Choose a rating from 1 to ${question.ratingMax ?? 10}.`;
  return "";
}

function ThankYouScreen({ form, preview, onExit }: { form: FormData; preview: boolean; onExit: () => void }) {
  return <main className="respondent-shell thank-you"><div className="respondent-topline"><span className="respondent-brand"><span className="brand-mini">M</span>{form.title}</span><button className="respondent-exit" onClick={onExit}>{preview ? "Exit preview" : "Close"}</button></div><div className="thank-you-card"><span className="thank-you-mark">✳</span><span className="overline">RESPONSE COMPLETE</span><h1>Thank you for your time.</h1><p>Your answers have been submitted.</p><button className="button primary" onClick={onExit}>{preview ? "Back to editor" : "Done"}<span>→</span></button></div><footer className="respondent-footer"><span>Powered by <b>FormMaker</b></span></footer></main>;
}

function Results({ form, summaries, responseIndex, onBack, onEdit, onResponse, onCloseResponse, workspaceName }: {
  form: FormData; summaries: { question: Question; answers: string[] }[]; responseIndex: number | null;
  onBack: () => void; onEdit: () => void; onResponse: (index: number) => void; onCloseResponse: () => void;
  workspaceName: string;
}) {
  const [tab, setTab] = useState<"summary" | "responses">("summary");
  const [responseQuery, setResponseQuery] = useState("");
  useEffect(() => {
    if (responseIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onCloseResponse(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [responseIndex, onCloseResponse]);
  const exportCsv = () => {
    const rows = [form.questions.map((question) => question.title), ...form.responses.map((response) => form.questions.map((question) => response[question.id] ?? ""))];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); link.download = `${form.title}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };
  const responseRows = form.responses.map((response, index) => ({ response, index })).filter(({ response, index }) => `response ${index + 1} ${Object.values(response).join(" ")}`.toLowerCase().includes(responseQuery.toLowerCase())).reverse();
  return <div className="workspace-shell results-shell"><header className="results-topbar"><a className="wordmark" href="#home"><span className="wordmark-symbol">M</span>FormMaker</a><button className="results-action secondary" onClick={onBack}>← Back to Home</button><ThemeSwitcher /><button className="results-action primary" onClick={onEdit}>Edit form <span aria-hidden="true">→</span></button></header>
    <aside className="workspace-rail"><div className="workspace-name"><span className="workspace-avatar">S</span><span><b>{workspaceName}</b><small>Free plan</small></span></div><nav className="workspace-nav"><span className="nav-caption">WORKSPACE</span><button className="workspace-nav-item selected" onClick={onBack}><span>▤</span> All forms</button></nav></aside>
    <main className="workspace-main"><div className="results-content">
      <div className="results-heading"><div><span className="overline">RESULTS</span><h1>{form.title}</h1><p>Review your form’s performance and responses.</p></div><button className="results-action secondary" onClick={exportCsv}>↓ Export CSV</button></div>
      <div className="results-overview"><div><span>RESPONSES</span><b>{form.responses.length}</b></div><div><span>QUESTIONS</span><b>{form.questions.length}</b></div><div><span>STATUS</span><b className={`form-status ${form.status.toLowerCase()}`}><i />{form.status}</b></div></div>
      <div className="results-tabs" role="tablist" aria-label="Results views"><button role="tab" aria-selected={tab === "summary"} className={tab === "summary" ? "active" : ""} onClick={() => setTab("summary")}>Summary</button><button role="tab" aria-selected={tab === "responses"} className={tab === "responses" ? "active" : ""} onClick={() => setTab("responses")}>Responses <span>{form.responses.length}</span></button></div>
      {tab === "summary" ? <section className="result-section"><div className="result-section-heading"><div><h2>Question summary</h2><p>See how people answered each question.</p></div></div>{summaries.map(({ question, answers }, questionIndex) => {
        const chartOptions = question.type === "multiple_choice" || question.type === "dropdown" ? question.options : question.type === "yes_no" ? ["Yes", "No"] : question.type === "rating" ? Array.from({ length: question.ratingMax ?? 10 }, (_, index) => String(index + 1)) : [];
        const numbers = question.type === "number" ? answers.map(Number).filter(Number.isFinite).sort((a, b) => a - b) : [];
        const median = numbers.length ? numbers.length % 2 ? numbers[(numbers.length - 1) / 2] : (numbers[numbers.length / 2 - 1] + numbers[numbers.length / 2]) / 2 : 0;
        return <article className="summary-item" key={question.id}><header><span>{String(questionIndex + 1).padStart(2, "0")}</span><b>{question.title}</b><small>{answers.length} answers</small></header>
          {chartOptions.length ? <div className="summary-bars">{chartOptions.map((option) => { const count = answers.filter((answer) => answer === option).length; const percentage = answers.length ? Math.round(count / answers.length * 100) : 0; return <div className="summary-bar" key={option}><span>{option}</span><div><i style={{ width: `${percentage}%` }} /></div><b>{count}</b><small>{percentage}%</small></div>; })}</div>
          : question.type === "number" ? numbers.length ? <div className="number-summary"><div><span>AVERAGE</span><b>{(numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(1)}</b></div><div><span>MEDIAN</span><b>{median}</b></div><div><span>RANGE</span><b>{numbers[0]}–{numbers[numbers.length - 1]}</b></div></div> : <div className="answer-cloud"><em>No answers yet</em></div>
          : <div className="answer-cloud">{answers.length ? answers.map((answer, index) => <span key={`${index}-${answer}`}>{answer}</span>) : <em>No answers yet</em>}</div>}
        </article>;
      })}</section> : <section className="result-section response-list-section"><div className="result-section-heading"><div><h2>Responses</h2><p>Individual submissions, newest first.</p></div><label className="search-field response-search"><span>⌕</span><input aria-label="Search responses" placeholder="Search responses" value={responseQuery} onChange={(event) => setResponseQuery(event.target.value)} /></label></div>{responseRows.length === 0 ? <div className="empty-results">{responseQuery ? "No responses match your search." : "No responses yet. Share your form to start collecting answers."}</div> : <div className="response-table"><div className="response-table-head"><span>RESPONSE</span><span>SUBMITTED</span><span>ANSWERS</span><span /></div>{responseRows.map(({ response, index }) => <article className="response-row" key={index}><b>Response {String(index + 1).padStart(3, "0")}</b><span>{dateLabel(form.responseDates?.[index])}</span><span>{Object.values(response).filter(Boolean).length} answers</span><button onClick={() => onResponse(index)}>View response →</button></article>)}</div>}</section>}
    </div></main>
    {responseIndex !== null && form.responses[responseIndex] && <div className="modal-scrim" onClick={onCloseResponse}><section className="response-detail" role="dialog" aria-modal="true" aria-labelledby="response-detail-title" onClick={(event) => event.stopPropagation()}><header><div><span className="overline">SUBMISSION DETAIL</span><h2 id="response-detail-title">Response {String(responseIndex + 1).padStart(3, "0")}</h2><small>{dateLabel(form.responseDates?.[responseIndex])}</small></div><button onClick={onCloseResponse} aria-label="Close response">×</button></header><div className="detail-answers">{form.questions.map((question, index) => <article key={question.id}><span>QUESTION {String(index + 1).padStart(2, "0")}</span><b>{question.title}</b><p>{form.responses[responseIndex][question.id] || "No answer"}</p></article>)}</div></section></div>}
  </div>;
}
