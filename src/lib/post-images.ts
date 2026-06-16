import { after } from "next/server";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchValidatedPostImage,
  type PostImageContext,
} from "@/lib/image-relevance";

/** Background image attach — permissive validation, uses request-scoped client. */
export function attachPostImage(
  supabase: SupabaseClient,
  postId: string,
  ctx: PostImageContext
): null {
  after(async () => {
    try {
      const image = await fetchValidatedPostImage(ctx);
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