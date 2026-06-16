import { pickRandomPersona, type Persona } from "@/lib/personas";
import {
  enrichBodyWithWikiTerms,
  normalizePostLinks,
  normalizeWikiTerms,
} from "@/lib/post-content";
import type { FeedStyle, PostLink, PostWikiTerm } from "@/lib/types";

const XAI_API_URL = "https://api.x.ai/v1/chat/completions";
const XAI_TIMEOUT_MS = 12_000;
const MAX_ATTEMPTS = 3;

const MODELS = [
  process.env.XAI_MODEL,
  "grok-3-mini",
  "grok-3-mini-fast",
  "grok-4-fast-non-reasoning",
].filter((m, i, a): m is string => Boolean(m) && a.indexOf(m) === i);

const STYLE_GUIDE: Record<FeedStyle, string> = {
  "Balanced & insightful":
    "Clear, curious, and substantive — like a sharp friend explaining something fascinating.",
  "Deep technical":
    "Explain the mechanism. Use precise language but stay readable. Name the system.",
  "Fun + surprising":
    "Lead with something unexpected. Counterintuitive hook, then the insight.",
  "Actionable life upgrade":
    "One concrete habit or mental model the reader can try today. No fluff.",
};

const POST_SCHEMA = {
  type: "object",
  properties: {
    topic: {
      type: "string",
      description: "Short topic label from the user's interests",
    },
    title: {
      type: "string",
      description:
        "Unique, specific headline under 90 characters. Never generic or clickbait.",
    },
    body: {
      type: "string",
      description:
        "2-4 short paragraphs separated by blank lines (\\n\\n). Include a concrete fact, example, or mechanism. Wrap technical terms in [[double brackets]] for wiki highlights.",
    },
    links: {
      type: "array",
      description:
        "1-3 real, reputable external sources (news, papers, docs, .edu, .gov). Full https URLs only.",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "Short source name" },
          url: { type: "string", description: "Full https URL" },
        },
        required: ["label", "url"],
        additionalProperties: false,
      },
      minItems: 1,
      maxItems: 3,
    },
    wiki_terms: {
      type: "array",
      description:
        "2-4 technical or domain-specific terms that appear in the body as [[term]] wiki highlights. Required for technical topics.",
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
  required: ["topic", "title", "body", "links", "wiki_terms"],
  additionalProperties: false,
} as const;

export type GeneratePostInput = {
  prompt?: string;
  topics: string[];
  style: FeedStyle;
  recentTitles?: string[];
  focusTopic?: string;
};

export type GeneratedPost = {
  topic: string;
  title: string;
  body: string;
  links: PostLink[];
  wiki_terms: PostWikiTerm[];
  persona: Persona;
};

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isTooSimilar(title: string, recentTitles: string[]): boolean {
  const normalized = normalizeTitle(title);
  if (!normalized) return true;

  return recentTitles.some((recent) => {
    const r = normalizeTitle(recent);
    if (!r) return false;
    if (r === normalized) return true;
    if (r.includes(normalized) || normalized.includes(r)) return true;
    const a = new Set(normalized.split(" "));
    const b = new Set(r.split(" "));
    let overlap = 0;
    for (const w of a) {
      if (w.length > 3 && b.has(w)) overlap++;
    }
    return overlap >= 4;
  });
}

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
  const interests =
    input.topics.length > 0 ? input.topics.join(", ") : "broad curiosity";
  const avoid = input.recentTitles?.length
    ? input.recentTitles.slice(0, 15).map((t) => `- ${t}`).join("\n")
    : "None yet.";

  const task =
    input.prompt?.trim() ||
    `Write one original insight post focused on "${focus}". Surprise the reader with something specific they probably didn't know.`;

  const varietyHint =
    attempt > 0
      ? `This is retry #${attempt + 1}. Pick a completely different angle and topic than before.`
      : "";

  const technicalHint =
    input.style === "Deep technical" ||
    ["researcher", "engineer", "deep-diver", "skeptic"].includes(persona.id)
      ? "This is a technical post: include 2-4 [[wiki-linked]] jargon terms and precise mechanisms."
      : "Include at least 1 [[wiki-linked]] term when a concept benefits from a quick definition.";

  return [
    {
      role: "system" as const,
      content: `You are ${persona.name} (${persona.role}) posting on InsightScroll as ${persona.handle}.
${persona.voice}
Feed tone setting: ${STYLE_GUIDE[input.style]}
Every post must teach something specific. Ban generic self-help and recycled ideas.
${technicalHint}
Always attach 1-3 real external links readers can follow. Use [[term]] markers in the body for wiki highlights. ${varietyHint}`.trim(),
    },
    {
      role: "user" as const,
      content: `Reader interests: ${interests}
Focus this post on: ${focus}

Do NOT repeat or closely paraphrase these existing post titles:
${avoid}

${task}`,
    },
  ];
}

