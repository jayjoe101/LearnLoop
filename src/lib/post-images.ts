import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { fetchRelevantImage, type ImageContext } from "@/lib/images";
import { createClient } from "@/lib/supabase/server";

/** Attach a topic-relevant image after the post is live — off the critical path. */
export function schedulePostImage(
  postId: string,
  ctx: ImageContext,
  existingUrl: string | null = null
) {
  if (existingUrl) return;

  after(async () => {
    const image = await fetchRelevantImage(ctx);
    if (!image) return;

    const supabase = await createClient();
    await supabase
      .from("posts")
      .update({ image_url: image })
      .eq("id", postId);

    revalidatePath("/");
  });
}