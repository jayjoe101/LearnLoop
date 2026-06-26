import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

const ROOT = join(fileURLToPath(new URL("..", import.meta.url)));
const SCRATCH =
  process.env.GEN_SCRATCH ??
  "C:\\Users\\jay\\AppData\\Local\\Temp\\grok-goal-a89afbf6666e\\implementer";

mkdirSync(SCRATCH, { recursive: true });

const srcUrl = (rel) => pathToFileURL(join(ROOT, "src", "lib", rel)).href;

async function timedGenerate(label, input) {
  const { generatePost, peekLastGenerationPath } = await import(srcUrl("grok.ts"));
  const { isBoilerplatePost } = await import(srcUrl("dedup.ts"));
  const { runLocalQualityChecks } = await import(srcUrl("post-quality.ts"));

  const start = performance.now();
  let post = null;
  for (let tryNum = 0; tryNum < 2 && !post; tryNum++) {
    post = await generatePost({
      ...input,
      subjectIndex: input.subjectIndex + tryNum * 101,
    });
  }
  const ms = Math.round(performance.now() - start);
  const pathUsed = peekLastGenerationPath();

  const checks = post
    ? runLocalQualityChecks(
        post.title,
        post.body,
        post.topic,
        post.wiki_terms,
        post.subject
      )
    : { pass: false, issues: ["null post"] };

  const record = {
    label,
    ms,
    pathUsed,
    hasApiKey: Boolean(process.env.XAI_API_KEY),
    ok: Boolean(
      post &&
        !isBoilerplatePost(post.title, post.body) &&
        checks.pass
    ),
    title: post?.title ?? null,
    subject: post?.subject ?? null,
    bodyLength: post?.body?.length ?? 0,
    qualityIssues: checks.issues,
    post,
  };

  writeFileSync(
    join(SCRATCH, `gen-primary-${label}.json`),
    JSON.stringify(record, null, 2),
    "utf8"
  );

  return record;
}

const runs = [
  {
    label: "1",
    input: {
      topics: ["Mathematics"],
      style: "Balanced & insightful",
      focusTopic: "Mathematics",
      subjectIndex: 6201,
      concreteSubject:
        "How the Euclidean algorithm finds the greatest common divisor by repeated remainder steps",
    },
  },
  {
    label: "2",
    input: {
      topics: ["Physics"],
      style: "Balanced & insightful",
      focusTopic: "Physics",
      subjectIndex: 6202,
      concreteSubject:
        "How electromagnetic induction converts changing magnetic flux into electric voltage in a coil",
    },
  },
];

const log = [];
for (const run of runs) {
  log.push(await timedGenerate(run.label, run.input));
}

writeFileSync(join(SCRATCH, "perf-timed.log"), JSON.stringify(log, null, 2), "utf8");

const failed = log.filter((entry) => !entry.ok);
if (failed.length > 0) {
  console.error("FAILED runs:", failed.map((f) => f.label).join(", "));
  process.exit(1);
}

console.log("OK", log.map((e) => `${e.label}:${e.ms}ms:${e.pathUsed}`).join(" "));