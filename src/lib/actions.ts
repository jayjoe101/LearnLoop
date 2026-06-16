"use server";

import { revalidatePath } from "next/cache";
import { generatePost } from "@/lib/grok";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_TOPICS,
  SEED_POSTS,
  type FeedStyle,
  type Post,
  type PostInteraction,
  type Profile,
  type Topic,
} from "@/lib/types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Not authenticated");
  }

  return { supabase, user };
}

async function ensureOnboarding(userId: string) {
  const supabase = await createClient();

  const { count: topicCount } = await supabase
    .from("topics")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (!topicCount) {
    await supabase.from("topics").insert(
      DEFAULT_TOPICS.map((name) => ({ user_id: userId, name }))
    );
  }

  const { count: postCount } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (!postCount) {
    await supabase.from("posts").insert(
      SEED_POSTS.map((post) => ({
        user_id: userId,
        ...post,
        source: "seed" as const,
      }))
    );
  }
}

export async function getFeedData(): Promise<{
  posts: Post[];
  topics: Topic[];
  profile: Profile | null;
  interactions: Record<string, PostInteraction>;
}> {
  const { supabase, user } = await requireUser();
  await ensureOnboarding(user.id);

  const [postsRes, topicsRes, profileRes, interactionsRes] = await Promise.all([
    supabase
      .from("posts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("topics")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("post_interactions").select("*").eq("user_id", user.id),
  ]);

  const interactions: Record<string, PostInteraction> = {};
  for (const row of interactionsRes.data ?? []) {
    interactions[row.post_id] = {
      liked: row.liked,
      saved: row.saved,
      not_interested: row.not_interested,
    };
  }

  return {
    posts: (postsRes.data ?? []) as Post[],
    topics: (topicsRes.data ?? []) as Topic[],
    profile: (profileRes.data as Profile | null) ?? null,
    interactions,
  };
}

export async function addTopic(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Topic name required" };

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("topics")
    .insert({ user_id: user.id, name: trimmed });

  if (error) return { error: error.message };
  revalidatePath("/");
  return { success: true };
}

export async function removeTopic(topicId: string) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("topics")
    .delete()
    .eq("id", topicId)
    .eq("user_id", user.id);
  revalidatePath("/");
}

export async function generateNewPost(prompt?: string) {
  const { supabase, user } = await requireUser();
  await ensureOnboarding(user.id);

  const [{ data: topics }, { data: profile }] = await Promise.all([
    supabase.from("topics").select("name").eq("user_id", user.id),
    supabase.from("profiles").select("feed_style").eq("id", user.id).single(),
  ]);

  const generated = await generatePost({
    prompt,
    topics: (topics ?? []).map((t) => t.name),
    style: (profile?.feed_style as FeedStyle) ?? "Balanced & insightful",
  });

  const { error } = await supabase.from("posts").insert({
    user_id: user.id,
    topic: generated.topic,
    title: generated.title,
    body: generated.body,
    image_url: generated.image_url,
    likes_count: 300 + Math.floor(Math.random() * 500),
    source: "grok",
    prompt: prompt ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath("/");
  return { success: true };
}

export async function loadMorePosts(count = 2) {
  for (let i = 0; i < count; i++) {
    await generateNewPost();
  }
}

export async function likePost(postId: string) {
  const { supabase, user } = await requireUser();

  const { data: existing } = await supabase
    .from("post_interactions")
    .select("*")
    .eq("user_id", user.id)
    .eq("post_id", postId)
    .maybeSingle();

  if (existing?.liked) {
    return { success: true, alreadyLiked: true };
  }

  if (existing) {
    await supabase
      .from("post_interactions")
      .update({ liked: true })
      .eq("id", existing.id);
  } else {
    await supabase.from("post_interactions").insert({
      user_id: user.id,
      post_id: postId,
      liked: true,
    });
  }

  const { data: post } = await supabase
    .from("posts")
    .select("likes_count")
    .eq("id", postId)
    .single();

  if (post) {
    await supabase
      .from("posts")
      .update({ likes_count: post.likes_count + 137 })
      .eq("id", postId);
  }

  if (Math.random() > 0.5) {
    await generateNewPost();
  }

  revalidatePath("/");
  return { success: true };
}

export async function savePost(postId: string) {
  const { supabase, user } = await requireUser();

  const { data: post } = await supabase
    .from("posts")
    .select("title, body")
    .eq("id", postId)
    .single();

  if (!post) return { error: "Post not found" };

  const { data: existing } = await supabase
    .from("post_interactions")
    .select("*")
    .eq("user_id", user.id)
    .eq("post_id", postId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("post_interactions")
      .update({ saved: true })
      .eq("id", existing.id);
  } else {
    await supabase.from("post_interactions").insert({
      user_id: user.id,
      post_id: postId,
      saved: true,
    });
  }

  await supabase.from("saved_notes").insert({
    user_id: user.id,
    post_id: postId,
    title: post.title,
    body: post.body,
  });

  revalidatePath("/");
  return { success: true };
}

export async function markNotInterested(postId: string) {
  const { supabase, user } = await requireUser();

  const { data: existing } = await supabase
    .from("post_interactions")
    .select("*")
    .eq("user_id", user.id)
    .eq("post_id", postId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("post_interactions")
      .update({ not_interested: true })
      .eq("id", existing.id);
  } else {
    await supabase.from("post_interactions").insert({
      user_id: user.id,
      post_id: postId,
      not_interested: true,
    });
  }

  revalidatePath("/");
  return { success: true };
}

export async function updateFeedStyle(style: FeedStyle) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("profiles")
    .update({ feed_style: style })
    .eq("id", user.id);
  revalidatePath("/");
}

export async function togglePersonalization() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("personalization_enabled")
    .eq("id", user.id)
    .single();

  await supabase
    .from("profiles")
    .update({
      personalization_enabled: !profile?.personalization_enabled,
    })
    .eq("id", user.id);
  revalidatePath("/");
}

export async function refreshFeed() {
  const { supabase, user } = await requireUser();
  const { data: posts } = await supabase
    .from("posts")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const keepIds = (posts ?? []).slice(0, 2).map((p) => p.id);
  const deleteIds = (posts ?? []).slice(2).map((p) => p.id);

  if (deleteIds.length) {
    await supabase.from("posts").delete().in("id", deleteIds);
  }

  await generateNewPost();
  await generateNewPost();
  revalidatePath("/");
  return { kept: keepIds.length };
}