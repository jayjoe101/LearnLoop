"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CopyIcon, SparkIcon } from "@/components/icons";

const TOOLBAR_WIDTH = 72;
const TOOLBAR_OFFSET = 8;
const LINE_TOLERANCE_PX = 4;
const MERGE_GAP_PX = 12;

type HighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type HighlightState = {
  text: string;
  rects: HighlightRect[];
  toolbarTop: number;
  toolbarLeft: number;
};

type RelativeRect = HighlightRect & {
  right: number;
  bottom: number;
};

function mergeSelectionRects(rects: RelativeRect[]): HighlightRect[] {
  if (rects.length === 0) return [];

  const lines: RelativeRect[][] = [];

  for (const rect of rects) {
    const line = lines.find(
      (group) => Math.abs(group[0].top - rect.top) <= LINE_TOLERANCE_PX
    );
    if (line) line.push(rect);
    else lines.push([rect]);
  }

  const merged: HighlightRect[] = [];

  for (const line of lines) {
    line.sort((a, b) => a.left - b.left);

    let current: RelativeRect = { ...line[0] };

    for (let i = 1; i < line.length; i += 1) {
      const next = line[i];
      const gap = next.left - current.right;

      if (gap <= MERGE_GAP_PX) {
        const right = Math.max(current.right, next.right);
        const bottom = Math.max(current.bottom, next.bottom);
        const top = Math.min(current.top, next.top);
        current = {
          top,
          left: current.left,
          width: right - current.left,
          height: bottom - top,
          right,
          bottom,
        };
      } else {
        merged.push({
          top: current.top,
          left: current.left,
          width: current.width,
          height: current.bottom - current.top,
        });
        current = { ...next };
      }
    }

    merged.push({
      top: current.top,
      left: current.left,
      width: current.width,
      height: current.bottom - current.top,
    });
  }

  return merged;
}

function getRangeHighlightRects(range: Range): HighlightRect[] {
  const relative = Array.from(range.getClientRects())
    .filter((rect) => rect.width > 0.5 && rect.height > 0.5)
    .map((rect) => ({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom,
    }));

  return mergeSelectionRects(relative);
}

function readSelection(
  container: HTMLElement
): HighlightState | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const ancestor = range.commonAncestorContainer;
  if (!container.contains(ancestor)) return null;

  const text = selection.toString();
  if (!text.trim()) return null;

  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;

  const rects = getRangeHighlightRects(range);
  if (rects.length === 0) return null;

  return {
    text,
    rects,
    toolbarTop: rect.top - TOOLBAR_OFFSET,
    toolbarLeft: rect.right - TOOLBAR_WIDTH,
  };
}

function preventSelectionCollapse(event: React.MouseEvent) {
  event.preventDefault();
}

export function PostTextSelection({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const liveId = useId();
  const rafRef = useRef(0);
  const isDraggingRef = useRef(false);
  const highlightRef = useRef<HighlightState | null>(null);
  const showToolbarRef = useRef(false);

  const [highlight, setHighlight] = useState<HighlightState | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [copied, setCopied] = useState(false);

  highlightRef.current = highlight;
  showToolbarRef.current = showToolbar;

  const clearHighlight = useCallback(() => {
    setHighlight(null);
    setShowToolbar(false);
    setCopied(false);
  }, []);

  const syncHighlight = useCallback((finalize = false) => {
    const container = containerRef.current;
    if (!container) {
      clearHighlight();
      return;
    }

    const next = readSelection(container);
    if (!next) {
      clearHighlight();
      return;
    }

    setHighlight(next);
    if (finalize) {
      setShowToolbar(true);
    }
  }, [clearHighlight]);

  const scheduleSync = useCallback(
    (finalize = false) => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => syncHighlight(finalize));
    },
    [syncHighlight]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMouseDown = (event: MouseEvent) => {
      if (!container.contains(event.target as Node)) return;
      isDraggingRef.current = true;
      setShowToolbar(false);
      setCopied(false);
    };

    const onMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      scheduleSync(true);
    };

    const onSelectionChange = () => {
      scheduleSync(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearHighlight();
    };

    const onScroll = () => {
      if (!highlightRef.current) return;
      scheduleSync(showToolbarRef.current);
    };

    const onResize = () => {
      if (!highlightRef.current) return;
      scheduleSync(showToolbarRef.current);
    };

    container.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      container.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [clearHighlight, scheduleSync]);

  useEffect(() => {
    if (!showToolbar) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (toolbarRef.current?.contains(target)) return;
      if (containerRef.current?.contains(target)) return;
      clearHighlight();
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [clearHighlight, showToolbar]);

  async function handleCopy() {
    if (!highlight?.text) return;

    try {
      await navigator.clipboard.writeText(highlight.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  const highlightPortal =
    highlight && highlight.rects.length > 0 && typeof document !== "undefined"
      ? createPortal(
          <div className="post-selection-highlight-layer" aria-hidden>
            {highlight.rects.map((rect, index) => (
              <div
                key={index}
                className="post-selection-highlight"
                style={{
                  top: rect.top,
                  left: rect.left,
                  width: rect.width,
                  height: rect.height,
                }}
              />
            ))}
          </div>,
          document.body
        )
      : null;

  const toolbarPortal =
    showToolbar && highlight && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={toolbarRef}
            className="post-selection-toolbar toolbar-icon-group"
            style={{
              top: Math.max(8, highlight.toolbarTop - 36),
              left: Math.max(8, highlight.toolbarLeft),
            }}
            role="toolbar"
            aria-label="Text selection actions"
          >
            <button
              type="button"
              className="toolbar-icon-btn"
              aria-label="Ask AI about selection (coming soon)"
              disabled
              onMouseDown={preventSelectionCollapse}
            >
              <span className="toolbar-icon-glyph" aria-hidden>
                <SparkIcon className="h-3.5 w-3.5" />
              </span>
            </button>
            <button
              type="button"
              className="toolbar-icon-btn"
              aria-label={copied ? "Copied" : "Copy selection"}
              onMouseDown={preventSelectionCollapse}
              onClick={handleCopy}
            >
              <span className="toolbar-icon-glyph" aria-hidden>
                <CopyIcon className="h-3.5 w-3.5" />
              </span>
            </button>
            <span id={liveId} className="sr-only" aria-live="polite">
              {copied ? "Copied to clipboard" : ""}
            </span>
          </div>,
          document.body
        )
      : null;

  return (
    <div
      ref={containerRef}
      className={
        highlight
          ? "post-text-selection post-text-selection--active"
          : "post-text-selection"
      }
    >
      {children}
      {highlightPortal}
      {toolbarPortal}
    </div>
  );
}