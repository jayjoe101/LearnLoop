"use server";

import { revalidatePath } from "next/cache";
import { generatePost } from "@/lib/grok";
import {
  fetchGenerationContext,
  pickRotatingTopic,
} from "@/lib/generation-context";
import { personaToAuthorFields } from "@/lib/post-author";
import { schedulePostImage } from "@/lib/post-images";
import { createClient } from "@/lib/supabase/server";
import {
  type FeedStyle,
  type Post,
  type PostInteraction,
  type Profile,
  type Topic,
} from "@/lib/types";

const MIN_ONBOARDING_TOPICS = 3;
const MAX_ONBOARDING_TOPICS = 8;

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

export async function getFeedData(): Promise<{
  posts: Post[];
  topics: Topic[];
  profile: Profile | null;
  interactions: Record<string, PostInteraction>;
}> {
  const { supabase, user } = await requireUser();

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

  const rawProfile = profileRes.data as Record<string, unknown> | null;

  const profile: Profile | null = rawProfile
    ? {
        id: rawProfile.id as string,
        display_name: (rawProfile.display_name as string | null) ?? null,
        feed_style: (rawProfile.feed_style as FeedStyle) ?? "Balanced & insightful",
        personalization_enabled:
          (rawProfile.personalization_enabled as boolean) ?? true,
        onboarding_completed:
          (rawProfile.onboarding_completed as boolean) ?? false,
      }
    : null;

  return {
    posts: (postsRes.data ?? []) as Post[],
    topics: (topicsRes.data ?? []) as Topic[],
    profile,
    interactions,
  };
}

export async function completeOnboarding(
  topicNames: string[],
  feedStyle: FeedStyle
) {
  const unique = [...new Set(topicNames.map((t) => t.trim()).filter(Boolean))];

  if (unique.length < MIN_ONBOARDING_TOPICS) {
    return { error: `Pick at least ${MIN_ONBOARDING_TOPICS} interests` };
  }
  if (unique.length > MAX_ONBOARDING_TOPICS) {
    return { error: `Pick at most ${MAX_ONBOARDING_TOPICS} interests` };
  }

  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .single();

  if (profile?.onboarding_completed) {
    return { success: true, alreadyComplete: true };
  }

  await supabase.from("topics").delete().eq("user_id", user.id);

  const { error: topicsError } = await supabase.from("topics").insert(
    unique.map((name) => ({ user_id: user.id, name }))
  );
  if (topicsError) return { error: topicsError.message };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      feed_style: feedStyle,
      personalization_enabled: true,
      onboarding_completed: true,
    })
    .eq("id", user.id);

  if (profileError) return { error: profileError.message };

  const recentTitles: string[] = [];
  for (let i = 0; i < 2; i++) {
    await generateNewPostForUser(user.id, unique, feedStyle, {
      recentTitles: [...recentTitles],
      focusTopic: pickRotatingTopic(unique, i),
      onCreated: (title) => recentTitles.push(title),
    });
  }

  revalidatePath("/");
  return { success: true };
}

async function generateNewPostForUser(
  userId: string,
  topicNames: string[],
  style: FeedStyle,
  options?: {
    prompt?: string;
    recentTitles?: string[];
    focusTopic?: string;
    onCreated?: (title: string) => void;
  }
) {
  const supabase = await createClient();

  const post = await generatePost({
    prompt: options?.prompt,
    topics: topicNames,
    style,
    recentTitles: options?.recentTitles ?? [],
    focusTopic: options?.focusTopic,
  });

  const { data: inserted, error } = await supabase
    .from("posts")
    .insert({
      user_id: userId,
      topic: post.topic,
      title: post.title,
      body: post.body,
      image_url: null,
      likes_count: 300 + Math.floor(Math.random() * 500),
      source: "grok",
      prompt: options?.prompt ?? null,
      ...personaToAuthorFields(post.persona),
    })
    .select("id")
    .single();

  if (!error && inserted?.id) {
    options?.onCreated?.(post.title);
    schedulePostImage(inserted.id, post.topic, post.title);
  }
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

  const [{ data: profile }, ctx] = await Promise.all([
    supabase
      .from("profiles")
      .select("feed_style, onboarding_completed")
      .eq("id", user.id)
      .single(),
    fetchGenerationContext(supabase, user.id),
  ]);

  if (!profile?.onboarding_completed) {
    return { error: "Complete onboarding first" };
  }

  const style =
    (profile.feed_style as FeedStyle) ?? "Balanced & insightful";

  const post = await generatePost({
    prompt,
    topics: ctx.topicNames,
    style,
    recentTitles: ctx.recentTitles,
    focusTopic: pickRotatingTopic(ctx.topicNames, ctx.postCount),
  });

  const { data: inserted, error } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,
      topic: post.topic,
      title: post.title,
      body: post.body,
      image_url: null,
      likes_count: 300 + Math.floor(Math.random() * 500),
      source: "grok",
      prompt: prompt ?? null,
      ...personaToAuthorFields(post.persona),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (inserted?.id) {
    schedulePostImage(inserted.id, post.topic, post.title);
  }

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