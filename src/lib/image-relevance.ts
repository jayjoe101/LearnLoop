import { fetchImageCandidates, type ImageContext } from "@/lib/images";
import { chatCompletion, parseJsonContent, VISION_MODEL } from "@/lib/xai-client";

export type PostImageContext = ImageContext & {
  body?: string;
};

async function evaluateImageRelevance(
  imageUrl: string,
  ctx: PostImageContext
): Promise<boolean | null> {
  const excerpt = (ctx.body ?? "").slice(0, 500);

  const content = await chatCompletion({
    model: VISION_MODEL,
    temperature: 0.05,
    maxTokens: 64,
    timeoutMs: 8_000,
    jsonSchema: {
      name: "image_relevance",
      schema: {
        type: "object",
        properties: {
          relevant: { type: "boolean" },
        },
        required: ["relevant"],
        additionalProperties: false,
      },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: imageUrl, detail: "low" },
          },
          {
            type: "text",
            text: `Post topic area: ${ctx.topic}
Post title: ${ctx.title}
Post excerpt: ${excerpt}

Is this image visually relevant to the specific post subject (not just the broad topic label)?
Return JSON: { "relevant": true } only if a reader would agree the image fits the post.`,
          },
        ],
      },
    ],
  });

  if (!content) return null;

  const parsed = parseJsonContent<{ relevant?: boolean }>(content);
  if (typeof parsed?.relevant !== "boolean") return null;
  return parsed.relevant;
}

/** Fetch Wikipedia candidates in parallel, vision-check in parallel, return first relevant hit. */
export async function fetchValidatedPostImage(
  ctx: PostImageContext
): Promise<string | null> {
  const candidates = await fetchImageCandidates(ctx, 4);
  if (candidates.length === 0) return null;

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return candidates[0];

  const verdicts = await Promise.all(
    candidates.map((url) => evaluateImageRelevance(url, ctx))
  );

  const relevantIndex = verdicts.findIndex((v) => v === true);
  if (relevantIndex >= 0) return candidates[relevantIndex];

  if (verdicts.every((v) => v === null)) {
    return candidates[0] ?? null;
  }

  return null;
}