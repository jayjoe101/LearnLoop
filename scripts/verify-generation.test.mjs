import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(fileURLToPath(new URL("..", import.meta.url)));
const SCRATCH =
  process.env.GEN_SCRATCH ??
  "C:\\Users\\jay\\AppData\\Local\\Temp\\grok-goal-a89afbf6666e\\implementer";

mkdirSync(SCRATCH, { recursive: true });

const srcUrl = (rel) => pathToFileURL(join(ROOT, "src", "lib", rel)).href;

test("generation prompts and schema mandate teaching clarity", () => {
  const grokSrc = readFileSync(join(ROOT, "src", "lib", "grok.ts"), "utf8");
  const actionsSrc = readFileSync(join(ROOT, "src", "lib", "actions.ts"), "utf8");
  const fallbackSrc = readFileSync(
    join(ROOT, "src", "lib", "fallback-post.ts"),
    "utf8"
  );

  assert.match(grokSrc, /TEACHING GOAL/);
  assert.match(grokSrc, /bluntly informative/i);
  assert.match(grokSrc, /teaching goal/i);
  assert.match(grokSrc, /export const POST_SCHEMA/);
  assert.match(grokSrc, /export function buildMessages/);
  assert.match(grokSrc, /lastGenerationPath = "primary"/);
  assert.doesNotMatch(actionsSrc, /discoverConcreteSubject/);

  assert.doesNotMatch(fallbackSrc, /TITLE_BUILDERS/);
  assert.doesNotMatch(fallbackSrc, /BODY_BUILDERS/);
  assert.match(fallbackSrc, /buildVariedFallbackPost/);
  assert.match(fallbackSrc, /composeTeachingAnswer/);
});

test("buildMessages output includes teaching directives", async () => {
  const { buildMessages, POST_SCHEMA } = await import(srcUrl("grok.ts"));
  const { PERSONAS } = await import(srcUrl("personas.ts"));

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
  assert.match(system, /TEACHING GOAL/);
  assert.match(system, /bluntly informative/i);
  assert.match(POST_SCHEMA.properties.body.description, /teaching goal/i);
  assert.match(POST_SCHEMA.properties.title.description, /Blunt, informative/i);
});

test("generatePost returns dynamic teaching posts for pinned subjects", async () => {
  const hasApiKey = Boolean(process.env.XAI_API_KEY);

  const { generatePost, peekLastGenerationPath } = await import(srcUrl("grok.ts"));
  const { isBoilerplatePost } = await import(srcUrl("dedup.ts"));
  const { runLocalQualityChecks } = await import(srcUrl("post-quality.ts"));

  const cases = [
    {
      label: "mathematics",
      input: {
        topics: ["Mathematics"],
        style: "Balanced & insightful",
        focusTopic: "Mathematics",
        subjectIndex: 5101,
        concreteSubject:
          "How the Euclidean algorithm finds the greatest common divisor by repeated remainder steps",
      },
    },
    {
      label: "physics",
      input: {
        topics: ["Physics"],
        style: "Deep technical",
        focusTopic: "Physics",
        subjectIndex: 5102,
        concreteSubject:
          "How electromagnetic induction converts changing magnetic flux into electric voltage in a coil",
      },
    },
  ];

  const results = [];

  for (const { label, input } of cases) {
    let post = null;
    for (let tryNum = 0; tryNum < 2 && !post; tryNum++) {
      post = await generatePost({
        ...input,
        subjectIndex: input.subjectIndex + tryNum * 101,
      });
    }
    const pathUsed = peekLastGenerationPath();

    writeFileSync(
      join(SCRATCH, `gen-run-${label}.json`),
      JSON.stringify({ post, pathUsed, hasApiKey }, null, 2),
      "utf8"
    );

    assert.ok(post, `${label}: generatePost returned null`);
    assert.ok(post.title?.trim(), `${label} missing title`);
    assert.ok(post.body?.trim(), `${label} missing body`);
    assert.equal(isBoilerplatePost(post.title, post.body), false, label);
    const quality = runLocalQualityChecks(
      post.title,
      post.body,
      post.topic,
      post.wiki_terms,
      post.subject
    );
    assert.equal(
      quality.pass,
      true,
      `${label} quality failed: ${quality.issues.join("; ")}`
    );

    if (hasApiKey) {
      assert.equal(
        pathUsed,
        "primary",
        `${label}: expected primary LLM path when API key is set`
      );
    } else {
      assert.ok(
        pathUsed === "primary" || pathUsed === "fallback",
        `${label}: expected a generation path`
      );
    }

    results.push(post);
  }

  assert.notEqual(results[0].title, results[1].title);
  assert.notEqual(results[0].body, results[1].body);
});

test("runLocalQualityChecks rejects vague content twice", async () => {
  const { runLocalQualityChecks } = await import(srcUrl("post-quality.ts"));

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