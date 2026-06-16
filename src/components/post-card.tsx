"use client";

import Image from "next/image";
import { useTransition } from "react";
import {
  generateNewPost,
  likePost,
  markNotInterested,
  savePost,
} from "@/lib/actions";
import type { Post, PostInteraction } from "@/lib/types";

type Props = {
  post: Post;
  interaction?: PostInteraction;
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function PostCard({ post, interaction }: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <article className="post-card overflow-hidden rounded-3xl border border-zinc-700 bg-zinc-900">
      <div className="flex justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-emerald-400 text-xs">
            🌀
          </div>
          <div className="text-sm">
            <span className="font-semibold">GrokCurator</span>
            <span className="text-zinc-500">
              {" "}
              • {post.topic} • {timeAgo(post.created_at)}
            </span>
          </div>
        </div>
        <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-bold text-zinc-950">
          {post.topic}
        </span>
      </div>

      {post.image_url && (
        <div className="relative h-64 w-full">
          <Image
            src={post.image_url}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 60vw"
          />
        </div>
      )}

      <div className="p-4">
        <h2 className="text-xl font-bold leading-tight">{post.title}</h2>
        <p className="mt-3 text-zinc-300">{post.body}</p>
        <div className="mt-4 flex flex-wrap gap-6 text-lg">
          <button
            type="button"
            disabled={isPending || interaction?.liked}
            onClick={() =>
              startTransition(async () => {
                await likePost(post.id);
              })
            }
            className="flex items-center gap-1 hover:text-red-400 disabled:opacity-60"
          >
            {interaction?.liked ? "❤️" : "🤍"}{" "}
            <span>{post.likes_count}</span>
          </button>
          <span className="flex items-center gap-1">💬 {post.comments_count}</span>
          <button
            type="button"
            disabled={isPending || interaction?.saved}
            onClick={() =>
              startTransition(async () => {
                await savePost(post.id);
              })
            }
            className="hover:text-amber-300 disabled:opacity-60"
          >
            {interaction?.saved ? "🔖 Saved" : "🔖 Save to notes"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await markNotInterested(post.id);
              })
            }
            className="text-zinc-400 hover:text-zinc-200"
          >
            🙅 Not for me
          </button>
        </div>
      </div>

      <div className="flex justify-around bg-zinc-800 p-3 text-xs font-medium">
        <button
          type="button"
          onClick={() =>
            window.alert(
              "Deep dive opens a Grok reasoning thread — connect XAI_API_KEY for live mode."
            )
          }
          className="hover:text-violet-300"
        >
          🔎 Deep dive with Grok
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await generateNewPost(`Remix and expand on: ${post.title}`);
            })
          }
          className="hover:text-emerald-300 disabled:opacity-50"
        >
          🔄 Remix this post
        </button>
      </div>
    </article>
  );
}