"use client";

import { Feed } from "@/components/feed";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
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
    <div className="flex h-screen">
      <LeftSidebar topics={topics} />
      <Feed posts={posts} interactions={interactions} hasXaiKey={hasXaiKey} />
      <RightSidebar profile={profile} />
    </div>
  );
}