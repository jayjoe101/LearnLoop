"use client";

import { useState, useLayoutEffect } from "react";
import { ActionTooltipLabel } from "@/components/action-tooltip-label";
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
      className="night-now-btn action-tooltip action-tooltip--below toolbar-icon-btn"
      aria-label={current.ariaLabel}
    >
      <span className="toolbar-icon-glyph toolbar-theme-icon" aria-hidden>
        {isDark ? (
          <SunIcon className="h-4 w-4" />
        ) : (
          <MoonIcon className="h-4 w-4" />
        )}
      </span>
      <ActionTooltipLabel>{current.title}</ActionTooltipLabel>
    </button>
  );
}