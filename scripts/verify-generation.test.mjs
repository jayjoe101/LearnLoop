import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(fileURLToPath(new URL("..", import.meta.url)));
const SCRATCH =
  process.env.GEN_SCRATCH ??
  "C:\\Users\\jay\\AppData\\Local\\Temp\\grok-goal-8a7bd38b0ecf\\implementer";

mkdirSync(SCRATCH, { recursive: true });

test("generation prompts and schema mandate teaching clarity", () => {
  const grokSrc = readFileSync(join(ROOT, "src", "lib", "grok.ts"), "utf8");
  const fallbackSrc = readFileSync(
    join(ROOT, "src", "lib", "fallback-post.ts"),
    "utf8"
  );

  assert.match(grokSrc, /TEACHING RULES/);
  assert.match(grokSrc, /bluntly informative/i);
  assert.match(grokSrc, /learning goal/i);
  assert.match(grokSrc, /plain, simple language/i);
  assert.match(grokSrc, /export const POST_SCHEMA/);
  assert.match(grokSrc, /export function buildMessages/);

  assert.doesNotMatch(fallbackSrc, /TITLE_BUILDERS/);
  assert.doesNotMatch(fallbackSrc, /BODY_BUILDERS/);
  assert.match(fallbackSrc, /buildDynamicTitle/);
  assert.match(fallbackSrc, /buildDynamicBody/);
});

test("buildMessages output includes teaching directives", async () => {
  const { buildMessages, POST_SCHEMA } = await import(
    pathToFileURL(join(ROOT, "src", "lib", "grok.ts")).href
  );
  const { PERSONAS } = await import(
    pathToFileURL(join(ROOT, "src", "lib", "personas.ts")).href
  );

  const messages = buildMessages(
    {
      topics: ["Physics"],
      style: "Balanced & insightful",
      focusTopic: "Physics",
    },
    PERSONAS[0],
    "How neutron stars slow their spin via magnetic braking",
    0
  );

  const system = messages[0].content;
  assert.match(system, /TEACHING RULES/);
  assert.match(system, /bluntly informative/i);
  assert.match(POST_SCHEMA.properties.body.description, /teaching goal/i);
  assert.match(POST_SCHEMA.properties.title.description, /Bluntly informative/i);
});

test("generatePost twice produces dynamic teaching posts", async () => {
  const savedKey = process.env.XAI_API_KEY;
  delete process.env.XAI_API_KEY;

  const { generatePost } = await import(
    pathToFileURL(join(ROOT, "src", "lib", "grok.ts")).href
  );
  const { isBoilerplatePost } = await import(
    pathToFileURL(join(ROOT, "src", "lib", "dedup.ts")).href
  );
  const { runLocalQualityChecks } = await import(
    pathToFileURL(join(ROOT, "src", "lib", "post-quality.ts")).href
  );

  try {
    const post1 = await generatePost({
      topics: ["Quantum Physics"],
      style: "Balanced & insightful",
      subjectIndex: 4101,
      concreteSubject:
        "How quantum tunneling lets particles cross classically forbidden energy barriers",
    });

    const post2 = await generatePost({
      topics: ["Computer Science"],
      style: "Deep technical",
      subjectIndex: 4102,
      concreteSubject:
        "Why branch predictors in CPUs speculatively execute the wrong path and how mispredictions stall pipelines",
    });

    writeFileSync(
      join(SCRATCH, "gen-run-1.txt"),
      JSON.stringify(post1, null, 2),
      "utf8"
    );
    writeFileSync(
      join(SCRATCH, "gen-run-2.txt"),
      JSON.stringify(post2, null, 2),
      "utf8"
    );

    for (const [label, post] of [
      ["post1", post1],
      ["post2", post2],
    ]) {
      assert.ok(post.title?.trim(), `${label} missing title`);
      assert.ok(post.body?.trim(), `${label} missing body`);
      assert.equal(isBoilerplatePost(post.title, post.body), false, label);
      const quality = runLocalQualityChecks(
        post.title,
        post.body,
        post.topic,
        post.wiki_terms
      );
      assert.equal(
        quality.pass,
        true,
        `${label} quality failed: ${quality.issues.join("; ")}`
      );
    }

    assert.notEqual(post1.title, post2.title);
    assert.notEqual(post1.body, post2.body);
  } finally {
    if (savedKey) process.env.XAI_API_KEY = savedKey;
  }
});

test("runLocalQualityChecks rejects vague content twice", async () => {
  const { runLocalQualityChecks } = await import(
    pathToFileURL(join(ROOT, "src", "lib", "post-quality.ts")).href
  );

  const vague1 = runLocalQualityChecks(
    "Something cool about physics",
    "This is an interesting bit about the fascinating world of physics. Worth knowing.",
    "Physics",
    [{ term: "Physics" }]
  );
  assert.equal(vague1.pass, false);
  assert.ok(vague1.issues.length > 0);

  const vague2 = runLocalQualityChecks(
    "Wilder than it sounds",
    "One of those ideas that sounds simple until you think about it. Feels fuzzy, you're not alone.",
    "Mathematics",
    [{ term: "Mathematics" }]
  );
  assert.equal(vague2.pass, false);
  assert.ok(vague2.issues.length > 0);

  writeFileSync(
    join(SCRATCH, "quality-reject-1.txt"),
    JSON.stringify(vague1, null, 2),
    "utf8"
  );
  writeFileSync(
    join(SCRATCH, "quality-reject-2.txt"),
    JSON.stringify(vague2, null, 2),
    "utf8"
  );
});