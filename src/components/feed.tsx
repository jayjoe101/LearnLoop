"use client";

import { useState, useTransition } from "react";
import { addTopic, generateNewPost, removeTopic } from "@/lib/actions";
import { useLivePosting } from "@/hooks/use-live-posting";
import { PostCard } from "@/components/post-card";
import { PlusIcon } from "@/components/icons";
import type { FeedStyle, Post, PostInteraction, Topic } from "@/lib/types";

type Props = {
  posts: Post[];
  topics: Topic[];
  interactions: Record<string, PostInteraction>;
  feedStyle?: FeedStyle;
};

export function Feed({ posts, topics, interactions, feedStyle }: Props) {
  const [topicInput, setTopicInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<"all" | "saved">("all");

  const {
    liveOn,
    toggleLive,
    displayedPosts,
    pendingCount,
    loadPending,
    isGenerating,
  } = useLivePosting(posts);

  const visiblePosts =
    filter === "saved"
      ? displayedPosts.filter((p) => interactions[p.id]?.saved)
      : displayedPosts.filter((p) => !interactions[p.id]?.not_interested);

  function handleAddTopic(e: React.FormEvent) {
    e.preventDefault();
    const name = topicInput.trim();
    if (!name) return;

    startTransition(async () => {
      await addTopic(name);
      setTopicInput("");
    });
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="surface-panel sticky top-0 z-20 border-b">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-5 py-4 sm:max-w-2xl">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold tracking-tight text-[var(--color-coffee-text)]">
              LearnLoop
            </h1>
            <p className="text-xs text-[var(--color-coffee-mocha)]">Your feed</p>
          </div>

          <nav className="tab-tactile-group shrink-0">
            {(["all", "saved"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`tab-tactile capitalize ${
                  filter === tab ? "tab-tactile-active" : ""
                }`}
              >
                {tab === "all" ? "Feed" : "Saved"}
              </button>
            ))}
          </nav>

          {filter === "all" && (
            <button
              type="button"
              onClick={toggleLive}
              className={`btn-tactile btn-tactile-pill flex shrink-0 items-center gap-2 px-3 py-1.5 text-xs font-medium ${
                liveOn
                  ? "border-[rgba(109,138,90,0.35)] bg-[rgba(109,138,90,0.12)] text-[var(--color-coffee-sage)]"
                  : "btn-tactile-ghost"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  liveOn
                    ? "animate-pulse bg-[var(--color-coffee-sage)]"
                    : "bg-[var(--color-coffee-taupe)]"
                }`}
                aria-hidden
              />
              Live posting
            </button>
          )}
        </div>

        {filter === "all" && pendingCount > 0 && (
          <div className="flex justify-center border-t border-[var(--color-border)] py-2.5">
            <button
              type="button"
              onClick={loadPending}
              className="btn-tactile btn-tactile-accent btn-tactile-pill px-4 py-1.5 text-xs"
            >
              Load {pendingCount} new {pendingCount === 1 ? "post" : "posts"}
            </button>
          </div>
        )}

        {filter === "all" && liveOn && pendingCount === 0 && isGenerating && (
          <div className="border-t border-[var(--color-border)] py-2 text-center text-xs text-[var(--color-coffee-mocha)]">
            Brewing a new insight…
          </div>
        )}

        <div className="border-t border-[var(--color-border)] px-5 py-3 lg:hidden">
          <div className="mx-auto flex max-w-xl flex-wrap gap-1.5 sm:max-w-2xl">
            {topics.map((topic) => (
              <span key={topic.id} className="chip-tactile">
                {topic.name}
                <button
                  type="button"
                  aria-label={`Remove ${topic.name}`}
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await removeTopic(topic.id);
                    })
                  }
                  className="icon-btn border-0 bg-transparent p-0 shadow-none text-[var(--color-coffee-taupe)] hover:text-[var(--color-coffee-text)]"
                >
                  ×
                </button>
              </span>
            ))}
            <form onSubmit={handleAddTopic} className="flex items-center gap-1">
              <input
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                placeholder="Topic"
                className="onboarding-input w-20 px-2 py-1 text-xs"
              />
              <button
                type="submit"
                disabled={!topicInput.trim()}
                className="btn-tactile icon-btn p-1.5"
              >
                <PlusIcon className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="feed-scroll flex-1 overflow-auto">
        <div className="mx-auto max-w-xl px-5 py-8 sm:max-w-2xl">
          {visiblePosts.length === 0 ? (
            <div className="py-24 text-center">
              <p className="text-sm text-[var(--color-coffee-mocha)]">
                {filter === "saved" ? "Nothing saved yet" : "Your feed is empty"}
              </p>
              {filter === "all" && (
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      await generateNewPost();
                    })
                  }
                  disabled={isPending}
                  className="btn-tactile btn-tactile-secondary btn-tactile-pill mt-6 px-5 py-2 text-sm"
                >
                  Generate an insight
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-14">
              {visiblePosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  interaction={interactions[post.id]}
                  feedStyle={feedStyle}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}