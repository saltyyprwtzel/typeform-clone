"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "spring" | "summer" | "fall" | "winter";

export const themes: { id: Theme; name: string; colors: string }[] = [
  { id: "light", name: "Light", colors: "Cream + orange" },
  { id: "dark", name: "Dark", colors: "Charcoal + warm amber" },
  { id: "spring", name: "Spring", colors: "Green + pink" },
  { id: "summer", name: "Summer", colors: "Red + yellow" },
  { id: "fall", name: "Fall", colors: "Orange + peach" },
  { id: "winter", name: "Winter", colors: "Blue + purple" },
];

const isTheme = (value: string | null): value is Theme => themes.some((theme) => theme.id === value);

const subscribeToTheme = (listener: () => void) => {
  window.addEventListener("formcraft-theme-change", listener);
  return () => window.removeEventListener("formcraft-theme-change", listener);
};

const getThemeSnapshot = (): Theme => {
  const current = document.documentElement.dataset.theme ?? null;
  return isTheme(current) ? current : "fall";
};

const getServerThemeSnapshot = (): Theme => "fall";

export function useTheme() {
  return useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("formcraft-theme", theme);
  } catch {
    // Keep the current session theme when storage is unavailable.
  }
  window.dispatchEvent(new Event("formcraft-theme-change"));
}

export function ThemeSwitcher({ variant = "workspace" }: { variant?: "workspace" | "respondent" }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !switcherRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const activeTheme = themes.find((option) => option.id === theme)?.name ?? "Fall";
  return <div className={`theme-switcher ${variant}`} ref={switcherRef}>
    <button className="theme-switcher-trigger" type="button" aria-label={`Change theme, current theme: ${activeTheme}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M10 2.4a7.6 7.6 0 1 0 0 15.2h1.05a1.68 1.68 0 0 0 1.16-2.9 1.08 1.08 0 0 1 .76-1.85h1.18a3.45 3.45 0 0 0 3.45-3.45A7 7 0 0 0 10 2.4Z" stroke="currentColor" strokeWidth="1.35"/><circle cx="6.4" cy="9" r=".8" fill="currentColor"/><circle cx="9.4" cy="6.3" r=".8" fill="currentColor"/><circle cx="13" cy="7" r=".8" fill="currentColor"/></svg>
    </button>
    {open && <div className="theme-switcher-menu" role="menu" aria-label="Choose a theme">
      {themes.map((option) => <button key={option.id} role="menuitemradio" aria-checked={theme === option.id} className={theme === option.id ? "selected" : ""} onClick={() => { setTheme(option.id); setOpen(false); }}><span className="theme-switcher-swatch" data-theme={option.id} aria-hidden="true" /><span>{option.name}</span>{theme === option.id && <span className="theme-switcher-check" aria-hidden="true">✓</span>}</button>)}
    </div>}
  </div>;
}
