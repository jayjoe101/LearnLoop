import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL("..", import.meta.url)));

const TARGET_BUTTON_FILES = [
  { path: "src/components/feed.tsx", markers: ["toolbar-live-btn", "toolbar-insight-btn"] },
  { path: "src/components/night-now-button.tsx", markers: ["night-now-btn"] },
  { path: "src/components/post-card.tsx", markers: ["post-action-btn--like", "post-action-btn--hide"] },
];

test("globals.css defines animated custom tooltip styles", () => {
  const css = readFileSync(join(ROOT, "src", "app", "globals.css"), "utf8");
  assert.match(css, /\.action-tooltip__label\s*\{/);
  assert.match(css, /@keyframes action-tooltip-in-below/);
  assert.match(css, /@keyframes action-tooltip-in-above/);
  assert.match(css, /action-tooltip-in-below 0\.3s/);
  assert.match(css, /\.post-action-btn--like/);
  assert.match(css, /\.toolbar-insight-btn--generating/);
});

test("five premium buttons use ActionTooltipLabel and not native title tooltips", () => {
  for (const { path, markers } of TARGET_BUTTON_FILES) {
    const src = readFileSync(join(ROOT, path), "utf8");
    assert.match(src, /ActionTooltipLabel/, `${path} must import ActionTooltipLabel`);
    for (const marker of markers) {
      assert.ok(src.includes(marker), `${path} missing ${marker}`);
    }
    assert.doesNotMatch(src, /\btitle=/, `${path} must not use native title= tooltips`);
  }
});

test("action-tooltip-label component ships tooltip markup", () => {
  const src = readFileSync(
    join(ROOT, "src", "components", "action-tooltip-label.tsx"),
    "utf8"
  );
  assert.match(src, /action-tooltip__label/);
  assert.match(src, /role="tooltip"/);
});