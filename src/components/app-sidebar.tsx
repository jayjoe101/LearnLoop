"use client";

import { useState, useTransition } from "react";
import { addTopic, generateNewPost, removeTopic, updateFeedStyle } from "@/lib/actions";
import { PlusIcon, SparkIcon } from "@/components/icons";
import type { FeedStyle, Profile, Topic } from "@/lib/types";

const STYLES: { value: FeedStyle; label: string }[] = [
  { value: "Balanced & insightful", label: "Balanced" },
  { value: "Deep technical", label: "Technical" },
  { value: "Fun + surprising", label: "Playful" },
  { value: "Actionable life upgrade", label: "Practical" },
];

type Props = {
  topics: Topic[];
  profile: Profile | null;
};

export function AppSidebar({ topics, profile }: Props) {
  const [isPending, startTransition] = useTransition();
  const [topicInput, setTopicInput] = useState("");
  const currentStyle = profile?.feed_style ?? "Balanced & insightful";

  function submitTopic(e: React.FormEvent) {
    e.preventDefault();
    const name = topicInput.trim();
    if (!name) return;

    startTransition(async () => {
      await addTopic(name);
      setTopicInput("");
    });
  }

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-white/[0.06] lg:flex">
      <div className="px-5 py-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
          InsightScroll
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-8 px-5">
        <section>
          <p className="mb-3 text-xs font-medium text-zinc-500">Interests</p>
          <div className="flex flex-wrap gap-1.5">
            {topics.map((topic) => (
              <span
                key={topic.id}
                className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-2 py-1 text-xs text-zinc-300"
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
                  className="text-zinc-600 transition hover:text-zinc-300 disabled:opacity-40"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <form onSubmit={submitTopic} className="mt-3 flex gap-1.5">
            <input
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder="Add topic"
              className="min-w-0 flex-1 rounded-md border border-white/[0.06] bg-transparent px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-white/15"
            />
            <button
              type="submit"
              disabled={isPending || !topicInput.trim()}
              className="rounded-md border border-white/[0.06] p-1.5 text-zinc-400 transition hover:border-white/15 hover:text-zinc-200 disabled:opacity-40"
              aria-label="Add topic"
            >
              <PlusIcon className="h-3.5 w-3.5" />
            </button>
          </form>
        </section>

        <section>
          <p className="mb-3 text-xs font-medium text-zinc-500">Tone</p>
          <div className="flex flex-col gap-0.5">
            {STYLES.map((style) => (
              <button
                key={style.value}
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await updateFeedStyle(style.value);
                  })
                }
                className={`rounded-md px-2.5 py-2 text-left text-xs transition disabled:opacity-40 ${
                  currentStyle === style.value
                    ? "bg-white/[0.06] text-zinc-100"
                    : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
                }`}
              >
                {style.label}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="border-t border-white/[0.06] p-5">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await generateNewPost();
            })
          }
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 py-2.5 text-xs font-medium text-zinc-900 transition hover:bg-white disabled:opacity-50"
        >
          <SparkIcon className="h-3.5 w-3.5" />
          {isPending ? "Generating…" : "New insight"}
        </button>
      </div>
    </aside>
  );
}