"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import {
  fetchPostImageUrl,
  likePost,
  markNotInterested,
} from "@/lib/actions";
import { HeartIcon } from "@/components/icons";
import { PostAuthor } from "@/components/post-author";
import { PostBody } from "@/components/post-body";
import { resolvePostAuthor } from "@/lib/post-author";
import type { FeedStyle, Post, PostInteraction } from "@/lib/types";

type Props = {
  post: Post;
  interaction?: PostInteraction;
  feedStyle?: FeedStyle;
  index?: number;
};

const IMAGE_POLL_DELAYS_MS = [2000, 3000, 2500];

export function PostCard({ post, interaction, feedStyle, index = 0 }: Props) {
  const [isPending, startTransition] = useTransition();
  const [imageUrl, setImageUrl] = useState(post.image_url);
  const [imageSettled, setImageSettled] = useState(!!post.image_url);
  const [likedPulse, setLikedPulse] = useState(false);
  const author = resolvePostAuthor(post);

  const slotOpen = !!imageUrl || !imageSettled;

  useEffect(() => {
    setImageUrl(post.image_url);
    setImageSettled(!!post.image_url);
  }, [post.image_url]);

  useEffect(() => {
    if (imageUrl || imageSettled) return;

    let cancelled = false;
    let attempt = 0;

    const poll = async () => {
      if (cancelled || attempt >= IMAGE_POLL_DELAYS_MS.length) {
        if (!cancelled) setImageSettled(true);
        return;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, IMAGE_POLL_DELAYS_MS[attempt])
      );
      if (cancelled) return;

      const { imageUrl: url } = await fetchPostImageUrl(post.id);
      if (url) {
        setImageUrl(url);
        setImageSettled(true);
        return;
      }

      attempt += 1;
      poll();
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [post.id, imageUrl, imageSettled]);

  function handleLike() {
    if (interaction?.liked) return;

    setLikedPulse(true);
    window.setTimeout(() => setLikedPulse(false), 400);

    startTransition(async () => {
      await likePost(post.id);
    });
  }

  return (
    <article
      className="post-card group feed-post-enter"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <PostAuthor
        name={author.name}
        role={author.role}
        handle={author.handle}
        accent={author.accent}
        topic={post.topic}
        createdAt={post.created_at}
      />

      <div
        className={`post-image-slot ${
          slotOpen ? "post-image-slot--open" : "post-image-slot--closed"
        }`}
        aria-hidden={!slotOpen}
      >
        {imageUrl ? (
          <div className="post-image-frame animate-image-in">
            <Image
              src={imageUrl}
              alt=""
              fill
              className="object-cover transition duration-700 group-hover:scale-[1.02]"
              sizes="(max-width: 640px) 100vw, 640px"
            />
          </div>
        ) : !imageSettled ? (
          <div className="post-image-placeholder">
            <span className="post-image-placeholder-label">{post.topic}</span>
          </div>
        ) : null}
      </div>

      <div className="post-content-after-image">
        <h2 className="post-title">{post.title}</h2>

        <PostBody
          body={post.body}
          links={post.links}
          wikiTerms={post.wiki_terms}
          feedStyle={feedStyle}
          personaId={post.persona_id}
        />
      </div>

      <div className="post-actions">
        <button
          type="button"
          disabled={isPending || interaction?.liked}
          onClick={handleLike}
          className={`btn-tactile post-action-btn ${
            interaction?.liked ? "post-action-btn-active" : ""
          }`}
        >
          <HeartIcon
            className={`h-4 w-4 ${
              likedPulse ? "animate-heart-pop" : ""
            } ${
              interaction?.liked
                ? "fill-[var(--color-coffee-caramel)] text-[var(--color-coffee-caramel)]"
                : ""
            }`}
          />
          <span>{post.likes_count}</span>
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await markNotInterested(post.id);
            })
          }
          className="btn-tactile post-action-btn ml-auto"
        >
          Hide
        </button>
      </div>
    </article>
  );
}