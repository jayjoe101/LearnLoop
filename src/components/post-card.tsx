"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import {
  fetchPostImageUrl,
  likePost,
  markNotInterested,
} from "@/lib/actions";
import { EyeOffIcon, HeartIcon } from "@/components/icons";
import { useActionTooltip } from "@/hooks/use-action-tooltip";
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

const IMAGE_POLL_DELAYS_MS = [1200, 1800, 2400];

export function PostCard({ post, interaction, feedStyle, index = 0 }: Props) {
  const [isPending, startTransition] = useTransition();
  const [imageUrl, setImageUrl] = useState(post.image_url);
  const expectsImage = post.wants_image === true;
  const [imageSettled, setImageSettled] = useState(
    !!post.image_url || !expectsImage
  );
  const [likedPulse, setLikedPulse] = useState(false);
  const likeTooltip = useActionTooltip({
    label: interaction?.liked ? "Liked" : "Like",
    placement: "above",
  });
  const hideTooltip = useActionTooltip({
    label: "Hide post",
    placement: "above",
  });
  const author = resolvePostAuthor(post);

  const showImageSlot =
    !!imageUrl || (expectsImage && !imageSettled);

  useEffect(() => {
    setImageUrl(post.image_url);
    setImageSettled(!!post.image_url || !expectsImage);
  }, [post.image_url, expectsImage]);

  useEffect(() => {
    if (!expectsImage || imageUrl || imageSettled) return;

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
  }, [post.id, expectsImage, imageUrl, imageSettled]);

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
      data-post-id={post.id}
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

      {showImageSlot ? (
        <div
          className={`post-image-slot ${
            showImageSlot ? "post-image-slot--open" : "post-image-slot--closed"
          }`}
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
          ) : (
            <div className="post-image-placeholder">
              <span className="post-image-placeholder-label">{post.topic}</span>
            </div>
          )}
        </div>
      ) : null}

      <div className="post-content-after-image">
        <h2 className="post-title" data-post-selectable>
          {post.title}
        </h2>

        <PostBody
          body={post.body}
          links={post.links}
          wikiTerms={post.wiki_terms}
          feedStyle={feedStyle}
          personaId={post.persona_id}
        />
      </div>

      <div className="post-actions">
        <>
          <button
            ref={likeTooltip.anchorRef}
            type="button"
            disabled={isPending || interaction?.liked}
            onClick={handleLike}
            aria-label={interaction?.liked ? "Liked" : "Like post"}
            aria-describedby={likeTooltip.describedBy}
            {...likeTooltip.handlers}
            className={`btn-tactile post-action-btn post-action-btn--like ${
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
          {likeTooltip.tooltipPortal}
        </>

        <>
          <button
            ref={hideTooltip.anchorRef}
            type="button"
            disabled={isPending}
            aria-label="Hide post"
            aria-describedby={hideTooltip.describedBy}
            {...hideTooltip.handlers}
            onClick={() =>
              startTransition(async () => {
                await markNotInterested(post.id);
              })
            }
            className="btn-tactile post-action-btn post-action-btn--hide ml-auto"
          >
            <EyeOffIcon className="h-4 w-4" />
          </button>
          {hideTooltip.tooltipPortal}
        </>
      </div>
    </article>
  );
}