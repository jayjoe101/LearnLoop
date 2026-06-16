"use client";

import { useState, useTransition } from "react";
import { addTopic, generateNewPost, removeTopic } from "@/lib/actions";
import type { Topic } from "@/lib/types";

type Props = {
  topics: Topic[];
};

export function LeftSidebar({ topics }: Props) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleAddTopic() {
    const name = window.prompt(
      "New interest (e.g. Behavioral Economics, Quantum Computing)?"
    );
    if (!name?.trim()) return;

    startTransition(async () => {
      const result = await addTopic(name);
      if (result.error) setMessage(result.error);
      else setMessage(`Added "${name}" — future posts will include it.`);
    });
  }

  function handleGenerate() {
    startTransition(async () => {
      await generateNewPost();
      setMessage("Fresh Grok post generated!");
    });
  }

  function handleBeginScroll() {
    setMessage("Feed locked to your topics. Scroll away!");
  }

  return (
    <aside className="flex w-64 flex-col border-r border-zinc-700 p-4">
      <h1 className="flex items-center gap-2 text-3xl font-bold">
        <span aria-hidden>🌀</span> InsightScroll
      </h1>
      <p className="text-xs text-emerald-400">Grok • Always relevant • Infinite value</p>

      <div className="mt-6">
        <div className="flex items-center justify-between font-semibold">
          <h3>Your Topics</h3>
          <button
            type="button"
            onClick={handleAddTopic}
            disabled={isPending}
            className="rounded bg-zinc-700 px-2 text-xs hover:bg-zinc-600 disabled:opacity-50"
          >
            + Add
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {topics.map((topic) => (
            <button
              key={topic.id}
              type="button"
              onClick={() =>
                startTransition(async () => {
                  await removeTopic(topic.id);
                  setMessage(`Removed "${topic.name}" from your feed.`);
                })
              }
              disabled={isPending}
              className="rounded-full bg-zinc-700 px-3 py-1 text-xs hover:bg-zinc-600 disabled:opacity-50"
            >
              {topic.name} ×
            </button>
          ))}
        </div>
      </div>

      {message && (
        <p className="mt-4 rounded-lg bg-zinc-800 p-2 text-xs text-emerald-300">
          {message}
        </p>
      )}

      <button
        type="button"
        onClick={handleBeginScroll}
        className="mt-auto rounded-2xl bg-white py-3 font-bold text-zinc-900 hover:bg-zinc-100"
      >
        🚀 Begin Doomscroll (Personalized)
      </button>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isPending}
        className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-violet-500 py-3 text-violet-400 hover:bg-violet-500/10 disabled:opacity-50"
      >
        {isPending ? "Generating…" : "✨ Generate new Grok post"}
      </button>
    </aside>
  );
}