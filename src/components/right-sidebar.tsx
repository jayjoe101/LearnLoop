"use client";

import { useTransition } from "react";
import { generateNewPost, updateFeedStyle } from "@/lib/actions";
import type { FeedStyle, Profile } from "@/lib/types";

const STYLES: FeedStyle[] = [
  "Balanced & insightful",
  "Deep technical",
  "Fun + surprising",
  "Actionable life upgrade",
];

type Props = {
  profile: Profile | null;
};

export function RightSidebar({ profile }: Props) {
  const [isPending, startTransition] = useTransition();
  const currentStyle = profile?.feed_style ?? "Balanced & insightful";

  return (
    <aside className="w-80 space-y-6 border-l border-zinc-700 p-4">
      <h2 className="font-bold">Grok Controls</h2>

      <select
        value={currentStyle}
        onChange={(e) =>
          startTransition(async () => {
            await updateFeedStyle(e.target.value as FeedStyle);
          })
        }
        disabled={isPending}
        className="w-full rounded-xl bg-zinc-800 p-3 outline-none ring-violet-500 focus:ring-1 disabled:opacity-50"
      >
        {STYLES.map((style) => (
          <option key={style} value={style}>
            {style}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() =>
          startTransition(async () => {
            await generateNewPost(
              "Make the next post extremely relevant to my topics and past likes."
            );
          })
        }
        disabled={isPending}
        className="w-full rounded-xl bg-emerald-500 py-3 font-bold text-zinc-900 hover:bg-emerald-400 disabled:opacity-50"
      >
        💡 Make feed 10× more relevant
      </button>

      <div className="pt-4">
        <h3 className="font-semibold">Trending in your bubble</h3>
        <ul className="mt-3 space-y-3 text-sm text-zinc-300">
          <li>• Why black holes &quot;sing&quot; (new JWST data) 🔥</li>
          <li>• The productivity hack used by top AI researchers</li>
          <li>• Ancient Rome&apos;s accidental startup incubator</li>
        </ul>
      </div>

      <div className="rounded-xl border border-dashed border-zinc-600 p-3 text-xs text-zinc-400">
        <p className="font-medium text-zinc-300">🔌 Connect real xAI API</p>
        <p className="mt-2">
          Add <code className="text-violet-300">XAI_API_KEY</code> to your Vercel
          project env vars. Without it, posts use smart templates seeded from your
          topics.
        </p>
        {profile?.personalization_enabled && (
          <p className="mt-2 text-emerald-400">Personalization: ON</p>
        )}
      </div>

      <footer className="text-[10px] text-zinc-500">
        InsightScroll • Next.js + Supabase • Deploy on Vercel
      </footer>
    </aside>
  );
}