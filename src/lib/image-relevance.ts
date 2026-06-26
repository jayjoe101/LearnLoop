import { fetchImageCandidates, type ImageContext } from "./images";

export type PostImageContext = ImageContext & {
  body?: string;
};

/** Best Wikipedia thumbnail for the post — subject-led candidates, no vision gate. */
export async function fetchValidatedPostImage(
  ctx: PostImageContext
): Promise<string | null> {
  try {
    const candidates = await fetchImageCandidates(ctx, 3);
    return candidates[0] ?? null;
  } catch {
    return null;
  }
}