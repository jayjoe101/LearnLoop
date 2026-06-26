"use client";

import { useState, useLayoutEffect } from "react";
import { handleNightNowToggle } from "@/lib/night-now-toggle";
import { getNightNowButtonState } from "@/lib/theme-button";

export { handleNightNowToggle } from "@/lib/night-now-toggle";

export function NightNowButton() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  useLayoutEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const current = getNightNowButtonState(isDark);

  return (
    <button
      type="button"
      onClick={() => {
        handleNightNowToggle();
        setIsDark(document.documentElement.classList.contains("dark"));
      }}
      className="night-now-btn group flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold shadow-sm hover:scale-[1.02] active:scale-[0.98]"
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