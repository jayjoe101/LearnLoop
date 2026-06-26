import { chatCompletion, FAST_MODEL, parseJsonContent } from "@/lib/xai-client";
import {
  discoverWikipediaSubject,
  isPlaceholderSubject,
} from "@/lib/wiki-fetch";

const DISCOVERY_ATTEMPTS = 3;

const ANGLE_HINTS = [
  "a counterintuitive mechanism most people misunderstand",
  "a specific historical episode or person",
  "a named paradox, puzzle, or edge case",
  "a concrete technique or tool practitioners actually use",
  "a surprising connection between two ideas in the field",
  "a failure mode or limitation experts know about",
  "a measurement, experiment, or result that changed assumptions",
  "an underappreciated application in the real world",
];

function normalizeSubject(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function isSubjectTooSimilar(subject: string, avoid: Set<string>): boolean {
  const key = normalizeSubject(subject);
  if (!key || key.length < 8) return true;

  for (const existing of avoid) {
    if (key === existing) return true;
    if (key.includes(existing) || existing.includes(key)) return true;

    const a = new Set(key.split(" ").filter((w) => w.length > 3));
    const b = new Set(existing.split(" ").filter((w) => w.length > 3));
    let overlap = 0;
    for (const w of a) {
      if (b.has(w)) overlap++;
    }
    if (overlap >= 3) return true;
  }

  return false;
}

function buildAvoidList(items: string[], emptyLabel: string): string {
  if (items.length === 0) return emptyLabel;
  return items
    .slice(0, 14)
    .map((item) => `- ${item}`)
    .join("\n");
}

function pickAngleHint(seed: number): string {
  return ANGLE_HINTS[Math.abs(seed) % ANGLE_HINTS.length];
}

async function discoverSingleSubject(
  topic: string,
  options: {
    recentTitles: string[];
    avoidSubjects: string[];
    seed: number;
    attempt: number;
  }
): Promise<string | null> {
  const avoid = new Set<string>();
  for (const item of [...options.recentTitles, ...options.avoidSubjects]) {
    const key = normalizeSubject(item);
    if (key) avoid.add(key);
  }

  const avoidTitles = buildAvoidList(options.recentTitles, "None yet.");
  const avoidSubjects = buildAvoidList(options.avoidSubjects, "None yet.");
  const angle = pickAngleHint(options.seed + options.attempt * 7);

  const content = await chatCompletion({
    model: FAST_MODEL,
    temperature: 0.92 + options.attempt * 0.04,
    maxTokens: 180,
    timeoutMs: 9_000,
    jsonSchema: {
      name: "post_subject",
      schema: {
        type: "object",
        properties: {
          subject: {
            type: "string",
            description:
              "One specific teachable subject inside the interest area — not the area label itself.",
          },
        },
        required: ["subject"],
        additionalProperties: false,
      },
    },
    messages: [
      {
        role: "system",
        content: `You pick ONE post subject for a learning feed.

The user provides an interest AREA — a meta label (like "Physics" or "Cooking") that describes what shelf of knowledge they care about.
The post subject must be a SPECIFIC thing inside that area — never the area label, never an overview of the field.

Good subjects: named mechanisms, discoveries, people, experiments, paradoxes, techniques, artifacts, episodes.
Bad subjects: "introduction to X", "basics of X", "what is X", "overview of X", or repeating the area name.`,
      },
      {
        role: "user",
        content: `Interest AREA (meta label — do NOT write about this directly): "${topic}"

Pick ONE fresh, specific post subject inside this area.
Angle to explore: ${angle}
Surprise the reader — prefer lesser-known specifics over clichés.

Do NOT overlap these recent post titles:
${avoidTitles}

Do NOT overlap these recent subjects or concepts:
${avoidSubjects}

Return JSON: { "subject": "..." }`,
      },
    ],
  });

  if (!content) return null;

  const parsed = parseJsonContent<{ subject?: string }>(content);
  const subject = parsed?.subject?.trim() ?? "";
  if (subject.length < 12 || subject.length > 220) return null;
  if (isSubjectTooSimilar(subject, avoid)) return null;

  const lower = subject.toLowerCase();
  const topicLower = topic.toLowerCase();
  if (
    lower === topicLower ||
    lower.startsWith(`introduction to ${topicLower}`) ||
    lower.startsWith(`overview of ${topicLower}`) ||
    lower.startsWith(`basics of ${topicLower}`) ||
    lower.startsWith(`what is ${topicLower}`)
  ) {
    return null;
  }

  return subject;
}

/**
 * AI-picked concrete post subject — fresh every call, no hardcoded pools or cache.
 */
export async function discoverConcreteSubject(options: {
  topic: string;
  subjectIndex?: number;
  recentTitles?: string[];
  usedSubjects?: string[];
  avoidSubjects?: string[];
}): Promise<string | null> {
  const topic = options.topic.trim() || "general knowledge";
  const seed = options.subjectIndex ?? Date.now();
  const recentTitles = options.recentTitles ?? [];
  const avoidSubjects = [
    ...(options.avoidSubjects ?? []),
    ...(options.usedSubjects ?? []),
  ];

  const parallelSubjects = await Promise.all(
    Array.from({ length: DISCOVERY_ATTEMPTS }, (_, attempt) =>
      discoverSingleSubject(topic, {
        recentTitles,
        avoidSubjects,
        seed,
        attempt,
      })
    )
  );
  const discovered = parallelSubjects.find(
    (subject) => subject && !isPlaceholderSubject(subject, topic)
  );
  if (discovered) return discovered;

  const lastChance = await discoverSingleSubject(topic, {
    recentTitles,
    avoidSubjects: [...avoidSubjects, ...recentTitles],
    seed: seed + 99,
    attempt: DISCOVERY_ATTEMPTS,
  });
  if (lastChance && !isPlaceholderSubject(lastChance, topic)) return lastChance;

  const wikiAvoid = [...avoidSubjects, ...recentTitles];
  const wikiResults = await Promise.all(
    Array.from({ length: 4 }, (_, wikiTry) =>
      discoverWikipediaSubject(topic, seed + wikiTry * 13, wikiAvoid)
    )
  );
  const wikiSubject = wikiResults.find(
    (candidate) => candidate && !isPlaceholderSubject(candidate, topic)
  );
  if (wikiSubject) return wikiSubject;

  const emergency = await discoverWikipediaSubject(
    topic,
    seed + Date.now() % 997,
    wikiAvoid
  );
  if (emergency && !isPlaceholderSubject(emergency, topic)) return emergency;

  return null;
}