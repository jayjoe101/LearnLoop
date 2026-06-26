"use client";

import type { Topic } from "@/lib/types";

type Props = {
  topics: Topic[];
};

export function AppSidebar({ topics }: Props) {
  return (
    <aside className="app-sidebar hidden w-56 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-coffee-surface)] lg:flex">
      <div className="px-5 py-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--color-coffee-text)]">
          InsightScroll
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-8 px-5">
        <section>
          <p className="mb-3 text-xs font-medium text-[var(--color-coffee-text-soft)]">
            Interests
          </p>
          <div className="flex flex-wrap gap-1.5">
            {topics.map((topic) => (
              <button key={topic.id} className="chip-tactile btn-tactile" disabled>
                {topic.name}
              </button>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}