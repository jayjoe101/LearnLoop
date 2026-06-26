import { isMetaTopicPost } from "@/lib/topic-subjects";
import { chatCompletion, FAST_MODEL, parseJsonContent } from "@/lib/xai-client";
import type { PostWikiTerm } from "@/lib/types";

export type QualityVerdict = {
  pass: boolean;
  issues: string[];
};

const LOCAL_CHECKS = [
  (_title: string, body: string) =>
    body.length < 120 ? "Body is too short" : null,
  (title: string) =>
    title.length < 12 ? "Title is too short" : null,
  (_title: string, body: string) =>
    !/\[\[[^\]]+\]\]/.test(body) ? "Missing [[wiki-linked]] terms" : null,
  (_title: string, body: string) =>
    !/\*\*[^*]+\*\*|==[^=]+==/.test(body)
      ? "Missing markdown emphasis (**bold** or ==highlight==)"
      : null,
  (title: string, body: string) => checkTeachingClarity(title, body),
];

const VAGUE_MARKERS = [
  "something cool",
  "interesting bit",
  "worth knowing",
  "surprise the reader",
  "feels fuzzy",
  "reputation problem",
  "sounds simple until",
  "stop right before it gets good",
  "wilder than it sounds",
  "hand-waves",
];

export function checkTeachingClarity(title: string, body: string): string | null {
  const lower = `${title} ${body}`.toLowerCase();
  const vagueHits = VAGUE_MARKERS.filter((m) => lower.includes(m)).length;
  if (vagueHits >= 1) {
    return "Wording is too vague — state a blunt, specific teaching goal";
  }

  const hasLearningGoal =
    /\b(you('ll| will) (learn|understand|know|see)|this post teaches|takeaway|learning goal|by the end)\b/i.test(
      body
    );
  if (!hasLearningGoal) {
    return "Missing explicit learning goal — say what the reader will understand";
  }

  const hasPlainExplanation =
    /\b(because|means|works by|happens when|the reason|mechanism|constraint|tradeoff|hinges on|stated plainly|in simple terms)\b/i.test(
      lower
    );
  if (!hasPlainExplanation) {
    return "Missing plain explanation of how or why — teach the mechanism simply";
  }

  return null;
}

export function runLocalQualityChecks(
  title: string,
  body: string,
  topic: string,
  wikiTerms: PostWikiTerm[]
): QualityVerdict {
  const issues: string[] = [];

  for (const check of LOCAL_CHECKS) {
    const issue = check(title, body);
    if (issue) issues.push(issue);
  }

  if (isMetaTopicPost(title, body, topic, wikiTerms)) {
    issues.push("Post is a meta overview of the topic label, not a specific subject");
  }

  return { pass: issues.length === 0, issues };
}

export async function validatePostWithModel(options: {
  topic: string;
  subject: string;
  title: string;
  body: string;
}): Promise<QualityVerdict> {
  const content = await chatCompletion({
    model: FAST_MODEL,
    temperature: 0.1,
    maxTokens: 120,
    timeoutMs: 6_000,
    jsonSchema: {
      name: "post_quality",
      schema: {
        type: "object",
        properties: {
          pass: { type: "boolean" },
          issues: {
            type: "array",
            items: { type: "string" },
            maxItems: 4,
          },
        },
        required: ["pass", "issues"],
        additionalProperties: false,
      },
    },
    messages: [
      {
        role: "system",
        content:
          "You are a strict feed quality reviewer. Reject meta overviews, vague fluff, hedging, and posts that do not teach one specific new idea in plain language. Approve only posts with a clear learning goal and a simple explanation of a complex subject.",
      },
      {
        role: "user",
        content: `Interest area: ${options.topic}
Required specific subject: ${options.subject}

Title: ${options.title}

Body:
${options.body.slice(0, 1200)}

Does this post (1) state a clear teaching goal, (2) use bluntly informative wording, and (3) explain the subject simply so the reader learns something specific?
Return JSON: { "pass": true/false, "issues": ["..."] }`,
      },
    ],
  });

  if (!content) {
    return { pass: true, issues: [] };
  }

  const parsed = parseJsonContent<{ pass?: boolean; issues?: string[] }>(content);
  if (!parsed || typeof parsed.pass !== "boolean") {
    return { pass: true, issues: [] };
  }

  return {
    pass: parsed.pass,
    issues: (parsed.issues ?? []).filter(Boolean).slice(0, 4),
  };
}

export async function validateGeneratedPost(options: {
  topic: string;
  subject: string;
  title: string;
  body: string;
  wikiTerms: PostWikiTerm[];
}): Promise<QualityVerdict> {
  const local = runLocalQualityChecks(
    options.title,
    options.body,
    options.topic,
    options.wikiTerms
  );

  if (!local.pass) return local;

  const model = await validatePostWithModel(options);
  if (!model.pass) return model;

  return { pass: true, issues: [] };
}