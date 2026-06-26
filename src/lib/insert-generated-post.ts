import type { SupabaseClient } from "@supabase/supabase-js";
import type { GeneratedPost } from "./grok";
import { attachPostImage, shouldAttemptPostImage } from "./post-images";
import { personaToAuthorFields } from "./post-author";
import type { Post } from "./types";

function mapRowToPost(row: Record<string, unknown>): Post {
  return {
    ...(row as Post),
    links: (row.links as Post["links"]) ?? [],
    wiki_terms: (row.wiki_terms as Post["wiki_terms"]) ?? [],
    wants_image: Boolean(row.wants_image),
  };
}

export async function insertGeneratedPost(
  supabase: SupabaseClient,
  userId: string,
  post: GeneratedPost,
  prompt: string | null
): Promise<Post | null> {
  const imageCtx = {
    topic: post.topic,
    title: post.title,
    subject: post.subject,
    body: post.body,
    links: post.links,
    wiki_terms: post.wiki_terms,
  };

  const wantsImage = shouldAttemptPostImage();

  const { data: inserted, error } = await supabase
    .from("posts")
    .insert({
      user_id: userId,
      topic: post.topic,
      title: post.title,
      body: post.body,
      image_url: null,
      wants_image: wantsImage,
      links: post.links,
      wiki_terms: post.wiki_terms,
      likes_count: 300 + Math.floor(Math.random() * 500),
      source: "grok",
      prompt,
      ...personaToAuthorFields(post.persona),
    })
    .select("*")
    .single();

  if (error || !inserted) return null;

  const postId = inserted.id as string;
  if (wantsImage) {
    void attachPostImage(supabase, postId, imageCtx);
  }

  return mapRowToPost(inserted as Record<string, unknown>);
}