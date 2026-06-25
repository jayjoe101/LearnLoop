"use client";

import { useState, useLayoutEffect } from "react";

const lightState = { icon: "☾", label: "Night Now", title: "Night Now", ariaLabel: "Switch to cozy night mode" };
const darkState = { icon: "☀︎", label: "Day Now", title: "Day Now", ariaLabel: "Switch to light mode" };

export function handleNightNowToggle() {
  const root = document.documentElement;
  const isCurrentlyDark = root.classList.contains("dark");
  const next = !isCurrentlyDark;
  if (next) {
    root.classList.add("dark");
    localStorage.setItem("theme", "dark");
  } else {
    root.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }
}

export function NightNowButton() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  useLayoutEffect(() => {
    const root = document.documentElement;
    setIsDark(root.classList.contains("dark"));
  }, []);

  const current = isDark ? darkState : lightState;

  return (
    <button
      type="button"
      onClick={() => {
        handleNightNowToggle();
        setIsDark(!isDark);
      }}
      className="group flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold shadow-sm transition-all duration-200 hover:scale-[1.035] active:scale-[0.975] border-[var(--color-border)] bg-[var(--color-elevated)] text-[var(--color-coffee-text)] hover:shadow-md"
      title={current.title}
      aria-label={current.ariaLabel}
    >
      <span
        className="inline-block text-[15px] leading-none transition-transform duration-300 ease-out group-hover:rotate-12 group-active:scale-90"
        aria-hidden
        title={current.title}
      >
        {current.icon}
      </span>
      <span className="hidden sm:inline tracking-[-0.2px]">{current.label}</span>
    </button>
  );
}
