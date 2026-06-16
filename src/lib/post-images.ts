import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { resolvePostImage } from "@/lib/images";
import { createClient } from "@/lib/supabase/server";

/** Attach a topic-relevant image after the post is live — off the critical path. */
export function schedulePostImage(
  postId: string,
  topic: string,
  title: string
) {
  after(async () => {
    const image = await resolvePostImage(topic, title);
    if (!image) return;

    const supabase = await createClient();
    await supabase
      .from("posts")
      .update({ image_url: image })
      .eq("id", postId);

    revalidatePath("/");
  });
}