import { redirect } from "next/navigation";
import { HomeShell } from "@/components/home-shell";
import { getFeedData } from "@/lib/actions";
import { isSupabaseConfigured } from "@/lib/env";

export default async function HomePage() {
  if (!isSupabaseConfigured()) {
    redirect("/setup");
  }

  try {
    const { posts, topics, profile, interactions } = await getFeedData();

    return (
      <HomeShell
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