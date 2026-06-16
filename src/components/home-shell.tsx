"use client";

import { InsightScrollApp } from "@/components/insight-scroll-app";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import type { Post, PostInteraction, Profile, Topic } from "@/lib/types";

type Props = {
  posts: Post[];
  topics: Topic[];
  profile: Profile | null;
  interactions: Record<string, PostInteraction>;
};

export function HomeShell({ posts, topics, profile, interactions }: Props) {
  if (!profile?.onboarding_completed) {
    return <OnboardingFlow />;
  }

  return (
    <InsightScrollApp
      posts={posts}
      topics={topics}
      profile={profile}
      interactions={interactions}
    />
  );
}