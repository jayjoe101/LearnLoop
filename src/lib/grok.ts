import {
  isBoilerplatePost,
  isDuplicateContent,
  isTooSimilar,
} from "@/lib/dedup";
import { buildVariedFallbackPost } from "@/lib/fallback-post";
import { pickRandomPersona, type Persona } from "@/lib/personas";
import {
  isMetaTopicPost,
  pickConcreteSubject,
} from "@/lib/topic-subjects";
import {
  enrichBodyWithWikiTerms,
  finalizePostLinks,
  normalizeWikiTerms,
} from "@/lib/post-content";
import type { FeedStyle, PostLink, PostWikiTerm } from "@/lib/types";

const XAI_API_URL = "https://api.x.ai/v1/chat/completions";
const XAI_TIMEOUT_MS = 12_000;
const AI_TRIES_BEFORE_FALLBACK = 3;

const MODELS = [
  process.env.XAI_MODEL,
  "grok-4-fast-non-reasoning",
  "grok-3-mini-fast",
  "grok-3-mini",
].filter((m, i, a): m is string => Boolean(m) && a.indexOf(m) === i);

const STYLE_GUIDE: Record<FeedStyle, string> = {
  "Balanced & insightful": "Clear, curious, substantive.",
  "Deep technical": "Explain mechanisms precisely but readably.",
  "Fun + surprising": "Counterintuitive hook, then insight.",
  "Actionable life upgrade": "One concrete takeaway the reader can try today.",
};

const POST_SCHEMA = {
  type: "object",
  properties: {
    topic: {
      type: "string",
      description:
        "The user's interest-area label (e.g. Physics) — NOT the post subject itself.",
    },
    subject: {
      type: "string",
      description:
        "The specific concept, mechanism, discovery, or story INSIDE the interest area.",
    },
    title: {
      type: "string",
      description:
        "Scroll-stopping headline under 90 characters about the SPECIFIC SUBJECT.",
    },
    body: {
      type: "string",
      description:
        "2-4 short paragraphs about the specific subject. Wrap technical terms in [[double brackets]].",
    },
    links: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          url: { type: "string" },
        },
        required: ["label", "url"],
        additionalProperties: false,
      },
      minItems: 1,
      maxItems: 3,
    },
    wiki_terms: {
      type: "array",
      items: {
        type: "object",
        properties: {
          term: { type: "string" },
        },
        required: ["term"],
        additionalProperties: false,
      },
      maxItems: 4,
    },
  },
  required: ["topic", "subject", "title", "body", "links", "wiki_terms"],
  additionalProperties: false,
} as const;

export type GeneratePostInput = {
  prompt?: string;
  topics: string[];
  style: FeedStyle;
  recentTitles?: string[];
  recentFingerprints?: string[];
  focusTopic?: string;
  concreteSubject?: string;
  subjectIndex?: number;
};

export type GeneratedPost = {
  topic: string;
  title: string;
  body: string;
  links: PostLink[];
  wiki_terms: PostWikiTerm[];
  persona: Persona;
};

function pickFocusTopic(topics: string[], explicit?: string): string {
  if (explicit) return explicit;
  if (topics.length === 0) return "general knowledge";
  return topics[Math.floor(Math.random() * topics.length)];
}

function buildMessages(
  input: GeneratePostInput,
  persona: Persona,
  attempt: number
) {
  const focus = pickFocusTopic(input.topics, input.focusTopic);
  const subject =
    input.concreteSubject ??
    pickConcreteSubject(focus, input.subjectIndex ?? attempt);
  const interests =
    input.topics.length > 0 ? input.topics.join(", ") : "broad curiosity";
  const avoid = input.recentTitles?.length
    ? input.recentTitles.slice(0, 6).map((t) => `- ${t}`).join("\n")
    : "None yet.";
  const dupHint = input.recentFingerprints?.length
    ? "Do NOT reuse the same insight, facts, or wording as any recent post."
    : "";

  const scopeRule = `SCOPE RULE: "${focus}" is an interest AREA filter only. Write about this SPECIFIC subject: "${subject}". Do NOT write about "${focus}" as a field or overview.`;

  const task =
    input.prompt?.trim() ||
    `Write one original insight post about: ${subject} (within "${focus}"). Surprise the reader with something specific.`;

  const technicalHint =
    input.style === "Deep technical" ||
    ["researcher", "engineer", "explorer", "skeptic"].includes(persona.id)
      ? "Technical: 2-4 [[wiki-linked]] terms, precise mechanisms."
      : "Include [[wiki-linked]] terms where helpful.";

  const retryHint =
    attempt > 0
      ? "RETRY: completely different angle, title, and body."
      : "";

  return [
    {
      role: "system" as const,
      content: `${persona.name} (${persona.role}) on InsightScroll as ${persona.handle}. ${persona.voice}
Tone: ${STYLE_GUIDE[input.style]}. Teach something specific.
${scopeRule}
Title: clickbait about the SPECIFIC SUBJECT only.
${technicalHint} Include 1-3 real links (Wikipedia for core concept). ${dupHint} ${retryHint}`.trim(),
    },
    {
      role: "user" as const,
      content: `Interest areas: ${interests}
Interest tag: ${focus}
Specific subject: ${subject}

Avoid these titles:
${avoid}

${task}`,
    },
  ];
}

