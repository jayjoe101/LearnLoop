"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generateLivePost } from "@/lib/actions";
import { appendFingerprint } from "@/lib/dedup";
import {
  MAX_PENDING_LIVE_POSTS,
  nextLiveDelayMs,
  type LiveSessionContext,
} from "@/lib/live-posting";
import type { Post } from "@/lib/types";

export function useLivePosting(initialPosts: Post[]) {
  const [liveOn, setLiveOn] = useState(false);
  const [displayedPosts, setDisplayedPosts] = useState(initialPosts);
  const [pendingPosts, setPendingPosts] = useState<Post[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const liveOnRef = useRef(liveOn);
  const sessionRef = useRef<LiveSessionContext>({
    recentTitles: [],
    recentFingerprints: [],
    postCountOffset: 0,
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCountRef = useRef(0);

  useEffect(() => {
    liveOnRef.current = liveOn;
  }, [liveOn]);

  useEffect(() => {
    pendingCountRef.current = pendingPosts.length;
  }, [pendingPosts.length]);

  useEffect(() => {
    if (pendingCountRef.current > 0) return;
    setDisplayedPosts(initialPosts);
  }, [initialPosts]);

  const scheduleNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      if (!liveOnRef.current) return;

      if (pendingCountRef.current >= MAX_PENDING_LIVE_POSTS) {
        timerRef.current = setTimeout(() => {
          if (liveOnRef.current) scheduleNext();
        }, 12_000);
        return;
      }

      setIsGenerating(true);
      const result = await generateLivePost(sessionRef.current);
      setIsGenerating(false);

      if ("post" in result && result.post) {
        const post = result.post;
        sessionRef.current = {
          recentTitles: [...sessionRef.current.recentTitles, post.title].slice(
            -12
          ),
          recentFingerprints: appendFingerprint(
            sessionRef.current.recentFingerprints,
            post.title,
            post.body
          ).slice(-12),
          postCountOffset: sessionRef.current.postCountOffset + 1,
        };

        setPendingPosts((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          if (ids.has(post.id)) return prev;
          return [post, ...prev];
        });
      }

      if (liveOnRef.current) scheduleNext();
    }, nextLiveDelayMs());
  }, []);

  useEffect(() => {
    if (liveOn) {
      scheduleNext();
    } else if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [liveOn, scheduleNext]);

  const loadPending = useCallback(() => {
    setDisplayedPosts((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      const fresh = pendingPosts.filter((p) => !seen.has(p.id));
      return [...fresh, ...prev];
    });
    setPendingPosts([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pendingPosts]);

  const toggleLive = useCallback(() => {
    setLiveOn((on) => !on);
  }, []);

  return {
    liveOn,
    toggleLive,
    displayedPosts,
    pendingPosts,
    pendingCount: pendingPosts.length,
    loadPending,
    isGenerating,
  };
}