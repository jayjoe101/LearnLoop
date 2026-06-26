"use client";

import { useEffect, RefObject } from "react";

/**
 * useScrollFloat
 * Attaches a passive scroll listener to the element.
 * Sets CSS var --scroll-y for floaty scroll-tied transforms in CSS.
 * Properly cleans up listener on unmount/re-render.
 */
export function useScrollFloat(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handler = () => {
      el.style.setProperty("--scroll-y", String(el.scrollTop || 0));
    };

    el.addEventListener("scroll", handler, { passive: true });
    // initial
    handler();

    return () => {
      el.removeEventListener("scroll", handler);
    };
  }, [ref]);
}
