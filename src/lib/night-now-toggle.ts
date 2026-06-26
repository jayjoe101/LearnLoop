// Pure handler for Night Now toggle. No React, no state.
// Used by NightNowButton and testable directly.
import { toggleTheme } from "./theme";

export function handleNightNowToggle(): void {
  const store = {
    classList: document.documentElement.classList,
    getItem: localStorage.getItem.bind(localStorage),
    setItem: localStorage.setItem.bind(localStorage),
  };
  toggleTheme(store);
}
