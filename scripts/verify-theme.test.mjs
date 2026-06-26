import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";


const ROOT = join(fileURLToPath(new URL("..", import.meta.url)));

const FORBIDDEN_VARS = [
  "--text-primary",
  "--text-secondary",
  "--text-muted",
  "--border-color",
  "--accent-violet",
  "--bg-elevated",
];

const REQUIRED_DARK_SELECTORS = [
  ".dark .app-sidebar",
  ".dark .surface-panel",
  ".dark .onboarding-card",
  ".dark .onboarding-chip",
  ".dark .night-now-btn",
  ".dark .post-action-btn",
  ".dark .btn-tactile-primary",
];

const LITERAL_ALLOWED = new Set(["palette.css"]);

function collectCssFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const info = statSync(fullPath);
    if (info.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      collectCssFiles(fullPath, files);
      continue;
    }
    if (extname(fullPath) === ".css") files.push(fullPath);
  }
  return files;
}

function collectSourceFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const info = statSync(fullPath);
    if (info.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      collectSourceFiles(fullPath, files);
      continue;
    }
    const ext = extname(fullPath);
    if (ext === ".tsx" || ext === ".ts" || ext === ".css") files.push(fullPath);
  }
  return files;
}

function extractBlock(css, marker) {
  const start = css.indexOf(marker);
  assert.ok(start >= 0, `Missing ${marker} in globals.css`);
  const brace = css.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(brace + 1, i);
    }
  }
  throw new Error(`Unclosed block for ${marker}`);
}

function installDomMocks() {
  const classes = new Set();
  const storage = new Map();
  global.document = {
    documentElement: {
      classList: {
        contains: (c) => classes.has(c),
        add: (c) => classes.add(c),
        remove: (c) => classes.delete(c),
      },
    },
  };
  global.localStorage = {
    setItem: (k, v) => storage.set(k, v),
    getItem: (k) => storage.get(k) ?? null,
  };
  return { classes, storage };
}

test("source files do not reference undefined theme CSS variables", () => {
  const files = collectSourceFiles(join(ROOT, "src"));
  const violations = [];
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    for (const variable of FORBIDDEN_VARS) {
      if (content.includes(variable)) violations.push(`${file}: ${variable}`);
    }
  }
  assert.deepEqual(violations, [], `Forbidden CSS variables:\n${violations.join("\n")}`);
});

test("palette boundary: literals only in palette.css", () => {
  const cssFiles = collectCssFiles(join(ROOT, "src"));
  const violations = [];
  for (const file of cssFiles) {
    const name = basename(file);
    if (LITERAL_ALLOWED.has(name)) continue;
    const content = readFileSync(file, "utf8");
    if (/#[0-9a-fA-F]{3,8}/.test(content)) violations.push(`${file}: contains hex literal`);
    if (/rgba?\(/.test(content)) violations.push(`${file}: contains rgba/rgb literal`);
  }
  assert.deepEqual(violations, [], violations.join("\n"));
});

test("globals.css @theme and .dark map coffee vars via palette refs only", () => {
  const css = readFileSync(join(ROOT, "src", "app", "globals.css"), "utf8");
  const themeBlock = extractBlock(css, "@theme inline");
  const darkBlock = extractBlock(css, ".dark {");

  for (const block of [themeBlock, darkBlock]) {
    assert.doesNotMatch(block, /#[0-9a-fA-F]{3,8}/, "block must not contain hex");
    assert.doesNotMatch(block, /rgba?\(/, "block must not contain rgba/rgb");
    const lines = block.split("\n");
    for (const line of lines) {
      if (!/^\s*--color-coffee-/.test(line)) continue;
      assert.match(line, /var\(--palette-/, `Expected palette ref: ${line.trim()}`);
    }
    if (block.includes("--color-border:")) {
      assert.match(block, /--color-border:\s*var\(--palette-border\)/);
    }
  }

  assert.match(css, /@import "\.\/palette\.css"/);
  for (const selector of REQUIRED_DARK_SELECTORS) {
    assert.ok(css.includes(selector), `Missing: ${selector}`);
  }
});

test("component CSS uses semantic tokens not raw literals", () => {
  const css = readFileSync(join(ROOT, "src", "app", "globals.css"), "utf8");
  const componentSection = css.slice(css.indexOf("/* Tactile controls */"));
  assert.doesNotMatch(componentSection, /#[0-9a-fA-F]{3,8}/);
  assert.doesNotMatch(componentSection, /rgba?\(/);
  assert.match(css, /\.btn-tactile-primary\s*\{[\s\S]*var\(--gradient-btn-primary\)/);
  assert.match(css, /\.surface-panel\s*\{[\s\S]*var\(--color-surface-glass\)/);
});

test("NightNowButton imports shipped lib toggle and button state", () => {
  const src = readFileSync(
    join(ROOT, "src", "components", "night-now-button.tsx"),
    "utf8"
  );
  assert.match(src, /from "@\/lib\/night-now-toggle"/);
  assert.match(src, /from "@\/lib\/theme-button"/);
  assert.match(src, /handleNightNowToggle\(\)/);
  assert.match(src, /getNightNowButtonState\(/);
  assert.doesNotMatch(src, /export function handleNightNowToggle/);
});

test("handleNightNowToggle runtime via night-now-toggle.ts", async () => {
  const toggleSrc = readFileSync(join(ROOT, "src", "lib", "night-now-toggle.ts"), "utf8");
  assert.match(toggleSrc, /document\.documentElement\.classList/);
  assert.match(toggleSrc, /toggleTheme\(store\)/);

  const { toggleTheme } = await import(
    pathToFileURL(join(ROOT, "src", "lib", "theme.ts")).href
  );
  const { classes, storage } = installDomMocks();
  const store = {
    classList: document.documentElement.classList,
    getItem: localStorage.getItem.bind(localStorage),
    setItem: localStorage.setItem.bind(localStorage),
  };

  toggleTheme(store);
  assert.ok(classes.has("dark"));
  assert.equal(storage.get("theme"), "dark");

  toggleTheme(store);
  assert.ok(!classes.has("dark"));
  assert.equal(storage.get("theme"), "light");
});

test("toggleTheme runtime via theme.ts (used by night-now-toggle)", async () => {
  const { toggleTheme, readIsDark } = await import(
    pathToFileURL(join(ROOT, "src", "lib", "theme.ts")).href
  );
  const classes = new Set();
  const storage = new Map();
  const store = {
    classList: {
      contains: (c) => classes.has(c),
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
    },
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, v),
  };

  assert.equal(readIsDark(store), false);
  toggleTheme(store);
  assert.equal(readIsDark(store), true);
  assert.equal(storage.get("theme"), "dark");
  toggleTheme(store);
  assert.equal(readIsDark(store), false);
  assert.equal(storage.get("theme"), "light");
});

test("layout restores .dark from localStorage before paint", () => {
  const layoutSource = readFileSync(join(ROOT, "src", "app", "layout.tsx"), "utf8");
  assert.match(layoutSource, /localStorage\.getItem\(['"]theme['"]\)/);
  assert.match(layoutSource, /classList\.add\(['"]dark['"]\)/);
  assert.match(layoutSource, /classList\.remove\(['"]dark['"]\)/);
});