import { after } from "next/server";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchValidatedPostImage,
  type PostImageContext,
} from "./image-relevance";

/** Share of new posts that attempt a background image lookup. */
export const POST_IMAGE_ATTEMPT_CHANCE = 1 / 3;

export function shouldAttemptPostImage(): boolean {
  return Math.random() < POST_IMAGE_ATTEMPT_CHANCE;
}

/** Gather step used by attachPostImage — testable outside Next request scope. */
export async function runAttachGatherStep(
  ctx: PostImageContext
): Promise<string | null> {
  return fetchValidatedPostImage(ctx);
}

async function applyPostImageUpdate(
  supabase: SupabaseClient,
  postId: string,
  ctx: PostImageContext
): Promise<void> {
  try {
    const image = await runAttachGatherStep(ctx);
    if (!image) return;

    const { error } = await supabase
      .from("posts")
      .update({ image_url: image })
      .eq("id", postId);

    if (!error) revalidatePath("/");
  } catch {
    // imageless post — no user-facing error
  }
}

/** Background image attach — uses request-scoped client when available. */
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