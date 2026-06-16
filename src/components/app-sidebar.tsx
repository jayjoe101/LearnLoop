"use client";

import { useState, useTransition } from "react";
import { addTopic, generateNewPost, removeTopic } from "@/lib/actions";
import { PlusIcon, SparkIcon } from "@/components/icons";
import type { Topic } from "@/lib/types";

type Props = {
  topics: Topic[];
};

export function AppSidebar({ topics }: Props) {
  const [isPending, startTransition] = useTransition();
  const [topicInput, setTopicInput] = useState("");

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
    <aside className="hidden w-56 shrink-0 flex-col border-r border-[var(--color-border)] lg:flex">
      <div className="px-5 py-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--color-coffee-text-soft)]">
          LearnLoop
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-8 px-5">
        <section>
          <p className="mb-3 text-xs font-medium text-[var(--color-coffee-mocha)]">
            Interests
          </p>
          <div className="flex flex-wrap gap-1.5">
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
          </div>
          <form onSubmit={submitTopic} className="mt-3 flex gap-1.5">
            <input
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder="Add topic"
              className="onboarding-input min-w-0 flex-1 px-2.5 py-1.5 text-xs"
            />
            <button
              type="submit"
              disabled={isPending || !topicInput.trim()}
              className="btn-tactile icon-btn p-1.5 disabled:opacity-40"
              aria-label="Add topic"
            >
              <PlusIcon className="h-3.5 w-3.5" />
            </button>
          </form>
        </section>
      </div>

      <div className="border-t border-[var(--color-border)] p-5">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await generateNewPost();
            })
          }
          className="btn-tactile btn-tactile-primary flex w-full items-center justify-center gap-2 px-4 py-2.5 text-xs"
        >
          <SparkIcon className="h-3.5 w-3.5" />
          {isPending ? "Generating…" : "New insight"}
        </button>
      </div>
    </aside>
  );
}