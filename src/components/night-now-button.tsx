"use client";

import { useState, useLayoutEffect } from "react";
import { MoonIcon, SunIcon } from "@/components/icons";
import { useActionTooltip } from "@/hooks/use-action-tooltip";
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
  const themeTooltip = useActionTooltip({
    label: current.title,
    placement: "below",
  });

  return (
    <>
      <button
        ref={themeTooltip.anchorRef}
        type="button"
        onClick={() => {
          handleNightNowToggle();
          setIsDark(document.documentElement.classList.contains("dark"));
        }}
        aria-label={current.ariaLabel}
        aria-describedby={themeTooltip.describedBy}
        {...themeTooltip.handlers}
        className="night-now-btn toolbar-icon-btn"
      >
        <span className="toolbar-icon-glyph toolbar-theme-icon" aria-hidden>
          {isDark ? (
            <SunIcon className="h-4 w-4" />
          ) : (
            <MoonIcon className="h-4 w-4" />
          )}
        </span>
      </button>
      {themeTooltip.tooltipPortal}
    </>
  );
}