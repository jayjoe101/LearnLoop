"use client";

import { useState, useTransition, useRef } from "react";
import {
  generateNewPost,
  loadMorePosts,
  refreshFeed,
  togglePersonalization,
} from "@/lib/actions";
import { PostCard } from "@/components/post-card";
import type { Post, PostInteraction } from "@/lib/types";
import { NightNowButton } from "@/components/night-now-button";
import { useScrollFloat } from "@/hooks/use-scroll-float";

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

  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollFloat(scrollRef);

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
      <header className="sticky top-0 z-10 flex items-center justify-between border-b px-6 py-3 border-[var(--border-color)] bg-[var(--bg-header)]">
        <nav className="flex gap-8 text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("for-you")}
            className={
              activeTab === "for-you"
                ? "border-b-2 pb-1 border-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }
          >
            For You
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("following")}
            className={
              activeTab === "following"
                ? "border-b-2 pb-1 border-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
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
                ? "border-b-2 pb-1 border-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
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
            className="w-full max-w-md rounded-full border px-4 py-2 text-sm outline-none border-[var(--border-color)] bg-[var(--bg-input)] placeholder:text-[var(--text-muted)]"
            placeholder="Ask Grok for a topic or type custom prompt..."
          />
          <button
            type="button"
            onClick={handleSendPrompt}
            disabled={isPending}
            className="shrink-0 rounded-full px-5 py-2 text-sm bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:opacity-90 disabled:opacity-50"
          >
            Send to Grok
          </button>
        </div>

        <div className="flex items-center gap-3">
          <NightNowButton />

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
            className="rounded-full bg-[var(--accent-amber)] px-4 py-1 text-xs font-semibold text-[var(--accent-amber-contrast)] hover:opacity-90 floaty-lift"
          >
            REFINE ALGO
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="feed-scroll flex-1 space-y-8 overflow-auto p-4">
        {visiblePosts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-[var(--text-muted)]">
            <p className="text-lg">No posts yet</p>
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  await generateNewPost();
                })
              }
              className="mt-4 rounded-full px-6 py-2 text-sm bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] floaty-lift"
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

      <footer className="border-t py-4 text-center text-sm">
        ↓ Keep scrolling •{" "}
        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              await loadMorePosts(2);
            })
          }
          disabled={isPending}
          className="underline hover:opacity-80 disabled:opacity-50 floaty-lift"
        >
          Load more
        </button>{" "}
        •{" "}
        <span className="text-[var(--accent-emerald)]">
          {hasXaiKey
            ? "Live Grok generation enabled"
            : "Add XAI_API_KEY for live Grok generation"}
        </span>
      </footer>
    </main>
  );
}