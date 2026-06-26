"use client";

import { useState, useLayoutEffect } from "react";
import { MoonIcon, SunIcon } from "@/components/icons";
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
      className="night-now-btn toolbar-icon-btn"
      title={current.title}
      aria-label={current.ariaLabel}
    >
      {isDark ? (
        <SunIcon className="h-4 w-4" aria-hidden />
      ) : (
        <MoonIcon className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}