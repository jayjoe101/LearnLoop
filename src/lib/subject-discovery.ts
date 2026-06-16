import { chatCompletion, FAST_MODEL, parseJsonContent } from "@/lib/xai-client";

const CACHE_TTL_MS = 12 * 60 * 1000;
const SUBJECTS_PER_FETCH = 8;

type TopicCache = {
  subjects: string[];
  fetchedAt: number;
};

const topicCache = new Map<string, TopicCache>();

function cacheKey(topic: string): string {
  return topic.toLowerCase().replace(/\s+/g, " ").trim();
}

function genericFallback(topic: string, index: number): string {
  const hooks = [
    `a specific mechanism inside ${topic} that most explanations skip`,
    `one counterintuitive discovery from ${topic} with a named example`,
    `how a real system in ${topic} works step by step`,
    `a historical breakthrough that changed ${topic}`,
  ];
  return hooks[Math.abs(index) % hooks.length];
}

function pickUnusedSubject(
  subjects: string[],
  avoid: Set<string>,
  index: number
): string | null {
  for (let i = 0; i < subjects.length; i++) {
    const candidate = subjects[(index + i) % subjects.length];
    const key = candidate.toLowerCase();
    if (!avoid.has(key)) return candidate;
  }
  return null;
}

async function fetchSubjectsForTopic(
  topic: string,
  avoidTitles: string[]
): Promise<string[]> {
  const avoidList =
    avoidTitles.length > 0
      ? avoidTitles.slice(0, 8).map((t) => `- ${t}`).join("\n")
      : "None yet.";

  const content = await chatCompletion({
    model: FAST_MODEL,
    temperature: 0.85,
    maxTokens: 400,
    timeoutMs: 8_000,
    jsonSchema: {
      name: "topic_subjects",
      schema: {
        type: "object",
        properties: {
          subjects: {
            type: "array",
            items: { type: "string" },
            minItems: 5,
            maxItems: 8,
          },
        },
        required: ["subjects"],
        additionalProperties: false,
      },
    },
    messages: [
      {
        role: "system",
        content:
          "You suggest specific, fascinating post subjects inside a user's interest area. Never suggest broad overviews of the topic label itself.",
      },
      {
        role: "user",
        content: `Interest area: "${topic}"

What are ${SUBJECTS_PER_FETCH} interesting, specific subjects WITHIN this area?
Each subject must be concrete (a mechanism, discovery, person, paradox, or story) — not "introduction to ${topic}".

Avoid overlapping these recent post titles:
${avoidList}

Return JSON: { "subjects": ["...", ...] }`,
      },
    ],
  });

  if (!content) return [];

  const parsed = parseJsonContent<{ subjects?: string[] }>(content);
  return (parsed?.subjects ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 12 && s.length < 200);
}

export async function discoverConcreteSubject(options: {
  topic: string;
  subjectIndex?: number;
  recentTitles?: string[];
  usedSubjects?: string[];
}): Promise<string> {
  const topic = options.topic.trim() || "general knowledge";
  const key = cacheKey(topic);
  const index = options.subjectIndex ?? 0;
  const avoid = new Set<string>();

  for (const title of options.recentTitles ?? []) {
    avoid.add(title.toLowerCase());
  }
  for (const subject of options.usedSubjects ?? []) {
    avoid.add(subject.toLowerCase());
  }

  const cached = topicCache.get(key);
  const fresh =
    cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS
      ? cached.subjects
      : null;

  if (fresh?.length) {
    const picked = pickUnusedSubject(fresh, avoid, index);
    if (picked) return picked;
  }

  const fetched = await fetchSubjectsForTopic(topic, options.recentTitles ?? []);
  if (fetched.length > 0) {
    topicCache.set(key, { subjects: fetched, fetchedAt: Date.now() });
    const picked = pickUnusedSubject(fetched, avoid, index);
    if (picked) return picked;
  }

  return genericFallback(topic, index);
}

/** Pre-warm subject cache for the next post (fire-and-forget). */
export function prefetchSubjectsForTopic(topic: string, recentTitles: string[] = []) {
  const key = cacheKey(topic);
  const cached = topicCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return;

  void fetchSubjectsForTopic(topic, recentTitles).then((subjects) => {
    if (subjects.length > 0) {
      topicCache.set(key, { subjects, fetchedAt: Date.now() });
    }
  });
}