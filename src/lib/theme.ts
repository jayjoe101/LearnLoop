// Pure theme toggle logic with injectable store.
// This centralizes the source of truth for "is dark?" and the flip.
// toggleTheme ALWAYS re-reads the current state before deciding the next.

export interface ThemeStore {
  classList: {
    contains(cls: string): boolean;
    add(cls: string): void;
    remove(cls: string): void;
  };
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readIsDark(store: ThemeStore): boolean {
  // The class on documentElement (set by layout script or apply) is authoritative.
  // The script removes 'dark' unless localStorage said 'dark' at boot.
  return store.classList.contains("dark");
}

export function applyTheme(store: ThemeStore, dark: boolean): void {
  if (dark) {
    store.classList.add("dark");
    store.setItem("theme", "dark");
  } else {
    store.classList.remove("dark");
    store.setItem("theme", "light");
  }
}

export function toggleTheme(store: ThemeStore): boolean {
  // Always read the live value first — never trust a stale boolean from React state.
  const current = readIsDark(store);
  const next = !current;
  applyTheme(store, next);
  return next;
}
