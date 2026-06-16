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

    const timer = window.setTimeout(() => router.refresh(), 2000);
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
          className={`btn-tactile post-action-btn ${
            interaction?.liked ? "post-action-btn-active" : ""
          }`}
        >
          <HeartIcon
            className={`h-4 w-4 ${interaction?.liked ? "fill-[var(--color-coffee-honey)] text-[var(--color-coffee-honey)]" : ""}`}
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
          className={`btn-tactile post-action-btn ${
            interaction?.saved ? "post-action-btn-active" : ""
          }`}
        >
          <BookmarkIcon
            className={`h-4 w-4 ${interaction?.saved ? "fill-[var(--color-coffee-honey)] text-[var(--color-coffee-honey)]" : ""}`}
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
          className="btn-tactile post-action-btn ml-auto"
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
          className="btn-tactile post-action-btn"
        >
          Hide
        </button>
      </div>
    </article>
  );
}