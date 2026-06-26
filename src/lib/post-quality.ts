import { isMetaTopicPost } from "@/lib/topic-subjects";
import { isPlaceholderSubject } from "@/lib/wiki-fetch";
import {
  bodyAnswersSubject,
  isCoherentTeachingBody,
  teachesSpecificTakeaway,
} from "@/lib/teaching-validate";
import { chatCompletion, FAST_MODEL, parseJsonContent } from "@/lib/xai-client";
import type { PostWikiTerm } from "@/lib/types";

export type QualityVerdict = {
  pass: boolean;
  issues: string[];
};

const VAGUE_PHRASES = [
  "sounds simple until",
  "hand-waves",
  "hand-wavy",
  "feels fuzzy",
  "worth knowing",
  "interesting bit",
  "reputation problem",
  "textbooks rush past",
  "stop right before it gets good",
  "shows up in more places than you'd expect",
  "one of those ideas that",
  "the naive story",
  "wilder than it sounds",
  "without the fluff",
  "nobody tells you",
  "here's the thing",
  "most people don't know",
  "most people overlook",
  "you won't believe",
  "mind-blowing",
  "game-changer",
  "how they connect",
  "forms the chain step by step",
  "forces the shift because",
  "is the variable that makes the difference",
  "sets the constraint",
  "determines what happens next",
  "frames the answer to",
  "is the concept that makes this precise",
  "becomes predictable",
  "stops being abstract",
  "lesser-known example within",
];

const TAUTOLOGY_PATTERNS = [
  /\bthe reason:\s*\*[^*]+\*\s*forces the shift\b/i,
  /\*\w+\*\s*and\s*\*\w+\*\s*form the chain\b/i,
  /\*\w+\*\s*directly causes\s*\*\w+\*\b/i,
  /\bremember:\s*==the trigger is\b/i,
  /\band\s+\w+\s+and\s+\w+:\s*how they connect\b/i,
];

const TEACHING_SIGNALS =
  /\b(because|means|works by|happens when|causes|results in|defined as|discovered|invented|measured|found|observed|published|introduced|developed|demonstrated|produces|reduces|increases|prevents|allows|requires|contains|located|formed|composed|consists|calculated|estimated|approximately|mechanism|involved|repair|binding|break|mediates|mediated|conversion|insertion|deletion|retransmit|timeout|threshold|congestion|window|without|million|billion|percent|°|km|kg|year)\b|\d/i;

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 3);
}

function isTautologicalBody(body: string, subject: string): boolean {
  if (TAUTOLOGY_PATTERNS.some((p) => p.test(body))) return true;

  const bodyWords = new Set(normalizeWords(body));
  const subjectWords = normalizeWords(subject);
  if (subjectWords.length < 2) return false;

  const overlap = subjectWords.filter((w) => bodyWords.has(w)).length;
  const ratio = overlap / subjectWords.length;

  const sentences = body
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  const novelSentences = sentences.filter((sentence) => {
    const sentenceWords = normalizeWords(sentence);
    const sentenceOverlap = subjectWords.filter((w) =>
      sentenceWords.includes(w)
    ).length;
    return sentenceOverlap / Math.max(subjectWords.length, 1) < 0.85;
  });

  return ratio > 0.9 && novelSentences.length < 1;
}

type LocalCheck = (title: string, body: string, subject: string) => string | null;

const LOCAL_CHECKS: LocalCheck[] = [
  (_title, body) => (body.length < 120 ? "Body is too short" : null),
  (title) => (title.length < 12 ? "Title is too short" : null),
  (_title, body) =>
    !/\[\[[^\]]+\]\]/.test(body) ? "Missing [[wiki-linked]] terms" : null,
  (_title, body) =>
    !/\*\*[^*]+\*\*|==[^=]+==/.test(body)
      ? "Missing markdown emphasis (**bold** or ==highlight==)"
      : null,
  (title, body) => {
    const combined = `${title} ${body}`.toLowerCase();
    const hits = VAGUE_PHRASES.filter((p) => combined.includes(p));
    return hits.length > 0
      ? `Vague or templated phrasing: ${hits.slice(0, 2).join(", ")}`
      : null;
  },
  (_title, body) =>
    !TEACHING_SIGNALS.test(body)
      ? "Body lacks a clear teaching signal — include facts, mechanisms, or measurable detail"
      : null,
  (title) => {
    const vagueTitle =
      /^(why .+ is (wild|weird|interesting|fascinating)|you won't believe|nobody tells you|the truth about)/i.test(
        title
      ) || /\bhow they connect\b/i.test(title);
    return vagueTitle
      ? "Title is vague teasing — state what the reader will learn"
      : null;
  },
  (_title, body, subject) =>
    isTautologicalBody(body, subject)
      ? "Body only restates the subject — teach a specific fact or mechanism"
      : null,
  (_title, body, subject) =>
    !isCoherentTeachingBody(body, subject)
      ? "Body is incoherent — fragments, repeated takeaway, or incomplete sentences"
      : null,
  (_title, body, subject) =>
    !teachesSpecificTakeaway(subject, body)
      ? "Body does not teach a specific takeaway — highlight or mechanism is too generic or off-topic"
      : null,
  (_title, body, subject) =>
    !bodyAnswersSubject(subject, body)
      ? "Body does not answer the specific subject — missing causal mechanism or too generic"
      : null,
];

export function runLocalQualityChecks(
  title: string,
  body: string,
  topic: string,
  wikiTerms: PostWikiTerm[],
  subject?: string
): QualityVerdict {
  const issues: string[] = [];
  const resolvedSubject = subject ?? title;

  for (const check of LOCAL_CHECKS) {
    const issue = check(title, body, resolvedSubject);
    if (issue) issues.push(issue);
  }

  if (subject && isPlaceholderSubject(subject, topic)) {
    issues.push("Subject is a meta placeholder, not a teachable topic");
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
          "You are a strict feed quality reviewer. Reject meta overviews, vague fluff, template phrasing, and posts that do not teach a specific new fact. Approve only posts that bluntly inform: name the mechanism, explain simply, and leave the reader with one concrete takeaway.",
      },
      {
        role: "user",
        content: `Interest area: ${options.topic}
Required specific subject: ${options.subject}

Title: ${options.title}

Body:
${options.body.slice(0, 1200)}

Checklist:
1. Does the body directly explain the REQUIRED SUBJECT (not a broader parent topic)?
2. Does it teach ONE specific new thing with a clear mechanism/cause/takeaway?
3. Is the wording bluntly informative — not vague teasing or generic overview?
4. Would a reader learn something specific to the subject title?

Return JSON: { "pass": true/false, "issues": ["..."] }`,
      },
    ],
  });

  if (!content) {
    return { pass: false, issues: ["Model quality review unavailable or failed"] };
  }

  const parsed = parseJsonContent<{ pass?: boolean; issues?: string[] }>(content);
  if (!parsed || typeof parsed.pass !== "boolean") {
    return { pass: false, issues: ["Model quality review returned invalid response"] };
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
  /** Primary LLM path: strict local checks only — skips extra model review round-trip. */
  skipModelReview?: boolean;
}): Promise<QualityVerdict> {
  const local = runLocalQualityChecks(
    options.title,
    options.body,
    options.topic,
    options.wikiTerms,
    options.subject
  );

  if (!local.pass) return local;

  if (!process.env.XAI_API_KEY || options.skipModelReview) {
    return local;
  }

  const model = await validatePostWithModel(options);
  if (!model.pass) return model;

  return { pass: true, issues: [] };
}