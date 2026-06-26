"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  appendFingerprint,
  contentFingerprint,
  isBoilerplatePost,
  isDuplicateContent,
} from "@/lib/dedup";
import { generatePost, type GeneratedPost } from "@/lib/grok";
import {
  fetchGenerationContext,
  pickRandomTopic,
} from "@/lib/generation-context";
import { personaToAuthorFields } from "@/lib/post-author";
import { fetchValidatedPostImage } from "@/lib/image-relevance";
import { attachPostImage } from "@/lib/post-images";
import { createClient } from "@/lib/supabase/server";
import type { LiveSessionContext } from "@/lib/live-posting";
import { discoverConcreteSubject } from "@/lib/subject-discovery";
import {
  type FeedStyle,
  MAX_ONBOARDING_TOPICS,
  MIN_ONBOARDING_TOPICS,
  type Post,
  type PostInteraction,
  type Profile,
  type Topic,
} from "@/lib/types";
const MAX_DEDUP_RETRIES = 2;

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

  const posts = ((postsRes.data ?? []) as Post[]).map((post) => ({
    ...post,
    links: post.links ?? [],
    wiki_terms: post.wiki_terms ?? [],
  }));

  return {
    posts,
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

  let recentTitles: string[] = [];
  let recentSubjects: string[] = [];
  let recentFingerprints: string[] = [];
  let lastTopic: string | undefined;

  for (let i = 0; i < 2; i++) {
    const focusTopic = pickRandomTopic(unique, lastTopic);
    const created = await createUniquePost(await createClient(), user.id, {
      topicNames: unique,
      style: feedStyle,
      recentTitles,
      recentSubjects,
      recentFingerprints,
      focusTopic,
      lastTopic,
      postCount: i,
    });

    if (created) {
      recentTitles = [...recentTitles, created.title];
      recentSubjects = [
        ...recentSubjects,
        ...(created.wiki_terms ?? []).map((w) => w.term),
        created.title,
      ];
      recentFingerprints = appendFingerprint(
        recentFingerprints,
        created.title,
        created.body
      );
      lastTopic = created.topic;
    }
  }

  revalidatePath("/");
  return { success: true };
}

async function postExistsForUser(
  supabase: SupabaseClient,
  userId: string,
  title: string,
  body: string
): Promise<boolean> {
  const fp = contentFingerprint(title, body);
  const { data } = await supabase
    .from("posts")
    .select("title, body")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  return (data ?? []).some(
    (row) => contentFingerprint(row.title, row.body) === fp
  );
}

function mapRowToPost(row: Record<string, unknown>): Post {
  return {
    ...(row as Post),
    links: (row.links as Post["links"]) ?? [],
    wiki_terms: (row.wiki_terms as Post["wiki_terms"]) ?? [],
  };
}

