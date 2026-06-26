import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const ROOT = join(fileURLToPath(new URL("..", import.meta.url)));

const {
  parseBodyBlocks,
  parseRichTextSegments,
  parseInlineSegments,
  enrichBodyBlocks,
  enrichStoredPostBody,
  normalizePostBodyMarkup,
  splitParagraphs,
} = await import("../src/lib/post-content.ts");

const { renderMathToHtml, highlightCodeToHtml } = await import(
  "../src/lib/post-render.ts"
);

const { PostBody, describeRenderedBlocks } = await import(
  "../src/components/post-body.tsx"
);

const SAMPLE_1 =
  "The **gradient** satisfies $\\nabla f = 0$ for critical points.\n\n```python\ndef solve():\n    return 42\n```";

const SAMPLE_2 =
  "Use *italics* and ==highlight== with $$\\int_0^1 x^2\\,dx = \\frac{1}{3}$$ and [docs](https://example.com/docs).";

test("parseBodyBlocks identifies code and preserves paragraph text", () => {
  const blocks = parseBodyBlocks(SAMPLE_1);
  assert.ok(blocks.some((b) => b.type === "code" && b.language === "python"));
  assert.ok(blocks.some((b) => b.type === "paragraph"));
});

test("parseRichTextSegments detects inline math and bold", () => {
  const paragraph = blocksFirstParagraph(SAMPLE_1);
  const rich = parseRichTextSegments(paragraph);
  assert.ok(rich.some((s) => s.type === "math-inline"));
  assert.ok(rich.some((s) => s.type === "bold"));
});

test("parseRichTextSegments retains italic highlight and display math block", () => {
  const blocks = parseBodyBlocks(SAMPLE_2);
  assert.ok(blocks.some((b) => b.type === "display-math"));
  const paragraph = blocks.find((b) => b.type === "paragraph");
  assert.ok(paragraph);
  const rich = parseRichTextSegments(paragraph.text);
  assert.ok(rich.some((s) => s.type === "italic"));
  assert.ok(rich.some((s) => s.type === "highlight"));
});

test("parseInlineSegments retains embedded links", () => {
  const blocks = parseBodyBlocks(SAMPLE_2);
  const paragraph = blocks.find(
    (b) => b.type === "paragraph" && b.text.includes("[docs]")
  );
  assert.ok(paragraph);
  const inline = parseInlineSegments(paragraph.text, "wikipedia");
  assert.ok(inline.some((s) => s.type === "link"));
});

test("render helpers produce math and highlighted code markup", () => {
  const math = renderMathToHtml("E=mc^2", false);
  assert.match(math, /class="katex"/);
  const code = highlightCodeToHtml("const x = 1;", "javascript");
  assert.match(code, /hljs|keyword|const/);
});

test("enrichBodyBlocks does not mutate fenced code blocks", () => {
  const body = "Explain solve.\n\n```python\ndef solve():\n    return 42\n```";
  const blocks = enrichBodyBlocks(parseBodyBlocks(body), [{ term: "solve" }]);
  const code = blocks.find((b) => b.type === "code");
  assert.ok(code);
  assert.equal(code.code, "def solve():\n    return 42");
  assert.ok(!code.code.includes("[[solve]]"));
});

test("enrichStoredPostBody matches grok storage path and preserves code fences", () => {
  const body = SAMPLE_1;
  const stored = enrichStoredPostBody(body, [{ term: "solve" }]);
  assert.ok(stored.includes("def solve():"));
  assert.ok(!stored.includes("def [[solve]]()"));
  assert.ok(stored.includes("```python"));
  const reparsed = parseBodyBlocks(stored);
  const code = reparsed.find((b) => b.type === "code");
  assert.equal(code?.code, "def solve():\n    return 42");
});

test("enrichStoredPostBody does not wiki-wrap symbols inside inline math", () => {
  const body = "Satisfies $\\nabla f = 0$ at critical points.";
  const stored = enrichStoredPostBody(body, [{ term: "f" }]);
  assert.ok(!stored.includes("[[f]]"));
  assert.match(stored, /\$\\nabla f = 0\$/);

  const paragraph = parseBodyBlocks(stored).find((b) => b.type === "paragraph");
  assert.ok(paragraph);
  const rich = parseRichTextSegments(paragraph.text);
  const math = rich.find((s) => s.type === "math-inline");
  assert.ok(math);
  assert.equal(math.latex, "\\nabla f = 0");
});

test("PostBody renderToStaticMarkup includes math and code markup", () => {
  const html = renderToStaticMarkup(
    createElement(PostBody, {
      body: SAMPLE_1,
      links: [],
      wikiTerms: [{ term: "solve" }],
    })
  );
  assert.match(html, /post-code-block/);
  assert.match(html, /katex/);
  assert.match(html, /hljs-title function_/);
  assert.ok(!html.includes("[[solve]]"));
});

test("normalizePostBodyMarkup converts LaTeX delimiters and closes open fences", () => {
  const normalized = normalizePostBodyMarkup(
    "Inline \\(E=mc^2\\) and block \\[x^2\\]\n\n```python\nprint(1)"
  );
  assert.match(normalized, /\$E=mc\^2\$/);
  assert.match(normalized, /\$\$x\^2\$\$/);
  assert.ok(normalized.trimEnd().endsWith("```"));
});

test("parseBodyBlocks handles single-line fenced code and inline code spans", () => {
  const blocks = parseBodyBlocks("Try ```javascript const x = 1; ``` here.");
  const code = blocks.find((b) => b.type === "code");
  assert.ok(code);
  assert.equal(code.language, "javascript");
  assert.match(code.code, /const x = 1/);

  const rich = parseRichTextSegments("Use `pip install numpy` for setup.");
  assert.ok(rich.some((s) => s.type === "code-inline"));
});

test("PostBody strips visible fence markers from rendered HTML", () => {
  const html = renderToStaticMarkup(
    createElement(PostBody, {
      body: "Example:\n\n```python\nprint('ok')\n```",
      links: [],
      wikiTerms: [],
    })
  );
  assert.match(html, /post-code-block/);
  assert.ok(!html.includes("```"));
});

test("describeRenderedBlocks includes code and math containers", () => {
  const blocks = parseBodyBlocks(SAMPLE_1);
  const described = describeRenderedBlocks(blocks);
  assert.ok(described.some((line) => line.startsWith("code:")));
  assert.ok(described.some((line) => line.includes("math-inline") || line.includes("paragraph")));
});

test("grok prompt and schema mention all formatting options", () => {
  const grok = readFileSync(join(ROOT, "src/lib/grok.ts"), "utf8");
  const required = [
    "bold",
    "italic",
    "highlight",
    "link",
    "math",
    "code",
    "enrichStoredPostBody",
  ];
  for (const term of required) {
    assert.match(grok.toLowerCase(), new RegExp(term.toLowerCase()));
  }
});

function blocksFirstParagraph(body) {
  const blocks = parseBodyBlocks(body);
  const paragraph = blocks.find((b) => b.type === "paragraph");
  assert.ok(paragraph, "expected paragraph block");
  return paragraph.text;
}