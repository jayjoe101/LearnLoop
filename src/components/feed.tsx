"use client";

import { useState, useTransition } from "react";
import { addTopic, generateNewPost, removeTopic } from "@/lib/actions";
import { useLivePosting } from "@/hooks/use-live-posting";
import { PostCard } from "@/components/post-card";
import { PlusIcon, SparkIcon } from "@/components/icons";
import type { FeedStyle, Post, PostInteraction, Topic } from "@/lib/types";

type Props = {
  posts: Post[];
  topics: Topic[];
  interactions: Record<string, PostInteraction>;
  feedStyle?: FeedStyle;
};

export function Feed({ posts, topics, interactions, feedStyle }: Props) {
  const [prompt, setPrompt] = useState("");
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

  function handlePrompt(e: React.FormEvent) {
    e.preventDefault();
    const text = prompt.trim();
    if (!text) return;

    startTransition(async () => {
      await generateNewPost(text);
      setPrompt("");
    });
  }

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
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0c0c0c]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-5 py-4 sm:max-w-2xl">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
              InsightScroll
            </h1>
            <p className="text-xs text-zinc-600">Your feed</p>
          </div>

          <nav className="flex shrink-0 gap-1 rounded-lg bg-white/[0.03] p-0.5">
            {(["all", "saved"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                  filter === tab
                    ? "bg-white/[0.08] text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
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
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                liveOn
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:border-white/15 hover:text-zinc-200"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  liveOn
                    ? "animate-pulse bg-emerald-400"
                    : "bg-zinc-600"
                }`}
                aria-hidden
              />
              Live posting
            </button>
          )}
        </div>

        {filter === "all" && pendingCount > 0 && (
          <div className="flex justify-center border-t border-white/[0.04] py-2">
            <button
              type="button"
              onClick={loadPending}
              className="rounded-full bg-sky-500 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
            >
              Load {pendingCount} new {pendingCount === 1 ? "post" : "posts"}
            </button>
          </div>
        )}

        {filter === "all" && liveOn && pendingCount === 0 && isGenerating && (
          <div className="border-t border-white/[0.04] py-2 text-center text-xs text-zinc-600">
            Brewing a new insight…
          </div>
        )}

        <div className="border-t border-white/[0.04] px-5 py-3 lg:hidden">
          <div className="mx-auto flex max-w-xl flex-wrap gap-1.5 sm:max-w-2xl">
            {topics.map((topic) => (
              <span
                key={topic.id}
                className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-2 py-1 text-xs text-zinc-400"
              >
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
                  className="text-zinc-600 hover:text-zinc-300"
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
                className="w-20 rounded-md border border-white/[0.06] bg-transparent px-2 py-1 text-xs outline-none focus:border-white/15"
              />
              <button type="submit" disabled={!topicInput.trim()} className="text-zinc-500">
                <PlusIcon className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="feed-scroll flex-1 overflow-auto">
        <div className="mx-auto max-w-xl px-5 py-8 sm:max-w-2xl">
          <form onSubmit={handlePrompt} className="mb-10 flex gap-2">
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What do you want to learn about?"
              className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none transition focus:border-white/15 focus:bg-white/[0.03]"
            />
            <button
              type="submit"
              disabled={isPending || !prompt.trim()}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:opacity-40"
            >
              <SparkIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Ask</span>
            </button>
          </form>

          {visiblePosts.length === 0 ? (
            <div className="py-24 text-center">
              <p className="text-sm text-zinc-500">
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
                  className="mt-4 text-sm text-zinc-400 underline-offset-4 transition hover:text-zinc-200 hover:underline"
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