async function insertGeneratedPost(
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

  const imageUrl = await fetchValidatedPostImage(imageCtx);

  const { data: inserted, error } = await supabase
    .from("posts")
    .insert({
      user_id: userId,
      topic: post.topic,
      title: post.title,
      body: post.body,
      image_url: imageUrl,
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
  if (!imageUrl) {
    void attachPostImage(supabase, postId, imageCtx);
  }

  return mapRowToPost(inserted as Record<string, unknown>);
}

export async function fetchPostImageUrl(postId: string) {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("posts")
    .select("image_url")
    .eq("id", postId)
    .eq("user_id", user.id)
    .single();

  return { imageUrl: (data?.image_url as string | null) ?? null };
}

async function createUniquePost(
  supabase: SupabaseClient,
  userId: string,
  options: {
    topicNames: string[];
    style: FeedStyle;
    recentTitles: string[];
    recentSubjects?: string[];
    recentFingerprints: string[];
    focusTopic?: string;
    lastTopic?: string;
    postCount: number;
    prompt?: string;
  }
): Promise<Post | null> {
  let titles = [...options.recentTitles];
  const subjects = [...(options.recentSubjects ?? [])];
  let fingerprints = [...options.recentFingerprints];

  for (let attempt = 0; attempt < MAX_DEDUP_RETRIES; attempt++) {
    const focusTopic =
      options.focusTopic ??
      pickRandomTopic(options.topicNames, options.lastTopic);
    const subjectIndex = Date.now() + options.postCount + attempt * 17;

    const concreteSubject = focusTopic
      ? await discoverConcreteSubject({
          topic: focusTopic,
          subjectIndex,
          recentTitles: titles,
          avoidSubjects: subjects,
        })
      : undefined;

    const post = await generatePost(
      {
        prompt: options.prompt,
        topics: options.topicNames,
        style: options.style,
        recentTitles: titles,
        recentFingerprints: fingerprints,
        avoidSubjects: subjects,
        focusTopic,
        concreteSubject,
        subjectIndex,
      },
      attempt
    );

    if (
      isBoilerplatePost(post.title, post.body) ||
      isDuplicateContent(post.title, post.body, fingerprints)
    ) {
      titles = [...titles, post.title];
      fingerprints = appendFingerprint(fingerprints, post.title, post.body);
      continue;
    }

    if (await postExistsForUser(supabase, userId, post.title, post.body)) {
      titles = [...titles, post.title];
      fingerprints = appendFingerprint(fingerprints, post.title, post.body);
      continue;
    }

    const inserted = await insertGeneratedPost(
      supabase,
      userId,
      post,
      options.prompt ?? null
    );
    if (inserted) return inserted;
  }

  return null;
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

  const created = await createUniquePost(supabase, user.id, {
    topicNames: ctx.topicNames,
    style,
    recentTitles: ctx.recentTitles,
    recentSubjects: ctx.recentSubjects,
    recentFingerprints: ctx.recentFingerprints,
    focusTopic: pickRandomTopic(ctx.topicNames, ctx.lastTopic),
    lastTopic: ctx.lastTopic,
    postCount: ctx.postCount,
    prompt,
  });

  if (!created) return { error: "Could not generate a unique post" };

  revalidatePath("/");
  return { success: true, post: created };
}

/** Background live post — no full-page revalidate; returns the new post for client queue. */
export async function generateLivePost(session?: LiveSessionContext) {
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

  const recentTitles = [
    ...ctx.recentTitles,
    ...(session?.recentTitles ?? []),
  ].slice(-14);
  const recentSubjects = [
    ...ctx.recentSubjects,
    ...(session?.recentSubjects ?? []),
  ].slice(-20);
  const recentFingerprints = [
    ...ctx.recentFingerprints,
    ...(session?.recentFingerprints ?? []),
  ].slice(-14);
  const postCount =
    ctx.postCount + (session?.postCountOffset ?? 0);

  const created = await createUniquePost(supabase, user.id, {
    topicNames: ctx.topicNames,
    style,
    recentTitles,
    recentSubjects,
    recentFingerprints,
    focusTopic: pickRandomTopic(ctx.topicNames, ctx.lastTopic),
    lastTopic: ctx.lastTopic,
    postCount,
  });

  if (!created) return { error: "Could not generate a unique post" };

  return { post: created };
}

export async function loadMorePosts(count = 2) {
  const { supabase, user } = await requireUser();

  const [{ data: profile }, ctx] = await Promise.all([
    supabase
      .from("profiles")
      .select("feed_style, onboarding_completed")
      .eq("id", user.id)
      .single(),
    fetchGenerationContext(supabase, user.id),
  ]);

  if (!profile?.onboarding_completed) return;

  const style =
    (profile.feed_style as FeedStyle) ?? "Balanced & insightful";

  let recentTitles = ctx.recentTitles;
  let recentSubjects = ctx.recentSubjects;
  let recentFingerprints = ctx.recentFingerprints;
  let lastTopic = ctx.lastTopic;

  for (let i = 0; i < count; i++) {
    const focusTopic = pickRandomTopic(ctx.topicNames, lastTopic);
    const created = await createUniquePost(supabase, user.id, {
      topicNames: ctx.topicNames,
      style,
      recentTitles,
      recentSubjects,
      recentFingerprints,
      focusTopic,
      lastTopic,
      postCount: ctx.postCount + i,
    });

    if (created) {
      recentTitles = [...recentTitles, created.title];
      recentSubjects = [
        ...recentSubjects,
        ...(created.wiki_terms ?? []).map((w) => w.term),
        created.title,
      ];
      recentFingerprints = appendFingerprint(
        recentFingerprints,
        created.title,
        created.body
      );
      lastTopic = created.topic;
    }
  }

  revalidatePath("/");
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

  await loadMorePosts(2);
  return { kept: keepIds.length };
}