"use client";

import { Feed } from "@/components/feed";
import type { Post, PostInteraction, Profile, Topic } from "@/lib/types";

type Props = {
  posts: Post[];
  topics: Topic[];
  profile: Profile | null;
  interactions: Record<string, PostInteraction>;
  hasXaiKey: boolean;
};

export function InsightScrollApp({
  posts,
  topics,
  profile,
  interactions,
  hasXaiKey,
}: Props) {
  return (
    <Feed
      posts={posts}
      topics={topics}
      interactions={interactions}
      hasXaiKey={hasXaiKey}
      feedStyle={profile?.feed_style}
    />
  );
}