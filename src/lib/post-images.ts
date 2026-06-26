import { after } from "next/server";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchPostImageForSubject, type ImageContext } from "@/lib/images";

/** Share of new posts that attempt a background image lookup. */
export const POST_IMAGE_ATTEMPT_CHANCE = 1 / 3;

export function shouldAttemptPostImage(): boolean {
  return Math.random() < POST_IMAGE_ATTEMPT_CHANCE;
}

/** Background image attach — subject-first Wikipedia thumbnail only. */
export function attachPostImage(
  supabase: SupabaseClient,
  postId: string,
  ctx: ImageContext
): null {
  after(async () => {
    try {
      const image = await fetchPostImageForSubject(ctx);
      if (!image) return;

      const { error } = await supabase
        .from("posts")
        .update({ image_url: image })
        .eq("id", postId);

      if (!error) revalidatePath("/");
    } catch {
      // imageless post — no user-facing error
    }
  });

  return null;
}