async function requestPost(
  apiKey: string,
  model: string,
  messages: ReturnType<typeof buildMessages>,
  temperature: number,
  strict: boolean
): Promise<Response> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens: strict ? 320 : 400,
  };

  if (strict) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: "insight_post",
        schema: POST_SCHEMA,
        strict: true,
      },
    };
  }

  return fetch(XAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(XAI_TIMEOUT_MS),
    body: JSON.stringify(body),
  });
}

function parseGeneratedContent(
  content: string,
  input: GeneratePostInput
): Omit<GeneratedPost, "persona"> | null {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const jsonText = jsonMatch?.[0] ?? content;

  let parsed: Partial<GeneratedPost & { subject?: string }>;
  try {
    parsed = JSON.parse(jsonText) as Partial<GeneratedPost & { subject?: string }>;
  } catch {
    return null;
  }

  if (!parsed.title?.trim() || !parsed.body?.trim()) return null;

  const title = parsed.title.trim();
  const body = parsed.body.trim();
  const topic =
    parsed.topic?.trim() || pickFocusTopic(input.topics, input.focusTopic);

  if (body.length < 80) return null;
  if (isTooSimilar(title, input.recentTitles ?? [])) return null;
  if (isDuplicateContent(title, body, input.recentFingerprints ?? [])) {
    return null;
  }
  if (isBoilerplatePost(title, body)) return null;

  const wiki_terms = normalizeWikiTerms(
    parsed.wiki_terms as Array<{ term?: string }> | undefined
  );
  const links = finalizePostLinks(
    parsed.links as Array<{ label?: string; url?: string }> | undefined,
    parsed.subject?.trim() || wiki_terms[0]?.term || topic,
    wiki_terms
  );

  if (isMetaTopicPost(title, body, topic, wiki_terms)) return null;

  return {
    topic,
    title,
    body: enrichBodyWithWikiTerms(body, wiki_terms),
    links,
    wiki_terms,
  };
}

async function callXai(
  apiKey: string,
  input: GeneratePostInput,
  persona: Persona,
  attempt: number,
  strict: boolean
): Promise<GeneratedPost | null> {
  const temperature = 0.75 + attempt * 0.08;
  const baseMessages = buildMessages(input, persona, attempt);
  const messages = strict
    ? baseMessages
    : [
        ...baseMessages,
        {
          role: "user" as const,
          content:
            "Return ONLY valid JSON with keys: topic, subject, title, body, links [{label,url}], wiki_terms [{term}].",
        },
      ];

  for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i];
    let response: Response;

    try {
      response = await requestPost(
        apiKey,
        model,
        messages,
        temperature,
        strict
      );
    } catch {
      if (i < MODELS.length - 1) continue;
      return null;
    }

    if (!response.ok) {
      if (response.status === 400 || response.status === 404) continue;
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content as string | undefined;
    if (!content) continue;

    const result = parseGeneratedContent(content, input);
    if (!result) continue;

    return { ...result, persona };
  }

  return null;
}

export async function generatePost(
  input: GeneratePostInput,
  attempt = 0
): Promise<GeneratedPost> {
  const apiKey = process.env.XAI_API_KEY;
  const recentTitles = input.recentTitles ?? [];
  const recentFingerprints = input.recentFingerprints ?? [];
  const variant = (input.subjectIndex ?? 0) + attempt;

  if (apiKey) {
    for (let aiTry = 0; aiTry < AI_TRIES_BEFORE_FALLBACK; aiTry++) {
      const persona = pickRandomPersona();
      const tryAttempt = attempt + aiTry;

      const strict = await callXai(apiKey, input, persona, tryAttempt, true);
      if (strict && !isBoilerplatePost(strict.title, strict.body)) {
        return strict;
      }

      if (aiTry === AI_TRIES_BEFORE_FALLBACK - 1) {
        const relaxed = await callXai(
          apiKey,
          input,
          pickRandomPersona(),
          tryAttempt,
          false
        );
        if (relaxed && !isBoilerplatePost(relaxed.title, relaxed.body)) {
          return relaxed;
        }
      }
    }
  }

  for (let fb = 0; fb < 4; fb++) {
    const fallback = buildVariedFallbackPost(
      {
        topics: input.topics,
        focusTopic: input.focusTopic,
        concreteSubject: input.concreteSubject,
        subjectIndex: input.subjectIndex,
        recentTitles,
      },
      pickRandomPersona(),
      variant + fb
    );

    if (isBoilerplatePost(fallback.title, fallback.body)) continue;
    if (isDuplicateContent(fallback.title, fallback.body, recentFingerprints)) {
      continue;
    }
    if (isTooSimilar(fallback.title, recentTitles)) continue;

    return fallback;
  }

  return buildVariedFallbackPost(
    {
      topics: input.topics,
      focusTopic: input.focusTopic,
      concreteSubject: input.concreteSubject,
      subjectIndex: (input.subjectIndex ?? 0) + variant,
      recentTitles,
    },
    pickRandomPersona(),
    variant + Date.now() % 6
  );
}