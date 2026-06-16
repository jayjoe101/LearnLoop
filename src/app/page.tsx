import { redirect } from "next/navigation";
import { InsightScrollApp } from "@/components/insight-scroll-app";
import { getFeedData } from "@/lib/actions";
import { isSupabaseConfigured } from "@/lib/env";

export default async function HomePage() {
  if (!isSupabaseConfigured()) {
    redirect("/setup");
  }

  try {
    const { posts, topics, profile, interactions } = await getFeedData();

    return (
      <InsightScrollApp
        posts={posts}
        topics={topics}
        profile={profile}
        interactions={interactions}
      />
    );
  } catch {
    redirect("/setup");
  }
}