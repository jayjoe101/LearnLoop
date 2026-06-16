"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import {
  generateNewPost,
  likePost,
  markNotInterested,
  savePost,
} from "@/lib/actions";
import { BookmarkIcon, HeartIcon } from "@/components/icons";
import { PostAuthor } from "@/components/post-author";
import { PostBody } from "@/components/post-body";
import { resolvePostAuthor } from "@/lib/post-author";
import type { FeedStyle, Post, PostInteraction } from "@/lib/types";

type Props = {
  post: Post;
  interaction?: PostInteraction;
  feedStyle?: FeedStyle;
};

export function PostCard({ post, interaction, feedStyle }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const author = resolvePostAuthor(post);

  useEffect(() => {
    if (post.image_url) return;

    const timer = window.setTimeout(() => router.refresh(), 3500);
    return () => window.clearTimeout(timer);
  }, [post.id, post.image_url, router]);

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

      {post.image_url ? (
        <div className="post-image-frame">
          <Image
            src={post.image_url}
            alt=""
            fill
            className="object-cover transition duration-700 group-hover:scale-[1.02]"
            sizes="(max-width: 640px) 100vw, 640px"
          />
        </div>
      ) : (
        <div className="post-image-placeholder" aria-hidden>
          <span className="post-image-placeholder-label">{post.topic}</span>
        </div>
      )}

      <h2 className="post-title">{post.title}</h2>

      <PostBody
        body={post.body}
        links={post.links}
        wikiTerms={post.wiki_terms}
        feedStyle={feedStyle}
        personaId={post.persona_id}
      />

      <div className="post-actions">
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