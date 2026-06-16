import { resolvePostImage } from "@/lib/images";
import type { FeedStyle } from "@/lib/types";
import { GENERATION_TEMPLATES } from "@/lib/types";

const XAI_API_URL = "https://api.x.ai/v1/chat/completions";
const XAI_TIMEOUT_MS = 8_000;
const DEFAULT_MODEL = "grok-3-mini-fast";

const POST_SCHEMA = {
  type: "object",
  properties: {
    topic: {
      type: "string",
      description: "Short topic label, 1-3 words",
    },
    title: {
      type: "string",
      description: "Punchy headline under 90 characters",
    },
    body: {
      type: "string",
      description: "2-3 sentences of insight, no markdown",
    },
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
  image_url: string | null;
};

async function pickTemplate(topics: string[]): Promise<GeneratedPost> {
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

  const post: GeneratedPost = {
    topic: template.topic,
    title: template.title,
    body: template.body,
    image_url: null,
  };

  post.image_url = await resolvePostImage(post.topic, post.title);
  return post;
}

function buildUserMessage(input: GeneratePostInput): string {
  const interests =
    input.topics.length > 0 ? input.topics.slice(0, 6).join(", ") : "general";

  if (input.prompt?.trim()) {
    return `Interests: ${interests}. Request: ${input.prompt.trim()}`;
  }

  return `Interests: ${interests}. Write one fresh insight post.`;
}

async function callXai(
  apiKey: string,
  style: FeedStyle,
  userMessage: string
): Promise<GeneratedPost | null> {
  const model = process.env.XAI_MODEL ?? DEFAULT_MODEL;

  const response = await fetch(XAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(XAI_TIMEOUT_MS),
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: `Insight feed writer. Tone: ${style}. Be specific and useful. Keep it brief.`,
        },
        { role: "user", content: userMessage },
      ],
      temperature: 0.65,
      max_tokens: 180,
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

  if (!response.ok) return null;

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

  const topic = parsed.topic?.trim() || "Insight";
  const title = parsed.title.trim();
  const body = parsed.body.trim();

  const image_url = await resolvePostImage(topic, title);

  return { topic, title, body, image_url };
}

export async function generatePost(
  input: GeneratePostInput
): Promise<GeneratedPost> {
  const apiKey = process.env.XAI_API_KEY;

  if (!apiKey) {
    return pickTemplate(input.topics);
  }

  try {
    const result = await callXai(
      apiKey,
      input.style,
      buildUserMessage(input)
    );
    if (result) return result;
  } catch {
    // fall through to template
  }

  return pickTemplate(input.topics);
}