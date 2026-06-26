"use client";

import { AppSidebar } from "@/components/app-sidebar";
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
  interactions,
  hasXaiKey,
}: Props) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar topics={topics} />
      <Feed
        posts={posts}
        interactions={interactions}
        hasXaiKey={hasXaiKey}
      />
    </div>
  );
}