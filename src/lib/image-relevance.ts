import {
  fetchPostImageForSubject,
  type ImageContext,
} from "@/lib/images";

export type PostImageContext = ImageContext & {
  body?: string;
};

/** Wikipedia thumbnail for the post subject — no vision API round-trip. */
export async function fetchValidatedPostImage(
  ctx: PostImageContext
): Promise<string | null> {
  return fetchPostImageForSubject(ctx);
}