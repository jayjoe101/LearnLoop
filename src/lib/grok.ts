import { isDuplicateContent, normalizeTitleKey } from "@/lib/dedup";
import { pickRandomPersona, type Persona } from "@/lib/personas";
import {
  enrichBodyWithWikiTerms,
  finalizePostLinks,
  normalizeWikiTerms,
} from "@/lib/post-content";
import type { FeedStyle, PostLink, PostWikiTerm } from "@/lib/types";

const XAI_API_URL = "https://api.x.ai/v1/chat/completions";
const XAI_TIMEOUT_MS = 8_000;

const MODELS = [
  process.env.XAI_MODEL,
  "grok-4-fast-non-reasoning",
  "grok-3-mini-fast",
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
      description: "Short topic label from the user's interests",
    },
    title: {
      type: "string",
      description:
        "Scroll-stopping headline under 90 characters. Clickbait-curious about the ACTUAL topic — curiosity gap or bold claim. Honest, not misleading.",
    },
    body: {
      type: "string",
      description:
        "2-4 short paragraphs separated by blank lines (\\n\\n). Concrete fact or mechanism. Wrap technical terms in [[double brackets]].",
    },
    links: {
      type: "array",
      description:
        "1-3 real external sources. Prefer en.wikipedia.org/wiki/... for the core subject plus news or papers when relevant.",
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
      description: "1-4 domain terms appearing as [[term]] in the body.",
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
  recentFingerprints?: string[];
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

function isTooSimilar(title: string, recentTitles: string[]): boolean {
  const normalized = normalizeTitleKey(title);
  if (!normalized) return true;

  return recentTitles.some((recent) => {
    const r = normalizeTitleKey(recent);
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
    ? input.recentTitles.slice(0, 6).map((t) => `- ${t}`).join("\n")
    : "None yet.";
  const dupHint = input.recentFingerprints?.length
    ? "Do NOT reuse the same insight, facts, or wording as any recent post — must be a genuinely different angle."
    : "";

  const task =
    input.prompt?.trim() ||
    `Write one original insight post focused on "${focus}". Surprise the reader with something specific they probably didn't know.`;

  const technicalHint =
    input.style === "Deep technical" ||
    ["researcher", "engineer", "explorer", "skeptic"].includes(persona.id)
      ? "Technical post: 2-4 [[wiki-linked]] terms, precise mechanisms."
      : "Include [[wiki-linked]] terms where helpful.";

  const retryHint =
    attempt > 0
      ? "RETRY: completely different topic angle, title, and body — zero overlap with prior attempt."
      : "";

  return [
    {
      role: "system" as const,
      content: `${persona.name} (${persona.role}) on InsightScroll as ${persona.handle}. ${persona.voice}
Tone: ${STYLE_GUIDE[input.style]}. Teach something specific — no generic fluff.
Title: premium clickbait about the real topic — make readers NEED to click.
${technicalHint} Include 1-3 real links (Wikipedia for core subject). ${dupHint} ${retryHint}`.trim(),
    },
    {
      role: "user" as const,
      content: `Interests: ${interests}
Focus: ${focus}
Avoid these titles (and do not rewrite the same post with different wording):
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
      max_tokens: 300,
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

function parseGeneratedContent(
  content: string,
  input: GeneratePostInput
): Omit<GeneratedPost, "persona"> | null {
  let parsed: Partial<GeneratedPost>;
  try {
    parsed = JSON.parse(content) as Partial<GeneratedPost>;
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
  if (
    isDuplicateContent(title, body, input.recentFingerprints ?? [])
  ) {
    return null;
  }

  const wiki_terms = normalizeWikiTerms(
    parsed.wiki_terms as Array<{ term?: string }> | undefined
  );
  const links = finalizePostLinks(
    parsed.links as Array<{ label?: string; url?: string }> | undefined,
    topic,
    wiki_terms
  );

  return {
    topic,
    title,
    body: enrichBodyWithWikiTerms(body, wiki_terms),
    links,
    wiki_terms,
  };
}

async function callXaiOnce(
  apiKey: string,
  input: GeneratePostInput,
  persona: Persona,
  attempt: number
): Promise<GeneratedPost | null> {
  const temperature = 0.75 + attempt * 0.1;
  const messages = buildMessages(input, persona, attempt);

  for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i];
    let response: Response;

    try {
      response = await requestPost(apiKey, model, messages, temperature);
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
    if (!content) return null;

    const result = parseGeneratedContent(content, input);
    if (!result) return null;

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
  const persona = pickRandomPersona();

  if (apiKey) {
    const result = await callXaiOnce(apiKey, input, persona, attempt);
    if (result) return result;
  }

  const fallback = buildFallbackPost(input, recentTitles, persona);
  if (isDuplicateContent(fallback.title, fallback.body, recentFingerprints)) {
    return buildFallbackPost(
      { ...input, focusTopic: `${input.focusTopic ?? "insight"}-${attempt + 1}` },
      [...recentTitles, fallback.title],
      pickRandomPersona()
    );
  }
  return fallback;
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

  const hooks = [
    `Your brain on ${focus} is not what you think`,
    `The ${focus} trick experts quietly use`,
    `Why ${focus} breaks every rule you learned`,
    `${focus}: the part nobody talks about`,
    `This ${focus} fact changes the whole game`,
  ];
  let title = hooks[Math.floor(Math.random() * hooks.length)];
  let tries = 0;
  while (isTooSimilar(title, recentTitles) && tries < 8) {
    title = `${focus} just got weird (${stamp}-${tries + 1})`;
    tries++;
  }

  const wikiTerm = focus.split(" ")[0] ?? focus;
  const wiki_terms = [{ term: wikiTerm }];

  return {
    topic: focus,
    title,
    body: `Researchers and practitioners in [[${wikiTerm}]] keep running into the same blind spot: we assume the obvious explanation is complete.\n\n${angle.charAt(0).toUpperCase() + angle.slice(1)} offers a sharper lens — and it changes what you'd predict next. Worth sitting with for a minute before you scroll on.`,
    links: finalizePostLinks([], focus, wiki_terms),
    wiki_terms,
    persona,
  };
}