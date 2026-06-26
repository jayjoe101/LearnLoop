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
    <aside className="app-sidebar flex w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-coffee-surface)] p-4">
      <h1 className="flex items-center gap-2 text-3xl font-bold text-[var(--color-coffee-text)]">
        <span aria-hidden>🌀</span> InsightScroll
      </h1>
      <p className="text-xs text-[var(--color-coffee-sage)]">Grok • Always relevant • Infinite value</p>

      <div className="mt-6">
        <div className="flex items-center justify-between font-semibold text-[var(--color-coffee-text)]">
          <h3>Your Topics</h3>
          <button
            type="button"
            onClick={handleAddTopic}
            disabled={isPending}
            className="btn-tactile btn-tactile-secondary rounded px-2 py-0.5 text-xs disabled:opacity-50"
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
              className="chip-tactile btn-tactile disabled:opacity-50"
            >
              {topic.name} ×
            </button>
          ))}
        </div>
      </div>

      {message && (
        <p className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-coffee-elevated)] p-2 text-xs text-[var(--color-coffee-sage)]">
          {message}
        </p>
      )}

      <button
        type="button"
        onClick={handleBeginScroll}
        className="btn-tactile btn-tactile-secondary mt-auto rounded-2xl py-3 font-bold"
      >
        🚀 Begin Doomscroll (Personalized)
      </button>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isPending}
        className="btn-tactile btn-tactile-primary mt-3 flex items-center justify-center gap-2 rounded-2xl py-3 disabled:opacity-50"
      >
        {isPending ? "Generating…" : "✨ Generate new Grok post"}
      </button>
    </aside>
  );
}