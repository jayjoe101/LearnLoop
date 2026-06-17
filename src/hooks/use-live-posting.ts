"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generateLivePost } from "@/lib/actions";
import { appendFingerprint } from "@/lib/dedup";
import {
  nextLiveDelayMs,
  randomPendingPostLimit,
  type LiveSessionContext,
} from "@/lib/live-posting";
import type { Post } from "@/lib/types";

export function useLivePosting(initialPosts: Post[]) {
  const [liveOn, setLiveOn] = useState(false);
  const [displayedPosts, setDisplayedPosts] = useState(initialPosts);
  const [pendingPosts, setPendingPosts] = useState<Post[]>([]);

  const liveOnRef = useRef(liveOn);
  const sessionRef = useRef<LiveSessionContext>({
    recentTitles: [],
    recentSubjects: [],
    recentFingerprints: [],
    postCountOffset: 0,
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCountRef = useRef(0);
  const pendingLimitRef = useRef(randomPendingPostLimit());

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

      if (pendingCountRef.current >= pendingLimitRef.current) {
        timerRef.current = setTimeout(() => {
          if (liveOnRef.current) scheduleNext();
        }, 12_000);
        return;
      }

      const result = await generateLivePost(sessionRef.current);

      if ("post" in result && result.post) {
        const post = result.post;
        sessionRef.current = {
          recentTitles: [...sessionRef.current.recentTitles, post.title].slice(
            -12
          ),
          recentSubjects: [
            ...sessionRef.current.recentSubjects,
            ...(post.wiki_terms ?? []).map((w) => w.term),
            post.title,
          ].slice(-16),
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
    pendingLimitRef.current = randomPendingPostLimit();

    setDisplayedPosts((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      const fresh = pendingPosts.filter((p) => !seen.has(p.id));
      return [...fresh, ...prev];
    });
    setPendingPosts([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pendingPosts]);

  const toggleLive = useCallback(() => {
    setLiveOn((on) => {
      const next = !on;
      if (next) {
        pendingLimitRef.current = randomPendingPostLimit();
      }
      return next;
    });
  }, []);

  return {
    liveOn,
    toggleLive,
    displayedPosts,
    pendingPosts,
    pendingCount: pendingPosts.length,
    loadPending,
  };
}