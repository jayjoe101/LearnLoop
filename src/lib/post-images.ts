import { after } from "next/server";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchRelevantImage, type ImageContext } from "@/lib/images";

const SYNC_IMAGE_WAIT_MS = 1_000;

/** Fetch image on the hot path (brief wait), then finish in background with the same client. */
export async function attachPostImage(
  supabase: SupabaseClient,
  postId: string,
  ctx: ImageContext
): Promise<string | null> {
  const imagePromise = fetchRelevantImage(ctx);

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