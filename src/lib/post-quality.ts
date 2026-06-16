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
  (title: string, _body: string) =>
    title.length < 12 ? "Title is too short" : null,
  (_title: string, body: string) =>
    !/\[\[[^\]]+\]\]/.test(body) ? "Missing [[wiki-linked]] terms" : null,
  (_title: string, body: string) =>
    !/\*\*[^*]+\*\*|==[^=]+==/.test(body)
      ? "Missing markdown emphasis (**bold** or ==highlight==)"
      : null,
];

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
          "You are a strict feed quality reviewer. Reject meta overviews, vague fluff, and off-topic posts. Approve specific, insightful teaching posts.",
      },
      {
        role: "user",
        content: `Interest area: ${options.topic}
Required specific subject: ${options.subject}

Title: ${options.title}

Body:
${options.body.slice(0, 1200)}

Does this post teach something specific about the subject (not a field overview)?
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