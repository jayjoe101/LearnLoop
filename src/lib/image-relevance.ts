import { fetchFirstImageCandidate, type ImageContext } from "@/lib/images";
import { chatCompletion, parseJsonContent, VISION_MODEL } from "@/lib/xai-client";

export type PostImageContext = ImageContext & {
  body?: string;
};

const PIPELINE_BUDGET_MS = 5_500;
const VISION_TIMEOUT_MS = 3_500;

async function evaluateImageRelevance(
  imageUrl: string,
  ctx: PostImageContext,
  timeoutMs: number
): Promise<boolean> {
  const excerpt = (ctx.body ?? "").slice(0, 280);

  const content = await chatCompletion({
    model: VISION_MODEL,
    temperature: 0.05,
    maxTokens: 32,
    timeoutMs,
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
            text: `Title: ${ctx.title}
Excerpt: ${excerpt}

Is this image visually relevant to this specific post (not just the broad topic)?
Return { "relevant": true } only if it clearly fits.`,
          },
        ],
      },
    ],
  });

  if (!content) return false;

  const parsed = parseJsonContent<{ relevant?: boolean }>(content);
  return parsed?.relevant === true;
}

async function fetchValidatedPostImageInner(
  ctx: PostImageContext
): Promise<string | null> {
  const apiKey = process.env.XAI_API_KEY;
  const imageUrl = await fetchFirstImageCandidate(ctx);

  if (!imageUrl) return null;
  if (!apiKey) return imageUrl;

  const relevant = await evaluateImageRelevance(
    imageUrl,
    ctx,
    VISION_TIMEOUT_MS
  );

  return relevant ? imageUrl : null;
}

/**
 * One Wikipedia pull + one vision check. Irrelevant or slow → null (imageless post).
 */
export async function fetchValidatedPostImage(
  ctx: PostImageContext
): Promise<string | null> {
  return Promise.race([
    fetchValidatedPostImageInner(ctx),
    new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), PIPELINE_BUDGET_MS)
    ),
  ]);
}