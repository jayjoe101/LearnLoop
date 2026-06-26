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
      icon: "sun",
      label: "Light mode",
      title: "Light mode",
      ariaLabel: "Switch to light mode",
    };
  }
  return {
    icon: "moon",
    label: "Night mode",
    title: "Night mode",
    ariaLabel: "Switch to night mode",
  };
}
