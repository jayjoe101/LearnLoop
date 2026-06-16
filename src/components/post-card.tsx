"use client";

import Image from "next/image";
import { useTransition } from "react";
import {
  generateNewPost,
  likePost,
  markNotInterested,
  savePost,
} from "@/lib/actions";
import { BookmarkIcon, HeartIcon } from "@/components/icons";
import { PostAuthor } from "@/components/post-author";
import { resolvePostAuthor } from "@/lib/post-author";
import type { Post, PostInteraction } from "@/lib/types";

type Props = {
  post: Post;
  interaction?: PostInteraction;
};

export function PostCard({ post, interaction }: Props) {
  const [isPending, startTransition] = useTransition();
  const author = resolvePostAuthor(post);

  return (
    <article className="post-card group">
      <PostAuthor
        name={author.name}
        role={author.role}
        handle={author.handle}
        accent={author.accent}
        topic={post.topic}
        createdAt={post.created_at}
      />

      {post.image_url && (
        <div className="relative mb-5 aspect-[16/9] overflow-hidden rounded-lg bg-white/[0.02]">
          <Image
            src={post.image_url}
            alt=""
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.02]"
            sizes="(max-width: 640px) 100vw, 640px"
          />
        </div>
      )}

      <h2 className="text-xl font-semibold leading-snug tracking-tight text-zinc-50 sm:text-2xl">
        {post.title}
      </h2>

      <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">{post.body}</p>

      <div className="mt-5 flex items-center gap-4 border-t border-white/[0.06] pt-4">
        <button
          type="button"
          disabled={isPending || interaction?.liked}
          onClick={() =>
            startTransition(async () => {
              await likePost(post.id);
            })
          }
          className="flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-200 disabled:opacity-40"
        >
          <HeartIcon
            className={`h-4 w-4 ${interaction?.liked ? "fill-zinc-300 text-zinc-300" : ""}`}
          />
          <span>{post.likes_count}</span>
        </button>

        <button
          type="button"
          disabled={isPending || interaction?.saved}
          onClick={() =>
            startTransition(async () => {
              await savePost(post.id);
            })
          }
          className="flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-200 disabled:opacity-40"
        >
          <BookmarkIcon
            className={`h-4 w-4 ${interaction?.saved ? "fill-zinc-300 text-zinc-300" : ""}`}
          />
          <span>{interaction?.saved ? "Saved" : "Save"}</span>
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await generateNewPost(`Expand on: ${post.title}`);
            })
          }
          className="ml-auto text-xs text-zinc-600 transition hover:text-zinc-300 disabled:opacity-40"
        >
          Go deeper
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await markNotInterested(post.id);
            })
          }
          className="text-xs text-zinc-600 transition hover:text-zinc-400 disabled:opacity-40"
        >
          Hide
        </button>
      </div>
    </article>
  );
}