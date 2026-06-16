import { redirect } from "next/navigation";
import { InsightScrollApp } from "@/components/insight-scroll-app";
import { getFeedData } from "@/lib/actions";

function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

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
        hasXaiKey={Boolean(process.env.XAI_API_KEY)}
      />
    );
  } catch {
    redirect("/setup");
  }
}