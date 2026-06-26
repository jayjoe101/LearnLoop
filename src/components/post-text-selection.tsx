"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CopyIcon, SparkIcon } from "@/components/icons";

const TOOLBAR_WIDTH = 72;
const TOOLBAR_OFFSET = 8;
const HIGHLIGHT_NAME = "learnloop-post-selection";
const LINE_TOLERANCE_PX = 4;
const MERGE_GAP_PX = 10;

type HighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type SelectionState = {
  text: string;
  toolbarTop: number;
  toolbarLeft: number;
  rects: HighlightRect[];
};

type RelativeRect = HighlightRect & {
  right: number;
  bottom: number;
};

function supportsCustomHighlight(): boolean {
  return (
    typeof CSS !== "undefined" &&
    "highlights" in CSS &&
    typeof Highlight !== "undefined"
  );
}

function setCustomHighlight(range: Range | null) {
  if (!supportsCustomHighlight()) return;
  if (!range) {
    CSS.highlights.delete(HIGHLIGHT_NAME);
    return;
  }
  CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(range));
}

function clearCustomHighlight() {
  if (!supportsCustomHighlight()) return;
  CSS.highlights.delete(HIGHLIGHT_NAME);
}

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
        current = {
          top: Math.min(current.top, next.top),
          left: current.left,
          width: right - current.left,
          height: bottom - Math.min(current.top, next.top),
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

function getRangeHighlightRects(range: Range, container: HTMLElement): HighlightRect[] {
  const containerRect = container.getBoundingClientRect();

  const relative = Array.from(range.getClientRects())
    .filter((rect) => rect.width > 0.5 && rect.height > 0.5)
    .map((rect) => ({
      top: rect.top - containerRect.top,
      left: rect.left - containerRect.left,
      width: rect.width,
      height: rect.height,
      right: rect.right - containerRect.left,
      bottom: rect.bottom - containerRect.top,
    }));

  return mergeSelectionRects(relative);
}

function getSelectionInContainer(
  container: HTMLElement
): { text: string; rect: DOMRect; range: Range; rects: HighlightRect[] } | null {
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

  return {
    text,
    rect,
    range,
    rects: getRangeHighlightRects(range, container),
  };
}

function preventSelectionCollapse(event: React.MouseEvent) {
  event.preventDefault();
}

export function PostTextSelection({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const liveId = useId();
  const useHighlightApiRef = useRef(supportsCustomHighlight());
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [copied, setCopied] = useState(false);

  const clearSelection = useCallback(() => {
    clearCustomHighlight();
    setSelection(null);
    setCopied(false);
  }, []);

  const updateSelection = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      clearSelection();
      return;
    }

    const result = getSelectionInContainer(container);
    if (!result) {
      clearSelection();
      return;
    }

    if (useHighlightApiRef.current) {
      setCustomHighlight(result.range);
    } else {
      clearCustomHighlight();
    }

    setCopied(false);
    setSelection({
      text: result.text,
      toolbarTop: result.rect.top - TOOLBAR_OFFSET,
      toolbarLeft: result.rect.right - TOOLBAR_WIDTH,
      rects: result.rects,
    });
  }, [clearSelection]);

  useEffect(() => {
    const onMouseUp = () => {
      requestAnimationFrame(updateSelection);
    };

    const onSelectionChange = () => {
      requestAnimationFrame(updateSelection);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearSelection();
    };

    const onResize = () => {
      if (!selection) return;
      updateSelection();
    };

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);

    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      clearCustomHighlight();
    };
  }, [clearSelection, selection, updateSelection]);

  useEffect(() => {
    if (!selection) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (toolbarRef.current?.contains(target)) return;
      if (containerRef.current?.contains(target)) return;
      clearSelection();
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [clearSelection, selection]);

  async function handleCopy() {
    if (!selection?.text) return;

    try {
      await navigator.clipboard.writeText(selection.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  const showFallbackHighlight =
    selection && !useHighlightApiRef.current && selection.rects.length > 0;

  const toolbarPortal =
    selection && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={toolbarRef}
            className="post-selection-toolbar toolbar-icon-group"
            style={{
              top: Math.max(8, selection.toolbarTop - 36),
              left: Math.max(8, selection.toolbarLeft),
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
        selection
          ? "post-text-selection post-text-selection--active"
          : "post-text-selection"
      }
    >
      {showFallbackHighlight && (
        <div className="post-selection-highlight-layer" aria-hidden>
          {selection.rects.map((rect, index) => (
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
        </div>
      )}
      {children}
      {toolbarPortal}
    </div>
  );
}