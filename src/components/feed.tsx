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

type FeedFilter = "all" | "liked";

export function Feed({ posts, topics, interactions, feedStyle }: Props) {
  const [topicInput, setTopicInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<FeedFilter>("all");

  const {
    liveOn,
    toggleLive,
    displayedPosts,
    pendingCount,
    loadPending,
  } = useLivePosting(posts);

  const visiblePosts =
    filter === "liked"
      ? displayedPosts.filter((p) => interactions[p.id]?.liked)
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
    <div className="flex min-h-screen flex-1 flex-col animate-fade-in">
      <header className="surface-panel sticky top-0 z-20 border-b">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-5 py-4 sm:max-w-2xl">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold tracking-tight text-[var(--color-coffee-text)]">
              LearnLoop
            </h1>
            <p className="text-xs text-[var(--color-coffee-mocha)]">Your feed</p>
          </div>

          <nav className="tab-tactile-group shrink-0">
            {(
              [
                { id: "all" as const, label: "Feed" },
                { id: "liked" as const, label: "Liked" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`tab-tactile ${
                  filter === tab.id ? "tab-tactile-active" : ""
                }`}
              >
                {tab.label}
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
                className={`h-2 w-2 rounded-full transition-transform duration-300 ${
                  liveOn
                    ? "animate-pulse bg-[var(--color-coffee-sage)] scale-110"
                    : "bg-[var(--color-coffee-taupe)]"
                }`}
                aria-hidden
              />
              Live posting
            </button>
          )}
        </div>

        <div
          className={`live-pending-banner border-t border-[var(--color-border)] ${
            filter === "all" && pendingCount > 0
              ? "live-pending-banner--visible"
              : ""
          }`}
        >
          <div className="flex justify-center py-2.5">
            <button
              type="button"
              onClick={loadPending}
              className="btn-tactile btn-tactile-accent btn-tactile-pill animate-banner-in px-4 py-1.5 text-xs"
            >
              Load {pendingCount} new {pendingCount === 1 ? "post" : "posts"}
            </button>
          </div>
        </div>

        <div className="border-t border-[var(--color-border)] px-5 py-3 lg:hidden">
          <div className="mx-auto flex max-w-xl flex-wrap gap-1.5 sm:max-w-2xl">
            {topics.map((topic) => (
              <button
                key={topic.id}
                type="button"
                disabled={isPending}
                aria-label={`Remove ${topic.name} from interests`}
                onClick={() =>
                  startTransition(async () => {
                    await removeTopic(topic.id);
                  })
                }
                className="chip-tactile btn-tactile"
              >
                {topic.name}
              </button>
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
            <div className="feed-empty-enter py-24 text-center">
              <p className="text-sm text-[var(--color-coffee-mocha)]">
                {filter === "liked"
                  ? "No liked posts yet"
                  : "Your feed is empty"}
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
              {visiblePosts.map((post, index) => (
                <PostCard
                  key={post.id}
                  post={post}
                  interaction={interactions[post.id]}
                  feedStyle={feedStyle}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}