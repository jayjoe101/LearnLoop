import { fetchImageCandidates, type ImageContext } from "@/lib/images";
import { chatCompletion } from "@/lib/xai-client";

export type PostImageContext = ImageContext & {
  body?: string;
};

const VISION_TIMEOUT_MS = 4_000;

const VISION_MODELS = [
  process.env.XAI_VISION_MODEL,
  "grok-2-vision-1212",
  "grok-vision-beta",
  "grok-2-vision",
].filter((m, i, a): m is string => Boolean(m) && a.indexOf(m) === i);

function visionCheckEnabled(): boolean {
  return process.env.IMAGE_VISION_CHECK === "true";
}

function parseYesNo(content: string): boolean {
  const normalized = content.trim().toUpperCase();

  if (
    normalized.startsWith("NO") ||
    /\bNOT RELEVANT\b/.test(normalized) ||
    /\bUNRELATED\b/.test(normalized)
  ) {
    return false;
  }

  return true;
}

/** Optional soft check — only when IMAGE_VISION_CHECK=true. API failures → accept. */
async function passesOptionalVisionCheck(
  imageUrl: string,
  ctx: PostImageContext
): Promise<boolean> {
  if (!visionCheckEnabled()) return true;

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return true;

  const excerpt = (ctx.body ?? "").slice(0, 200);

  for (const model of VISION_MODELS) {
    const content = await chatCompletion({
      model,
      temperature: 0,
      maxTokens: 8,
      timeoutMs: VISION_TIMEOUT_MS,
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
              text: `Post: "${ctx.title}" (${ctx.topic})
${excerpt ? `Snippet: ${excerpt}` : ""}

Could this image illustrate the post? Default YES — only reply NO if completely wrong (unrelated stock photo, logo, or random object).
One word: YES or NO.`,
            },
          ],
        },
      ],
    });

    if (!content) continue;
    return parseYesNo(content);
  }

  return true;
}

/** Best Wikipedia thumbnail for the post. Vision gate is off unless IMAGE_VISION_CHECK=true. */
export async function fetchValidatedPostImage(
  ctx: PostImageContext
): Promise<string | null> {
  const candidates = await fetchImageCandidates(ctx, 3);
  if (candidates.length === 0) return null;

  if (!visionCheckEnabled()) {
    return candidates[0];
  }

  for (const url of candidates) {
    if (await passesOptionalVisionCheck(url, ctx)) return url;
  }

  return candidates[0];
}