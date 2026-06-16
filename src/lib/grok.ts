import type { FeedStyle } from "@/lib/types";
import { GENERATION_TEMPLATES } from "@/lib/types";

const XAI_API_URL = "https://api.x.ai/v1/chat/completions";
const XAI_TIMEOUT_MS = 6_000;
/** Non-reasoning fast path — override via XAI_MODEL on Vercel */
const DEFAULT_MODEL = "grok-4-fast-non-reasoning";

const STYLE_SHORT: Record<FeedStyle, string> = {
  "Balanced & insightful": "balanced",
  "Deep technical": "technical",
  "Fun + surprising": "playful",
  "Actionable life upgrade": "practical",
};

const POST_SCHEMA = {
  type: "object",
  properties: {
    topic: { type: "string" },
    title: { type: "string" },
    body: { type: "string" },
  },
  required: ["topic", "title", "body"],
  additionalProperties: false,
} as const;

type GeneratePostInput = {
  prompt?: string;
  topics: string[];
  style: FeedStyle;
};

export type GeneratedPost = {
  topic: string;
  title: string;
  body: string;
};

function pickTemplate(topics: string[]): GeneratedPost {
  const topicSet = new Set(topics.map((t) => t.toLowerCase()));
  const matched = GENERATION_TEMPLATES.filter((t) =>
    [...topicSet].some(
      (userTopic) =>
        userTopic.includes(t.topic.toLowerCase()) ||
        t.topic.toLowerCase().includes(userTopic.split(" ")[0] ?? "")
    )
  );

  const pool = matched.length > 0 ? matched : GENERATION_TEMPLATES;
  const template = pool[Math.floor(Math.random() * pool.length)];

  return {
    topic: template.topic,
    title: template.title,
    body: template.body,
  };
}

function buildPrompt(input: GeneratePostInput): string {
  const tone = STYLE_SHORT[input.style];
  const interests =
    input.topics.length > 0 ? input.topics.slice(0, 5).join(", ") : "general";
  const task = input.prompt?.trim() || "Write one insightful post.";

  return `Tone:${tone}. Topics:${interests}. ${task}`;
}

async function requestPost(
  apiKey: string,
  model: string,
  prompt: string
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
      messages: [{ role: "user", content: prompt }],
      temperature: 0.55,
      max_tokens: 110,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "post",
          schema: POST_SCHEMA,
          strict: true,
        },
      },
    }),
  });
}

async function callXai(
  apiKey: string,
  prompt: string
): Promise<GeneratedPost | null> {
  const models = [
    process.env.XAI_MODEL ?? DEFAULT_MODEL,
    "grok-3-mini-fast",
  ].filter((m, i, a) => a.indexOf(m) === i);

  let response: Response | null = null;
  for (const model of models) {
    const attempt = await requestPost(apiKey, model, prompt);
    if (attempt.ok) {
      response = attempt;
      break;
    }
    if (attempt.status !== 400 && attempt.status !== 404) break;
  }

  if (!response?.ok) return null;

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content as string | undefined;
  if (!content) return null;

  let parsed: Partial<GeneratedPost>;
  try {
    parsed = JSON.parse(content) as Partial<GeneratedPost>;
  } catch {
    return null;
  }

  if (!parsed.title?.trim() || !parsed.body?.trim()) return null;

  return {
    topic: parsed.topic?.trim() || "Insight",
    title: parsed.title.trim(),
    body: parsed.body.trim(),
  };
}

export async function generatePost(
  input: GeneratePostInput
): Promise<GeneratedPost> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return pickTemplate(input.topics);

  try {
    const result = await callXai(apiKey, buildPrompt(input));
    if (result) return result;
  } catch {
    // template fallback
  }

  return pickTemplate(input.topics);
}