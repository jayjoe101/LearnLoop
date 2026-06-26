import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL("..", import.meta.url)));
const path = join(ROOT, "src", "app", "globals.css");
let css = readFileSync(path, "utf8");

if (!css.includes('theme-tokens.css')) {
  css = css.replace(
    '@import "tailwindcss";',
    '@import "tailwindcss";\n@import "./theme-tokens.css";'
  );
}

const replacements = [
  [/background: rgba\(255, 253, 249, 0\.88\)/g, "background: var(--color-surface-glass)"],
  [/background: rgba\(26, 23, 19, 0\.94\)/g, "background: var(--color-surface-overlay)"],
  [/background: rgba\(201, 149, 108, 0\.28\)/g, "background: var(--color-selection-bg)"],
  [/background: rgba\(201, 149, 108, 0\.22\)/g, "background: var(--color-selection-bg)"],
  [/border: 1px solid rgba\(42, 33, 24, 0\.14\)/g, "border: 1px solid var(--color-border-mid)"],
  [/border: 1px solid rgba\(42, 33, 24, 0\.12\)/g, "border: 1px solid var(--color-border-subtle)"],
  [/border: 1px solid rgba\(42, 33, 24, 0\.1\)/g, "border: 1px solid var(--color-border-subtle)"],
  [/border-color: rgba\(42, 33, 24, 0\.22\)/g, "border-color: var(--color-border-strong)"],
  [/border-color: rgba\(42, 33, 24, 0\.2\)/g, "border-color: var(--color-border-strong)"],
  [/border-color: rgba\(42, 33, 24, 0\.18\)/g, "border-color: var(--color-border-strong)"],
  [/border: 1px dashed rgba\(42, 33, 24, 0\.14\)/g, "border: 1px dashed var(--color-border-mid)"],
  [/border-color: rgba\(201, 149, 108, 0\.45\)/g, "border-color: var(--color-border-focus)"],
  [/border-color: rgba\(201, 149, 108, 0\.35\)/g, "border-color: var(--color-border-accent)"],
  [/border-color: rgba\(201, 149, 108, 0\.28\)/g, "border-color: var(--color-border-accent)"],
  [/border: 1px solid rgba\(166, 107, 58, 0\.35\)/g, "border: 1px solid var(--color-border-accent)"],
  [/border-color: rgba\(109, 138, 90, 0\.35\)/g, "border-color: var(--color-fill-sage-border)"],
  [/background: rgba\(109, 138, 90, 0\.12\)/g, "background: var(--color-fill-sage)"],
  [/border-color: rgba\(143, 166, 122, 0\.35\)/g, "border-color: var(--color-fill-sage-border)"],
  [/background: rgba\(143, 166, 122, 0\.1\)/g, "background: var(--color-fill-sage)"],
  [/background: rgba\(201, 149, 108, 0\.12\)/g, "background: var(--color-fill-accent)"],
  [/background: rgba\(201, 149, 108, 0\.08\)/g, "background: var(--color-fill-accent)"],
  [/border: 1px solid rgba\(245, 233, 217, 0\.2\)/g, "border: 1px solid var(--color-border-mid)"],
  [/border: 1px solid rgba\(245, 233, 217, 0\.15\)/g, "border: 1px solid var(--color-border-mid)"],
  [/border: 1px solid rgba\(245, 233, 217, 0\.12\)/g, "border: 1px solid var(--color-border-subtle)"],
  [/border: 1px solid rgba\(245, 233, 217, 0\.1\)/g, "border: 1px solid var(--color-border-subtle)"],
  [/border: 1px dashed rgba\(245, 233, 217, 0\.14\)/g, "border: 1px dashed var(--color-border-mid)"],
  [/border-color: rgba\(245, 233, 217, 0\.22\)/g, "border-color: var(--color-border-strong)"],
  [/border-color: rgba\(245, 233, 217, 0\.18\)/g, "border-color: var(--color-border-strong)"],
  [/border-color: rgba\(248, 239, 227, 0\.16\)/g, "border-color: var(--color-border-mid)"],
  [/border-color: rgba\(248, 239, 227, 0\.22\)/g, "border-color: var(--color-border-strong)"],
  [/background: linear-gradient\(180deg, #fffdf9 0%, #f5ebe0 48%, #ead9c8 100%\)/g, "background: var(--gradient-btn-primary)"],
  [/background: linear-gradient\(180deg, #ffffff 0%, #faf3ea 48%, #f0e2d2 100%\)/g, "background: var(--gradient-btn-primary-hover)"],
  [/background: linear-gradient\(180deg, #fffdf9 0%, #f3ece2 100%\)/g, "background: var(--gradient-btn-secondary)"],
  [/background: linear-gradient\(180deg, #fffdf9 0%, #f8f2ea 100%\)/g, "background: var(--gradient-btn-ghost)"],
  [/background: linear-gradient\(180deg, #fffdf9 0%, #f5efe6 100%\)/g, "background: var(--gradient-chip)"],
  [/background: linear-gradient\(180deg, #d4a078 0%, #c9956c 100%\)/g, "background: var(--gradient-btn-accent)"],
  [/background: linear-gradient\(180deg, #ddb87a 0%, #d4a078 100%\)/g, "background: var(--gradient-btn-accent-hover)"],
  [/background: linear-gradient\(180deg, #fff8f0 0%, #f5ebe0 100%\)/g, "background: var(--gradient-onboarding-chip-active)"],
  [/background: linear-gradient\(180deg, #fffdf9 0%, #f8f2ea 100%\)/g, "background: var(--gradient-onboarding-card)"],
  [/background: linear-gradient\(180deg, #2a2520 0%, #211d18 100%\)/g, "background: var(--gradient-chip)"],
  [/background: linear-gradient\(180deg, #211d18 0%, #1a1712 100%\)/g, "background: var(--gradient-btn-secondary)"],
  [/background: linear-gradient\(180deg, #3a342e 0%, #2a2520 100%\)/g, "background: var(--gradient-btn-primary-hover)"],
  [/background: linear-gradient\(180deg, #4a4238 0%, #2a2520 100%\)/g, "background: var(--gradient-btn-primary-hover)"],
  [/background: linear-gradient\(180deg, #8f6642 0%, #6f5235 100%\)/g, "background: var(--gradient-btn-accent)"],
  [/background: linear-gradient\(180deg, #a57a52 0%, #8f6642 100%\)/g, "background: var(--gradient-btn-accent-hover)"],
  [/background: #fffdf9/g, "background: var(--color-coffee-surface)"],
  [/background: #211d18/g, "background: var(--color-coffee-surface)"],
  [/background: #2a2520/g, "background: var(--color-coffee-elevated)"],
  [/background: #2e2820/g, "background: var(--color-coffee-elevated)"],
  [/color: #2a2118/g, "color: var(--color-accent-on-fill)"],
  [/box-shadow:\s*0 1px 0 rgba\(255, 255, 255, 0\.9\) inset,\s*0 2px 0 rgba\(166, 107, 58, 0\.12\),\s*0 4px 14px rgba\(42, 33, 24, 0\.12\)/g, "box-shadow: var(--shadow-btn-primary)"],
  [/box-shadow:\s*0 1px 0 rgba\(255, 255, 255, 1\) inset,\s*0 3px 0 rgba\(166, 107, 58, 0\.1\),\s*0 6px 18px rgba\(42, 33, 24, 0\.14\)/g, "box-shadow: var(--shadow-btn-primary-hover)"],
  [/box-shadow:\s*0 2px 6px rgba\(42, 33, 24, 0\.12\) inset,\s*0 1px 3px rgba\(42, 33, 24, 0\.08\)/g, "box-shadow: var(--shadow-btn-primary-active)"],
  [/box-shadow:\s*0 1px 0 rgba\(255, 255, 255, 0\.8\) inset,\s*0 2px 8px rgba\(42, 33, 24, 0\.08\)/g, "box-shadow: var(--shadow-btn-secondary)"],
  [/box-shadow:\s*0 1px 0 rgba\(255, 255, 255, 0\.9\) inset,\s*0 4px 12px rgba\(42, 33, 24, 0\.1\)/g, "box-shadow: var(--shadow-btn-secondary-hover)"],
  [/box-shadow: 0 1px 3px rgba\(42, 33, 24, 0\.06\)/g, "box-shadow: var(--shadow-chip)"],
  [/box-shadow: 0 1px 3px rgba\(42, 33, 24, 0\.08\)/g, "box-shadow: var(--shadow-chip)"],
  [/box-shadow:\s*0 1px 0 rgba\(255, 255, 255, 0\.9\) inset,\s*0 2px 6px rgba\(42, 33, 24, 0\.08\)/g, "box-shadow: var(--shadow-tab-active)"],
  [/box-shadow: 0 12px 32px rgba\(42, 33, 24, 0\.08\)/g, "box-shadow: var(--shadow-card)"],
  [/box-shadow: 0 12px 32px rgba\(42, 33, 24, 0\.2\)/g, "box-shadow: var(--shadow-card)"],
  [/box-shadow: 0 8px 24px rgba\(42, 33, 24, 0\.08\)/g, "box-shadow: var(--shadow-image-frame)"],
  [/box-shadow: 0 8px 24px rgba\(245, 233, 217, 0\.08\)/g, "box-shadow: var(--shadow-image-frame)"],
  [/background: linear-gradient\(\s*135deg,\s*#f8f2ea 0%,\s*#f3ece2 50%,\s*#efe6da 100%\s*\)/g, "background: var(--gradient-placeholder)"],
  [/background: linear-gradient\(\s*135deg,\s*#2a2520 0%,\s*#211d18 50%,\s*#1a1712 100%\s*\)/g, "background: var(--gradient-placeholder)"],
  [/background: linear-gradient\(\s*180deg,\s*rgba\(221, 184, 122, 0\.35\) 0%,\s*rgba\(201, 149, 108, 0\.22\) 100%\s*\)/g, "background: var(--gradient-highlight-text)"],
  [/background: linear-gradient\(\s*180deg,\s*rgba\(212, 160, 136, 0\.28\) 0%,\s*rgba\(201, 149, 108, 0\.16\) 100%\s*\)/g, "background: var(--gradient-highlight-text)"],
  [/background: conic-gradient\(\s*from 180deg,\s*#c4b5a0 0deg,\s*#faf7f2 120deg,\s*#6b5d4f 240deg,\s*#c9956c 360deg\s*\)/g, "background: var(--gradient-onboarding-orb)"],
  [/background: conic-gradient\(\s*from 180deg,\s*#5c5344 0deg,\s*#2a2520 120deg,\s*#3a342e 240deg,\s*#8f6642 360deg\s*\)/g, "background: var(--gradient-onboarding-orb)"],
  [/border-bottom: 1px dashed rgba\(166, 107, 58, 0\.55\)/g, "border-bottom: 1px dashed var(--color-border-accent)"],
  [/border-bottom-color: rgba\(166, 107, 58, 0\.85\)/g, "border-bottom-color: var(--color-border-focus)"],
  [/border-bottom: 1px solid rgba\(166, 107, 58, 0\.35\)/g, "border-bottom: 1px solid var(--color-border-accent)"],
  [/border-bottom-color: rgba\(166, 107, 58, 0\.6\)/g, "border-bottom-color: var(--color-border-focus)"],
  [/box-shadow: 0 0 0 1px rgba\(201, 149, 108, 0\.2\) inset/g, "box-shadow: 0 0 0 1px var(--color-border-accent) inset"],
  [/box-shadow: 0 0 0 1px rgba\(212, 160, 136, 0\.25\) inset/g, "box-shadow: 0 0 0 1px var(--color-border-focus) inset"],
];

for (const [pattern, replacement] of replacements) {
  css = css.replace(pattern, replacement);
}

writeFileSync(path, css);
console.log("Refactored globals.css token references");