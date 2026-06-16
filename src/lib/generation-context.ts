import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchGenerationContext(
  supabase: SupabaseClient,
  userId: string
) {
  const [{ data: topics }, { data: recentPosts }, { count }] =
    await Promise.all([
      supabase.from("topics").select("name").eq("user_id", userId),
      supabase
        .from("posts")
        .select("title")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

  const topicNames = (topics ?? []).map((t) => t.name);
  const recentTitles = (recentPosts ?? []).map((p) => p.title);
  const postCount = count ?? 0;

  return { topicNames, recentTitles, postCount };
}

export function pickRotatingTopic(
  topics: string[],
  index: number
): string | undefined {
  if (topics.length === 0) return undefined;
  return topics[index % topics.length];
}