import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(fileURLToPath(new URL("..", import.meta.url)));

const COMPONENT_FILES = [
  "src/components/feed.tsx",
  "src/components/night-now-button.tsx",
  "src/components/post-card.tsx",
];

test("globals.css defines portaled tooltip animation styles", () => {
  const css = readFileSync(join(ROOT, "src", "app", "globals.css"), "utf8");
  assert.match(css, /\.action-tooltip__label--portal/);
  assert.match(css, /@keyframes action-tooltip-in-below/);
  assert.match(css, /@keyframes action-tooltip-in-above/);
  assert.match(css, /\.post-action-btn--like/);
  assert.match(css, /\.toolbar-insight-btn--generating/);
});

test("computeTooltipPosition and tooltipDescribedBy runtime", async () => {
  const { computeTooltipPosition, tooltipDescribedBy } = await import(
    pathToFileURL(join(ROOT, "src", "lib", "tooltip-position.ts")).href
  );

  const rect = { left: 100, top: 200, width: 32, height: 32, bottom: 232 };
  const below = computeTooltipPosition(rect, "below");
  assert.equal(below.x, 116);
  assert.equal(below.y, 240);

  const above = computeTooltipPosition(rect, "above");
  assert.equal(above.x, 116);
  assert.equal(above.y, 192);

  assert.equal(tooltipDescribedBy(false, "tip-1"), undefined);
  assert.equal(tooltipDescribedBy(true, "tip-1"), "tip-1");
});

test("five premium buttons wire useActionTooltip with aria-describedby, no native title", () => {
  for (const rel of COMPONENT_FILES) {
    const src = readFileSync(join(ROOT, rel), "utf8");
    assert.match(src, /useActionTooltip/, `${rel} must use useActionTooltip`);
    assert.match(src, /aria-describedby/, `${rel} must wire aria-describedby`);
    assert.match(src, /tooltipPortal/, `${rel} must render tooltip portal`);
    assert.doesNotMatch(src, /\btitle=/, `${rel} must not use native title=`);
  }

  const hookSrc = readFileSync(
    join(ROOT, "src", "hooks", "use-action-tooltip.tsx"),
    "utf8"
  );
  assert.match(hookSrc, /createPortal/);
  assert.match(hookSrc, /getBoundingClientRect/);
  assert.match(hookSrc, /role="tooltip"/);
  assert.match(hookSrc, /describedBy/);
  assert.match(hookSrc, /tooltipDescribedBy/);
});