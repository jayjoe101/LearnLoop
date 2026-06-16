"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import {
  fetchPostImageUrl,
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

const IMAGE_POLL_DELAYS_MS = [1500, 2500, 3500, 5000];

export function PostCard({ post, interaction, feedStyle }: Props) {
  const [isPending, startTransition] = useTransition();
  const [imageUrl, setImageUrl] = useState(post.image_url);
  const author = resolvePostAuthor(post);

  useEffect(() => {
    setImageUrl(post.image_url);
  }, [post.image_url]);

  useEffect(() => {
    if (imageUrl) return;

    let cancelled = false;
    let attempt = 0;

    const poll = async () => {
      if (cancelled || attempt >= IMAGE_POLL_DELAYS_MS.length) return;

      await new Promise((resolve) =>
        setTimeout(resolve, IMAGE_POLL_DELAYS_MS[attempt])
      );
      if (cancelled) return;

      const { imageUrl: url } = await fetchPostImageUrl(post.id);
      if (url) {
        setImageUrl(url);
        return;
      }

      attempt += 1;
      poll();
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [post.id, imageUrl]);

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

      {imageUrl ? (
        <div className="post-image-frame">
          <Image
            src={imageUrl}
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
            className={`h-4 w-4 ${interaction?.liked ? "fill-[var(--color-coffee-caramel)] text-[var(--color-coffee-caramel)]" : ""}`}
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
            className={`h-4 w-4 ${interaction?.saved ? "fill-[var(--color-coffee-caramel)] text-[var(--color-coffee-caramel)]" : ""}`}
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