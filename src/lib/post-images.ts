import { after } from "next/server";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchValidatedPostImage,
  type PostImageContext,
} from "@/lib/image-relevance";

/** Non-blocking: validate image in background; irrelevant images are dropped. */
export async function attachPostImage(
  supabase: SupabaseClient,
  postId: string,
  ctx: PostImageContext
): Promise<null> {
  after(async () => {
    const image = await fetchValidatedPostImage(ctx);
    if (!image) return;

    await supabase
      .from("posts")
      .update({ image_url: image })
      .eq("id", postId);

    revalidatePath("/");
  });

  return null;
}