async function requestPost(
  apiKey: string,
  model: string,
  messages: ReturnType<typeof buildMessages>,
  temperature: number
): Promise<Response> {
  return fetch(XAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(XAI_TIMEOUT_MS),
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: 320,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "insight_post",
          schema: POST_SCHEMA,
          strict: true,
        },
      },
    }),
  });
}

async function callXaiOnce(
  apiKey: string,
  input: GeneratePostInput,
  persona: Persona,
  attempt: number
): Promise<GeneratedPost | null> {
  const temperature = 0.78 + attempt * 0.08;
  const messages = buildMessages(input, persona, attempt);

  for (const model of MODELS) {
    const response = await requestPost(apiKey, model, messages, temperature);
    if (!response.ok) {
      if (response.status !== 400 && response.status !== 404) break;
      continue;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content as string | undefined;
    if (!content) continue;

    let parsed: Partial<GeneratedPost>;
    try {
      parsed = JSON.parse(content) as Partial<GeneratedPost>;
    } catch {
      continue;
    }

    if (!parsed.title?.trim() || !parsed.body?.trim()) continue;

    const title = parsed.title.trim();
    const body = parsed.body.trim();

    if (body.length < 80) continue;

    if (isTooSimilar(title, input.recentTitles ?? [])) continue;

    const links = normalizePostLinks(
      parsed.links as Array<{ label?: string; url?: string }> | undefined
    );
    const wiki_terms = normalizeWikiTerms(
      parsed.wiki_terms as Array<{ term?: string }> | undefined
    );

    if (links.length === 0) continue;

    const enrichedBody = enrichBodyWithWikiTerms(body, wiki_terms);

    return {
      topic: parsed.topic?.trim() || pickFocusTopic(input.topics, input.focusTopic),
      title,
      body: enrichedBody,
      links,
      wiki_terms,
      persona,
    };
  }

  return null;
}

export async function generatePost(
  input: GeneratePostInput
): Promise<GeneratedPost> {
  const apiKey = process.env.XAI_API_KEY;
  const recentTitles = input.recentTitles ?? [];
  const persona = pickRandomPersona();

  if (apiKey) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const result = await callXaiOnce(apiKey, input, persona, attempt);
        if (result) return result;
      } catch {
        // try next attempt
      }
    }
  }

  return buildFallbackPost(input, recentTitles, persona);
}

function buildFallbackPost(
  input: GeneratePostInput,
  recentTitles: string[],
  persona: Persona
): GeneratedPost {
  const focus = pickFocusTopic(input.topics, input.focusTopic);
  const angles = [
    "a counterintuitive study result",
    "a historical parallel that changes how you see the present",
    "a mechanism most people misunderstand",
    "a recent discovery that overturns conventional wisdom",
    "a practical framework used by experts in the field",
  ];
  const angle = angles[Math.floor(Math.random() * angles.length)];
  const stamp = Date.now().toString(36).slice(-4);

  let title = `What ${focus} reveals about ${angle}`;
  let tries = 0;
  while (isTooSimilar(title, recentTitles) && tries < 8) {
    title = `${focus}: insight ${stamp}-${tries + 1}`;
    tries++;
  }

  const wikiTerm = focus.split(" ")[0] ?? focus;

  return {
    topic: focus,
    title,
    body: `Researchers and practitioners in [[${wikiTerm}]] keep running into the same blind spot: we assume the obvious explanation is complete.\n\n${angle.charAt(0).toUpperCase() + angle.slice(1)} offers a sharper lens — and it changes what you'd predict next. Worth sitting with for a minute before you scroll on.`,
    links: [
      {
        label: `${focus} overview`,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTerm.replace(/\s+/g, "_"))}`,
      },
    ],
    wiki_terms: [{ term: wikiTerm }],
    persona,
  };
}