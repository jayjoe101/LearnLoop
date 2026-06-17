import type { SupabaseClient } from "@supabase/supabase-js";
import { contentFingerprint } from "@/lib/dedup";
import type { PostWikiTerm } from "@/lib/types";

export type GenerationContext = {
  topicNames: string[];
  recentTitles: string[];
  recentSubjects: string[];
  recentFingerprints: string[];
  lastTopic?: string;
  postCount: number;
};

function extractSubjectsFromPosts(
  posts: Array<{
    title: string;
    topic: string;
    wiki_terms: PostWikiTerm[] | null;
  }>
): string[] {
  const seen = new Set<string>();
  const subjects: string[] = [];

  for (const post of posts) {
    for (const wiki of post.wiki_terms ?? []) {
      const term = wiki.term?.trim();
      if (!term) continue;
      const key = term.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      subjects.push(term);
    }

    const title = post.title?.trim();
    if (title) {
      const key = title.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        subjects.push(title);
      }
    }
  }

  return subjects;
}

export async function fetchGenerationContext(
  supabase: SupabaseClient,
  userId: string
): Promise<GenerationContext> {
  const [{ data: topics }, { data: recentPosts }, { count }] =
    await Promise.all([
      supabase.from("topics").select("name").eq("user_id", userId),
      supabase
        .from("posts")
        .select("title, body, topic, wiki_terms")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(16),
      supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

  const topicNames = (topics ?? []).map((t) => t.name);
  const recentTitles = (recentPosts ?? []).map((p) => p.title);
  const recentSubjects = extractSubjectsFromPosts(
    (recentPosts ?? []) as Array<{
      title: string;
      topic: string;
      wiki_terms: PostWikiTerm[] | null;
    }>
  );
  const recentFingerprints = (recentPosts ?? []).map((p) =>
    contentFingerprint(p.title, p.body)
  );
  const postCount = count ?? 0;
  const lastTopic = (recentPosts?.[0] as { topic?: string } | undefined)?.topic;

  return {
    topicNames,
    recentTitles,
    recentSubjects,
    recentFingerprints,
    lastTopic,
    postCount,
  };
}

/** Random interest area — avoids repeating the same area twice in a row when possible. */
export function pickRandomTopic(
  topics: string[],
  exclude?: string
): string | undefined {
  if (topics.length === 0) return undefined;

  const pool =
    exclude && topics.length > 1
      ? topics.filter((t) => t.toLowerCase() !== exclude.toLowerCase())
      : topics;

  return pool[Math.floor(Math.random() * pool.length)];
}

/** @deprecated Use pickRandomTopic — kept for any stale imports */
export function pickRotatingTopic(
  topics: string[],
  index: number
): string | undefined {
  if (topics.length === 0) return undefined;
  return topics[index % topics.length];
}