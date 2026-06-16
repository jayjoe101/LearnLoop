const XAI_API_URL = "https://api.x.ai/v1/chat/completions";

export const FAST_MODEL =
  process.env.XAI_FAST_MODEL ?? "grok-4-fast-non-reasoning";

export const VISION_MODEL =
  process.env.XAI_VISION_MODEL ?? "grok-2-vision-1212";

type ChatMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | {
      role: "user";
      content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" } }
      >;
    };

type JsonSchema = Record<string, unknown>;

export async function chatCompletion(options: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  jsonSchema?: { name: string; schema: JsonSchema; strict?: boolean };
}): Promise<string | null> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return null;

  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    temperature: options.temperature ?? 0.5,
    max_tokens: options.maxTokens ?? 256,
  };

  if (options.jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: options.jsonSchema.name,
        schema: options.jsonSchema.schema,
        strict: options.jsonSchema.strict ?? true,
      },
    };
  }

  try {
    const response = await fetch(XAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
      body: JSON.stringify(body),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return (data.choices?.[0]?.message?.content as string | undefined) ?? null;
  } catch {
    return null;
  }
}

export function parseJsonContent<T>(content: string): T | null {
  const match = content.match(/\{[\s\S]*\}/);
  const jsonText = match?.[0] ?? content;

  try {
    return JSON.parse(jsonText) as T;
  } catch {
    return null;
  }
}