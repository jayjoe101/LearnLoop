import { after } from "next/server";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchValidatedPostImage,
  type PostImageContext,
} from "./image-relevance";

/** Share of new posts that attempt an image lookup. */
export const POST_IMAGE_ATTEMPT_CHANCE = 1 / 3;

export const IMAGE_ATTACH_TIMEOUT_MS = 5_000;

export function shouldAttemptPostImage(): boolean {
  return Math.random() < POST_IMAGE_ATTEMPT_CHANCE;
}

/** Gather step used by attachPostImage — testable outside Next request scope. */
export async function runAttachGatherStep(
  ctx: PostImageContext
): Promise<string | null> {
  return fetchValidatedPostImage(ctx);
}

/** Resolve a thumbnail with a hard timeout so inserts do not hang. */
export async function resolvePostImageUrl(
  ctx: PostImageContext
): Promise<string | null> {
  try {
    return await Promise.race([
      runAttachGatherStep(ctx),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), IMAGE_ATTACH_TIMEOUT_MS)
      ),
    ]);
  } catch {
    return null;
  }
}

async function persistPostImage(
  supabase: SupabaseClient,
  postId: string,
  image: string
): Promise<boolean> {
  const { error } = await supabase
    .from("posts")
    .update({ image_url: image })
    .eq("id", postId);

  if (!error) {
    revalidatePath("/");
    return true;
  }
  return false;
}

/** Synchronous attach — reliable on serverless (no after() dependency). */
export async function attachPostImageSync(
  supabase: SupabaseClient,
  postId: string,
  ctx: PostImageContext
): Promise<string | null> {
  const image = await resolvePostImageUrl(ctx);
  if (!image) return null;
  const saved = await persistPostImage(supabase, postId, image);
  return saved ? image : null;
}

async function applyPostImageUpdate(
  supabase: SupabaseClient,
  postId: string,
  ctx: PostImageContext
): Promise<void> {
  try {
    await attachPostImageSync(supabase, postId, ctx);
  } catch {
    // imageless post — no user-facing error
  }
}

/** Background image attach — best-effort fallback after inline attach misses. */
export function attachPostImage(
  supabase: SupabaseClient,
  postId: string,
  ctx: PostImageContext
): null {
  const task = () => applyPostImageUpdate(supabase, postId, ctx);

  try {
    after(task);
  } catch {
    void task();
  }

  return null;
}