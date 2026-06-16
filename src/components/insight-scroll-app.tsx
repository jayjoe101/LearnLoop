"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { Feed } from "@/components/feed";
import type { Post, PostInteraction, Profile, Topic } from "@/lib/types";

type Props = {
  posts: Post[];
  topics: Topic[];
  profile: Profile | null;
  interactions: Record<string, PostInteraction>;
};

export function InsightScrollApp({
  posts,
  topics,
  profile,
  interactions,
}: Props) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar topics={topics} profile={profile} />
      <Feed posts={posts} topics={topics} interactions={interactions} />
    </div>
  );
}