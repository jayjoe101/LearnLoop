import { after } from "next/server";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchValidatedPostImage,
  type PostImageContext,
} from "@/lib/image-relevance";

const SYNC_IMAGE_WAIT_MS = 2_500;

/** Vision-validated image attach — brief sync wait, then background finish. */
export async function attachPostImage(
  supabase: SupabaseClient,
  postId: string,
  ctx: PostImageContext
): Promise<string | null> {
  const imagePromise = fetchValidatedPostImage(ctx);

  const image = await Promise.race([
    imagePromise,
    new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), SYNC_IMAGE_WAIT_MS)
    ),
  ]);

  if (image) {
    await supabase
      .from("posts")
      .update({ image_url: image })
      .eq("id", postId);
    return image;
  }

  after(async () => {
    const lateImage = await imagePromise;
    if (!lateImage) return;

    await supabase
      .from("posts")
      .update({ image_url: lateImage })
      .eq("id", postId);

    revalidatePath("/");
  });

  return null;
}