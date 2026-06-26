"use client";

import { useEffect } from "react";

/**
 * FloatyCursor
 * Premium lagged custom cursor.
 * - RAF + LAG lerp for floaty follow (not instant snap)
 * - Scales on interactive elements for "magnetic" feel
 * - Full cleanup: remove listeners + cancelAnimationFrame on unmount
 * - Respects prefers-reduced-motion
 */
export function FloatyCursor() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;

    const cursor = document.createElement("div");
    cursor.className = "custom-cursor";
    cursor.setAttribute("aria-hidden", "true");
    document.body.appendChild(cursor);

    // Hide native cursor so the custom lagged one *is* the cursor (makes it feel floaty per AC1)
    document.body.style.cursor = "none";

    let mx = 0, my = 0, cx = 0, cy = 0, targetScale = 1, curScale = 1;
    const LAG = 0.16;
    const SCALE_LAG = 0.22;

    const INTERACTIVE =
      'button,a,[role="button"],.btn-tactile,.post-card,input,textarea,[data-floaty]';

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };

    const onOver = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (t && t.closest && t.closest(INTERACTIVE)) targetScale = 1.6;
    };

    const onOut = (e: MouseEvent) => {
      const t = e.target as Element | null;
      const rel = e.relatedTarget as Element | null;
      if (t && t.closest && t.closest(INTERACTIVE)) {
        if (!rel || !rel.closest || !rel.closest(INTERACTIVE)) targetScale = 1;
      }
    };

    const onDown = () => {
      targetScale = Math.min(targetScale, 0.9);
    };
    const onUp = () => {
      if (targetScale < 1) targetScale = 1.35;
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseover", onOver, { passive: true });
    document.addEventListener("mouseout", onOut, { passive: true });
    window.addEventListener("mousedown", onDown, { passive: true });
    window.addEventListener("mouseup", onUp, { passive: true });

    let rafId = 0;
    const loop = () => {
      cx += (mx - cx) * LAG;
      cy += (my - cy) * LAG;
      curScale += (targetScale - curScale) * SCALE_LAG;
      cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%) scale(${curScale})`;
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    // cleanup
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = ""; // restore native
      cursor.remove();
    };
  }, []);

  return null;
}
