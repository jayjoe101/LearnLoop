"use client";

import { useState, useTransition } from "react";
import {
  generateNewPost,
  loadMorePosts,
  refreshFeed,
  togglePersonalization,
} from "@/lib/actions";
import { PostCard } from "@/components/post-card";
import type { Post, PostInteraction } from "@/lib/types";

type Props = {
  posts: Post[];
  interactions: Record<string, PostInteraction>;
  hasXaiKey: boolean;
};

export function Feed({ posts, interactions, hasXaiKey }: Props) {
  const [prompt, setPrompt] = useState("");
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"for-you" | "following" | "explore">(
    "for-you"
  );

  const visiblePosts =
    activeTab === "following"
      ? posts.filter((p) => interactions[p.id]?.liked)
      : posts.filter((p) => !interactions[p.id]?.not_interested);

  function handleSendPrompt() {
    startTransition(async () => {
      await generateNewPost(prompt || undefined);
      setPrompt("");
    });
  }

  return (
    <main className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-700 bg-zinc-950 px-6 py-3">
        <nav className="flex gap-8 text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("for-you")}
            className={
              activeTab === "for-you"
                ? "border-b-2 border-white pb-1"
                : "text-zinc-400 hover:text-zinc-200"
            }
          >
            For You
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("following")}
            className={
              activeTab === "following"
                ? "border-b-2 border-white pb-1"
                : "text-zinc-400 hover:text-zinc-200"
            }
          >
            Following
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("explore");
              startTransition(async () => {
                await refreshFeed();
              });
            }}
            className={
              activeTab === "explore"
                ? "border-b-2 border-white pb-1"
                : "text-zinc-400 hover:text-zinc-200"
            }
          >
            Explore
          </button>
        </nav>

        <div className="flex flex-1 items-center justify-center gap-3 px-6">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendPrompt()}
            className="w-full max-w-md rounded-full bg-zinc-800 px-4 py-2 text-sm outline-none ring-violet-500 focus:ring-1"
            placeholder="Ask Grok for a topic or type custom prompt..."
          />
          <button
            type="button"
            onClick={handleSendPrompt}
            disabled={isPending}
            className="shrink-0 rounded-full bg-violet-600 px-5 py-2 text-sm hover:bg-violet-500 disabled:opacity-50"
          >
            Send to Grok
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" className="px-3" aria-label="Profile">
            👤
          </button>
          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                await togglePersonalization();
              })
            }
            className="rounded-full bg-amber-500 px-4 py-1 text-xs font-semibold text-zinc-900 hover:bg-amber-400"
          >
            REFINE ALGO
          </button>
        </div>
      </header>

      <div className="feed-scroll flex-1 space-y-8 overflow-auto p-4">
        {visiblePosts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-zinc-400">
            <p className="text-lg">No posts yet</p>
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  await generateNewPost();
                })
              }
              className="mt-4 rounded-full bg-violet-600 px-6 py-2 text-sm text-white"
            >
              Generate your first post
            </button>
          </div>
        ) : (
          visiblePosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              interaction={interactions[post.id]}
            />
          ))
        )}
      </div>

      <footer className="border-t py-4 text-center text-sm text-zinc-400">
        ↓ Keep scrolling •{" "}
        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              await loadMorePosts(2);
            })
          }
          disabled={isPending}
          className="underline hover:text-zinc-200 disabled:opacity-50"
        >
          Load more
        </button>{" "}
        •{" "}
        <span className="text-emerald-400">
          {hasXaiKey
            ? "Live Grok generation enabled"
            : "Add XAI_API_KEY for live Grok generation"}
        </span>
      </footer>
    </main>
  );
}