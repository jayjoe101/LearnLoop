// Pure logic for the Night Now button UI state.
// Used by Feed to render icon + label. This ships the decision for light/dark display.
export type NightButtonState = {
  icon: string;
  label: string;
  title: string;
  ariaLabel: string;
};

export function getNightNowButtonState(isDark: boolean): NightButtonState {
  if (isDark) {
    return {
      icon: "☀︎",
      label: "Day Now",
      title: "Day Now",
      ariaLabel: "Switch to light mode",
    };
  }
  return {
    icon: "☾",
    label: "Night Now",
    title: "Night Now",
    ariaLabel: "Switch to cozy night mode",
  };
}
